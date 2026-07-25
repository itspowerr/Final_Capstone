from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import engine, Base
from app.redis_client import init_redis, close_redis
from app.routers import admin, auth, contracts, disputes, ipfs, jobs, messages, proposals, uploads, users, wallet_auth
from app.services.event_listener import start_event_listener
from app.services.ipfs_monitor import start_ipfs_monitor
from app.services.repin_service import start_repin_service

async def ensure_profile_columns(conn):
    if conn.dialect.name == "postgresql":
        await conn.execute(
            text("ALTER TYPE freeledger.auth_method ADD VALUE IF NOT EXISTS 'google'")
        )
    profile_columns = {
        "location": "VARCHAR(150)",
        "github": "VARCHAR(255)",
        "portfolio": "VARCHAR(255)",
        "linkedin": "VARCHAR(255)",
    }
    for column_name, column_type in profile_columns.items():
        await conn.execute(
            text(f"ALTER TABLE IF EXISTS freeledger.users ADD COLUMN IF NOT EXISTS {column_name} {column_type}")
        )

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Redis if available, but don't fail the app if Redis is unreachable.
    try:
        app.state.redis = aioredis.from_url(settings.redis_url, decode_responses=True)
        await init_redis()
    except Exception as e:
        # Log the error and continue without Redis
        print(f"Redis connection failed during startup: {e}")
        app.state.redis = None
    if app.state.redis:
        start_event_listener()
    start_ipfs_monitor()
    start_repin_service()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await ensure_profile_columns(conn)
    yield
    if app.state.redis:
        await app.state.redis.close()
    await close_redis()



def get_cors_origins(settings) -> list[str]:
    origins = settings.cors_origins
    if isinstance(origins, str):
        import json
        try:
            return json.loads(origins)
        except json.JSONDecodeError:
            return [o.strip() for o in origins.split(",") if o.strip()]
    return origins


app = FastAPI(
    title="FreeLedger API",
    version="1.0.0",
    lifespan=lifespan,
)

origins = get_cors_origins(settings)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
app.include_router(users.router, prefix="/api")
app.include_router(wallet_auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(ipfs.router, prefix="/api")
app.include_router(messages.router, prefix="/api")


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