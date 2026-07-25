import asyncio
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.database import async_session_factory
from app.models import Job
from app.services.blockchain_service import get_contract, get_web3
from app.redis_client import get_redis

logger = logging.getLogger("freeledger.event_listener")

POLL_INTERVAL = 5
START_BLOCK_KEY = "event_listener:last_processed_block"
event_listener_running = False

_heartbeat: dict = {
    "last_heartbeat": None,
    "status": "unknown",
}


def get_heartbeat() -> dict:
    return dict(_heartbeat)


async def _update_heartbeat():
    now = datetime.now(timezone.utc)
    iso = now.isoformat()
    _heartbeat["last_heartbeat"] = iso
    _heartbeat["status"] = "active"

    redis = await get_redis()
    if redis is not None:
        try:
            await redis.set("event_listener:heartbeat", iso)
        except Exception:
            pass


async def _get_last_block(redis) -> int:
    val = await redis.get(START_BLOCK_KEY)
    return int(val) if val else 0


async def _set_last_block(redis, block_num: int):
    await redis.set(START_BLOCK_KEY, block_num)


async def process_contract_created(contract_id: int, client_address: str, db):
    result = await db.execute(
        select(Job).where(
            Job.on_chain_job_id.is_(None)
        ).limit(1)
    )
    job = result.scalar_one_or_none()
    if not job:
        return

    job.on_chain_job_id = contract_id
    logger.info("Job %s synced with on-chain contract %s", job.id, contract_id)


async def poll_events():
    global event_listener_running
    logger.info("Blockchain event listener started")
    event_listener_running = True

    while True:
        try:
            redis = await get_redis()
            if not redis:
                await asyncio.sleep(POLL_INTERVAL)
                continue

            last_block = await _get_last_block(redis)
            w3 = get_web3()
            current_block = w3.eth.block_number

            if current_block <= last_block:
                await _update_heartbeat()
                await asyncio.sleep(POLL_INTERVAL)
                continue

            contract = get_contract()
            from_block = last_block + 1

            created_events = contract.events.ContractCreated.get_logs(
                from_block=from_block, to_block=current_block
            )

            if created_events:
                async with async_session_factory() as db:
                    try:
                        for evt in created_events:
                            args = evt["args"]
                            await process_contract_created(
                                args["contractId"],
                                args["client"],
                                db,
                            )

                        await db.commit()
                    except Exception:
                        await db.rollback()
                        raise

            await _set_last_block(redis, current_block)
            await _update_heartbeat()

        except Exception as e:
            logger.error("Event listener error: %s", str(e), exc_info=True)

        await asyncio.sleep(POLL_INTERVAL)


def start_event_listener():
    asyncio.create_task(poll_events())
