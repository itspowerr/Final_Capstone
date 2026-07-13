import asyncio
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.database import async_session_factory
from app.models import Contract, ContractMilestone, ContractStatus, Dispute, DisputeStatus, Job, MilestoneStatus
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


async def _find_contract_by_chain_id(chain_id: int, db):
    result = await db.execute(
        select(Contract).where(Contract.on_chain_id == chain_id)
    )
    return result.scalar_one_or_none()


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


async def process_milestone_submitted(contract_id: int, milestone_index: int, deliverable_cid: str, db):
    contract = await _find_contract_by_chain_id(contract_id, db)
    if not contract:
        return
    result = await db.execute(
        select(ContractMilestone).where(
            ContractMilestone.contract_id == contract.id,
            ContractMilestone.index == milestone_index,
        )
    )
    ms = result.scalar_one_or_none()
    if ms:
        ms.deliverable_cid = deliverable_cid
        ms.status = MilestoneStatus.submitted
        logger.info("Milestone %s/%s synced: submitted with CID %s", contract.id, milestone_index, deliverable_cid)


async def process_milestone_approved(contract_id: int, milestone_index: int, db):
    contract = await _find_contract_by_chain_id(contract_id, db)
    if not contract:
        return
    result = await db.execute(
        select(ContractMilestone).where(
            ContractMilestone.contract_id == contract.id,
            ContractMilestone.index == milestone_index,
        )
    )
    ms = result.scalar_one_or_none()
    if ms:
        ms.status = MilestoneStatus.approved
        ms.approved_at = datetime.now(timezone.utc)
        logger.info("Milestone %s/%s synced: approved", contract.id, milestone_index)


async def process_milestone_rejected(contract_id: int, milestone_index: int, db):
    contract = await _find_contract_by_chain_id(contract_id, db)
    if not contract:
        return
    result = await db.execute(
        select(ContractMilestone).where(
            ContractMilestone.contract_id == contract.id,
            ContractMilestone.index == milestone_index,
        )
    )
    ms = result.scalar_one_or_none()
    if ms:
        ms.status = MilestoneStatus.rejected
        logger.info("Milestone %s/%s synced: rejected", contract.id, milestone_index)


async def process_contract_completed(contract_id: int, db):
    contract = await _find_contract_by_chain_id(contract_id, db)
    if contract:
        contract.status = ContractStatus.completed
        logger.info("Contract %s synced: completed", contract.id)


async def process_contract_cancelled(contract_id: int, db):
    contract = await _find_contract_by_chain_id(contract_id, db)
    if contract:
        contract.status = ContractStatus.cancelled
        logger.info("Contract %s synced: cancelled", contract.id)


async def process_dispute_raised(contract_id: int, db):
    contract = await _find_contract_by_chain_id(contract_id, db)
    if not contract:
        return
    result = await db.execute(
        select(Dispute).where(Dispute.contract_id == contract.id)
    )
    dispute = result.scalar_one_or_none()
    if dispute:
        dispute.status = DisputeStatus.open
        logger.info("Dispute for contract %s synced: raised", contract.id)


async def process_dispute_resolved(contract_id: int, winner_address: str, db):
    contract = await _find_contract_by_chain_id(contract_id, db)
    if not contract:
        return
    result = await db.execute(
        select(Dispute).where(Dispute.contract_id == contract.id)
    )
    dispute = result.scalar_one_or_none()
    if dispute:
        dispute.status = DisputeStatus.resolved
        dispute.decision = "release" if winner_address and winner_address.lower() != contract.client_id else "refund"
        logger.info("Dispute for contract %s synced: resolved (%s)", contract.id, dispute.decision)


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
            w3 = await asyncio.to_thread(get_web3)
            current_block = await asyncio.to_thread(lambda: w3.eth.block_number)

            if current_block <= last_block:
                await _update_heartbeat()
                await asyncio.sleep(POLL_INTERVAL)
                continue

            contract = await asyncio.to_thread(get_contract)
            from_block = last_block + 1

            event_handlers = [
                ("ContractCreated", lambda args: (args["contractId"], args["client"])),
                ("MilestoneSubmitted", lambda args: (args["contractId"], args["milestoneIndex"], args.get("deliverableCID", ""))),
                ("MilestoneApproved", lambda args: (args["contractId"], args["milestoneIndex"])),
                ("MilestoneRejected", lambda args: (args["contractId"], args["milestoneIndex"])),
                ("ContractCompleted", lambda args: (args["contractId"],)),
                ("ContractCancelled", lambda args: (args["contractId"],)),
                ("DisputeRaised", lambda args: (args["contractId"],)),
                ("DisputeResolved", lambda args: (args["contractId"], args.get("winner", ""))),
            ]

            all_events = []
            for event_name, _ in event_handlers:
                try:
                    events = await asyncio.to_thread(
                        getattr(contract.events, event_name).get_logs,
                        fromBlock=from_block, toBlock=current_block,
                    )
                    all_events.append((event_name, events))
                except Exception:
                    pass

            if any(events for _, events in all_events):
                async with async_session_factory() as db:
                    try:
                        for event_name, events in all_events:
                            for evt in events:
                                args = evt["args"]
                                if event_name == "ContractCreated":
                                    await process_contract_created(args["contractId"], args["client"], db)
                                elif event_name == "MilestoneSubmitted":
                                    await process_milestone_submitted(args["contractId"], args["milestoneIndex"], args.get("deliverableCID", ""), db)
                                elif event_name == "MilestoneApproved":
                                    await process_milestone_approved(args["contractId"], args["milestoneIndex"], db)
                                elif event_name == "MilestoneRejected":
                                    await process_milestone_rejected(args["contractId"], args["milestoneIndex"], db)
                                elif event_name == "ContractCompleted":
                                    await process_contract_completed(args["contractId"], db)
                                elif event_name == "ContractCancelled":
                                    await process_contract_cancelled(args["contractId"], db)
                                elif event_name == "DisputeRaised":
                                    await process_dispute_raised(args["contractId"], db)
                                elif event_name == "DisputeResolved":
                                    await process_dispute_resolved(args["contractId"], args.get("winner", ""), db)

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
