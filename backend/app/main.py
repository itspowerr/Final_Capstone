from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.redis_client import init_redis, close_redis
from app.routers import admin, auth, contracts, disputes, dispute_messages, ipfs, jobs, messages, notifications, proposals, uploads, users, wallet_auth
from app.services.event_listener import start_event_listener
from app.services.ipfs_monitor import start_ipfs_monitor
from app.services.repin_service import start_repin_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = aioredis.from_url(
        settings.redis_url, decode_responses=True
    )
    await init_redis()
    start_event_listener()
    start_ipfs_monitor()
    start_repin_service()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Add columns that may not exist yet (safe for existing DBs)
        for col, typ in [
            ("location", "TEXT"),
            ("github_url", "TEXT"),
            ("linkedin_url", "TEXT"),
            ("portfolio_url", "TEXT"),
        ]:
            await conn.execute(
                __import__("sqlalchemy").text(
                    f'ALTER TABLE freeledger.users ADD COLUMN IF NOT EXISTS {col} {typ}'
                )
            )
        # Fix contracts.freelancer_id to be nullable (DB may have NOT NULL from earlier schema)
        await conn.execute(
            __import__("sqlalchemy").text(
                'ALTER TABLE freeledger.contracts ALTER COLUMN freelancer_id DROP NOT NULL'
            )
        )
        # Add job_id to messages if missing
        await conn.execute(
            __import__("sqlalchemy").text(
                'ALTER TABLE freeledger.messages ADD COLUMN IF NOT EXISTS job_id VARCHAR(50)'
            )
        )
        # One-time: clear stale on_chain_id after GigEscrow contract redeployed with _client param
        await conn.execute(
            __import__("sqlalchemy").text(
                'CREATE TABLE IF NOT EXISTS freeledger.schema_migrations (id SERIAL PRIMARY KEY, name VARCHAR(100) UNIQUE NOT NULL, applied_at TIMESTAMP DEFAULT NOW())'
            )
        )
        migration_check = await conn.execute(
            __import__("sqlalchemy").text(
                "SELECT 1 FROM freeledger.schema_migrations WHERE name = 'clear_stale_onchain_ids_v2'"
            )
        )
        if not migration_check.fetchone():
            await conn.execute(
                __import__("sqlalchemy").text(
                    'UPDATE freeledger.contracts SET on_chain_id = NULL, contract_address = NULL WHERE on_chain_id IS NOT NULL'
                )
            )
            await conn.execute(
                __import__("sqlalchemy").text(
                    "INSERT INTO freeledger.schema_migrations (name) VALUES ('clear_stale_onchain_ids_v2')"
                )
            )

        # One-time: drop UNIQUE constraint on wallet_address (allow max 2 accounts per wallet)
        wallet_migration_check = await conn.execute(
            __import__("sqlalchemy").text(
                "SELECT 1 FROM freeledger.schema_migrations WHERE name = 'wallet_unique_relaxed_v3'"
            )
        )
        if not wallet_migration_check.fetchone():
            await conn.execute(
                __import__("sqlalchemy").text(
                    'DROP INDEX IF EXISTS freeledger.ix_users_wallet_address'
                )
            )
            await conn.execute(
                __import__("sqlalchemy").text(
                    'CREATE INDEX ix_users_wallet_address ON freeledger.users (wallet_address)'
                )
            )
            await conn.execute(
                __import__("sqlalchemy").text(
                    "INSERT INTO freeledger.schema_migrations (name) VALUES ('wallet_unique_relaxed_v3')"
                )
            )
    yield
    await app.state.redis.close()
    await close_redis()


app = FastAPI(
    title="FreeLedger API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(contracts.router, prefix="/api")
app.include_router(disputes.router, prefix="/api")
app.include_router(uploads.router, prefix="/api")
app.include_router(proposals.router, prefix="/api")
app.include_router(messages.router, prefix="/api")
app.include_router(dispute_messages.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(wallet_auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(ipfs.router, prefix="/api")


@app.get("/api/health")
async def api_health_check():
    from app.services.health_service import (
        check_blockchain,
        check_database,
        check_event_listener,
        check_ipfs,
        check_redis,
    )

    db = await check_database()
    redis = await check_redis()
    ipfs = await check_ipfs()
    blockchain = await check_blockchain()
    event_listener = check_event_listener()

    all_ok = all(
        s["status"] == "ok" or s["status"] == "disabled"
        for s in [db, redis, ipfs, blockchain, event_listener]
    )

    return {
        "status": "ok" if all_ok else "degraded",
        "version": "1.0.0",
        "services": {
            "database": db,
            "redis": redis,
            "ipfs": ipfs,
            "blockchain": blockchain,
            "event_listener": event_listener,
        },
    }


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/event-listener/heartbeat")
async def event_listener_heartbeat():
    from app.services.event_listener import get_heartbeat
    return get_heartbeat()