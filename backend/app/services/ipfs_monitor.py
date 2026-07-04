import asyncio
import logging
from datetime import datetime, timezone

import httpx

from app.config import settings

logger = logging.getLogger("freeledger.ipfs_monitor")

_health: dict = {
    "status": "unknown",
    "last_successful_check": None,
    "last_failure_time": None,
    "consecutive_failures": 0,
    "last_checked": None,
    "version": None,
}

_previous_status: str | None = None


def _status_label(failures: int) -> str:
    if failures == 0:
        return "healthy"
    if failures <= settings.ipfs_degraded_threshold:
        return "degraded"
    return "down"


def get_ipfs_health() -> dict:
    return dict(_health)


async def _check_ipfs() -> dict:
    url = f"{settings.ipfs_api_url}/api/v0/version"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(url)
            response.raise_for_status()
            data = response.json()
            return {"ok": True, "version": data.get("Version", "unknown")}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def _monitor_loop():
    global _previous_status
    await asyncio.sleep(2)
    logger.info("IPFS monitor started (interval=%ss)", settings.ipfs_monitor_interval)

    while True:
        result = await _check_ipfs()
        now = datetime.now(timezone.utc)

        _health["last_checked"] = now.isoformat()

        if result["ok"]:
            _health["consecutive_failures"] = 0
            _health["last_successful_check"] = now.isoformat()
            _health["version"] = result.get("version")
        else:
            _health["consecutive_failures"] += 1
            _health["last_failure_time"] = now.isoformat()
            _health["version"] = None

        new_status = _status_label(_health["consecutive_failures"])
        _health["status"] = new_status

        if _previous_status is not None and new_status != _previous_status:
            logger.info(
                "IPFS status changed: %s -> %s (%s consecutive failures)",
                _previous_status.upper(), new_status.upper(),
                _health["consecutive_failures"],
            )
        _previous_status = new_status

        await asyncio.sleep(settings.ipfs_monitor_interval)


def start_ipfs_monitor():
    asyncio.create_task(_monitor_loop())
