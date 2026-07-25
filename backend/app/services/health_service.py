from datetime import datetime, timezone

from sqlalchemy import text
from web3 import Web3

from app.config import settings
from app.database import async_session_factory
from app.redis_client import redis_client
from app.services.event_listener import get_heartbeat as get_listener_heartbeat


async def check_database() -> dict:
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


async def check_redis() -> dict:
    try:
        if redis_client is None:
            return {"status": "error", "detail": "not initialized"}
        await redis_client.ping()
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


async def check_ipfs() -> dict:
    from app.services.ipfs_monitor import get_ipfs_health

    h = get_ipfs_health()
    status_map = {"healthy": "ok", "degraded": "degraded", "down": "error", "unknown": "unknown"}
    result = {
        "status": status_map.get(h["status"], "unknown"),
        "last_checked": h["last_checked"],
        "consecutive_failures": h["consecutive_failures"],
    }
    if h["version"]:
        result["version"] = h["version"]
    return result


async def check_blockchain() -> dict:
    try:
        w3 = Web3(Web3.HTTPProvider(settings.rpc_url, request_kwargs={"timeout": 5}))
        if not w3.is_connected():
            return {"status": "error", "detail": "not connected"}
        return {
            "status": "ok",
            "chain_id": w3.eth.chain_id,
            "block_number": w3.eth.block_number,
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}


def check_event_listener() -> dict:
    if not settings.client_private_key:
        return {"status": "disabled", "detail": "no private key configured"}

    hb = get_listener_heartbeat()
    last_hb = hb.get("last_heartbeat")

    if not last_hb:
        return {"status": "error", "detail": "never started", "last_heartbeat": None, "seconds_since_last_heartbeat": None}

    now = datetime.now(timezone.utc)
    try:
        hb_time = datetime.fromisoformat(last_hb)
        seconds_since = int((now - hb_time).total_seconds())
    except (ValueError, TypeError):
        return {"status": "error", "detail": "invalid heartbeat timestamp", "last_heartbeat": last_hb, "seconds_since_last_heartbeat": None}

    if seconds_since <= settings.event_listener_heartbeat_timeout:
        status = "ok"
        detail = "active"
    elif seconds_since <= settings.event_listener_stale_timeout:
        status = "degraded"
        detail = "stale"
    else:
        status = "error"
        detail = "dead"

    return {
        "status": status,
        "detail": detail,
        "last_heartbeat": last_hb,
        "seconds_since_last_heartbeat": seconds_since,
    }
