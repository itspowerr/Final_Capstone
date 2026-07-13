from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Notification


async def create_notification(
    db: AsyncSession,
    *,
    user_id: str,
    type: str,
    title: str,
    message: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
):
    n = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    db.add(n)
    await db.flush()
    return n
