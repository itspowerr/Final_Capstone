import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog

logger = logging.getLogger("freeledger.audit_service")


async def log_transition(
    db: AsyncSession,
    entity_type: str,
    entity_id: str,
    action: str,
    actor_id: str | None = None,
    actor_role: str | None = None,
    from_status: str | None = None,
    to_status: str | None = None,
    details: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        actor_id=actor_id,
        actor_role=actor_role,
        from_status=from_status,
        to_status=to_status,
        details=details,
    )
    db.add(entry)
    await db.flush()
    logger.debug("Audit log: %s %s -> %s on %s %s", action, from_status, to_status, entity_type, entity_id)
    return entry
