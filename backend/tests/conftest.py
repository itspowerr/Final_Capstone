import asyncio
import os
import sys
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-testing")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")
os.environ.setdefault("RPC_URL", "http://127.0.0.1:8545")
os.environ.setdefault("CONTRACT_ADDRESS", "0x5FbDB2315678afecb367f032d93F642f64180aa3")
os.environ.setdefault("CLIENT_PRIVATE_KEY", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
os.environ.setdefault("FREELANCER_PRIVATE_KEY", "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
import sqlalchemy as sa

from app.database import Base
from app.models import (
    User, UserRole, AuthMethod, Job, Contract, ContractStatus,
    ContractMilestone, MilestoneStatus, Dispute, DisputeStatus,
    AdminAccount
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def _engine():
    for table in Base.metadata.sorted_tables:
        table.schema = None
    eng = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def _session_factory(_engine):
    return async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def seed(_session_factory):
    async with _session_factory() as db:
        for table in reversed(Base.metadata.sorted_tables):
            await db.execute(table.delete())
        await db.flush()

        hashed = pwd_context.hash("testpassword123")
        client = User(id="usr_client1", email="client@test.com", username="client1",
                      password_hash=hashed, auth_method=AuthMethod.email,
                      wallet_address="0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
                      role=UserRole.client, is_active=True)
        freelancer = User(id="usr_freel1", email="freel@test.com", username="freel1",
                          password_hash=hashed, auth_method=AuthMethod.email,
                          wallet_address="0x3c44cdddb6a900da2a46d20b6c89e2e0a0a0e0e0",
                          role=UserRole.freelancer, is_active=True)
        admin = User(id="usr_admin1", email="admin@test.com", username="admin1",
                     password_hash=hashed, auth_method=AuthMethod.email,
                     role=UserRole.admin, is_active=True)
        db.add_all([client, freelancer, admin, AdminAccount(user_id="usr_admin1", role="admin")])
        await db.flush()
        job = Job(id="job_001", client_id="usr_client1", title="Test Job", budget=1000.0, status="open")
        db.add(job)
        await db.flush()
        contract = Contract(id="ct_001", job_id="job_001", client_id="usr_client1",
                            freelancer_id="usr_freel1", title="Test Contract",
                            total_amount=1000.0, status=ContractStatus.active, on_chain_id=1)
        db.add(contract)
        await db.flush()
        ms0 = ContractMilestone(id="ms_000", contract_id="ct_001", index=0, amount=500.0,
                                status=MilestoneStatus.pending, description="Milestone 0")
        ms1 = ContractMilestone(id="ms_001", contract_id="ct_001", index=1, amount=500.0,
                                status=MilestoneStatus.pending, description="Milestone 1")
        db.add_all([ms0, ms1])
        await db.commit()
        return {"client": client, "freelancer": freelancer, "admin": admin,
                "job": job, "contract": contract, "ms0": ms0, "ms1": ms1}


@pytest_asyncio.fixture
async def tc(seed, _session_factory):
    """Main test-context fixture. Provides db, http client, and seed data."""
    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.set = AsyncMock()
    mock_redis.delete = AsyncMock()
    mock_redis.ping = AsyncMock()

    async with _session_factory() as db:

        async def override_get_db():
            yield db

        from app.main import app
        from app.routers import auth as auth_router
        app.dependency_overrides.clear()
        app.dependency_overrides[auth_router.get_db] = override_get_db
        for name in ["contracts", "disputes", "jobs", "proposals", "messages",
                     "notifications", "users", "wallet_auth", "admin",
                     "dispute_messages", "uploads", "ipfs"]:
            try:
                mod = __import__(f"app.routers.{name}", fromlist=["get_db"])
                if hasattr(mod, "get_db"):
                    app.dependency_overrides[mod.get_db] = override_get_db
            except (ImportError, AttributeError):
                pass
        app.state = MagicMock()

        import app.redis_client as redis_mod
        redis_mod.redis_client = mock_redis

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as http:
            yield {"http": http, "db": db, "redis": mock_redis, **seed}

        app.dependency_overrides.clear()


def auth(uid):
    from app.routers.auth import create_access_token
    return {"Authorization": f"Bearer {create_access_token(uid)}"}


@pytest.fixture
def mock_redis_for_wallet():
    store = {}
    m = AsyncMock()
    m.set = AsyncMock(side_effect=lambda k, v, ex=None: store.update({k: v}))
    m.get = AsyncMock(side_effect=lambda k: store.get(k))
    m.delete = AsyncMock(side_effect=lambda k: store.pop(k, None))
    return m, store
