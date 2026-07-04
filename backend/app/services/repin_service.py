import asyncio
import json
import logging
import re

from sqlalchemy import text

from app.config import settings
from app.database import async_session_factory
from app.services.ipfs_service import pin_file

logger = logging.getLogger("freeledger.repin_service")


def is_valid_cid(cid: str) -> bool:
    if not cid or not isinstance(cid, str):
        return False
    return bool(re.match(r'^(Qm[a-zA-Z0-9]{44}|b[a-km-zA-HJ-NP-Z1-9]{58,})$', cid))


async def _collect_cids() -> set[str]:
    cids: set[str] = set()

    async with async_session_factory() as db:
        result = await db.execute(text(
            "SELECT terms_cid FROM freeledger.contracts WHERE terms_cid IS NOT NULL"
        ))
        for row in result:
            if row[0]:
                cids.add(row[0])

        result = await db.execute(text(
            "SELECT deliverable_cid FROM freeledger.contract_milestones WHERE deliverable_cid IS NOT NULL"
        ))
        for row in result:
            if row[0]:
                cids.add(row[0])

        result = await db.execute(text(
            "SELECT avatar_cid FROM freeledger.users WHERE avatar_cid IS NOT NULL"
        ))
        for row in result:
            if row[0]:
                cids.add(row[0])

        result = await db.execute(text(
            "SELECT portfolio_cids FROM freeledger.users WHERE portfolio_cids IS NOT NULL"
        ))
        for row in result:
            if row[0]:
                try:
                    for c in json.loads(row[0]):
                        if c:
                            cids.add(c)
                except (json.JSONDecodeError, TypeError):
                    pass

    return cids


async def _repin_loop():
    interval = settings.repin_interval_seconds
    logger.info("IPFS repin service started (interval=%ss)", interval)
    while True:
        try:
            cids = await _collect_cids()
            valid = {c for c in cids if is_valid_cid(c)}
            skipped = cids - valid
            if skipped:
                logger.warning("Skipping %d invalid CIDs: %s", len(skipped), skipped)
            logger.info("Repinning %d CIDs", len(valid))
            for cid in sorted(valid):
                try:
                    ok = await pin_file(cid)
                    if ok:
                        logger.debug("Repinned %s", cid)
                    else:
                        logger.warning("Failed to repin %s", cid)
                except Exception:
                    logger.exception("Error repinning %s", cid)
        except Exception:
            logger.exception("Repin collection failed")

        await asyncio.sleep(interval)


def start_repin_service():
    asyncio.create_task(_repin_loop())
