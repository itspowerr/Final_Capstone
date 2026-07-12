import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Base, get_db
from app.routers.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/messages", tags=["messages"])


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = {"schema": "freeledger"}

    id = Column(String(50), primary_key=True, default=lambda: f"msg_{uuid.uuid4().hex[:12]}")
    sender_id = Column(String(50), ForeignKey("freeledger.users.id"), nullable=False)
    receiver_id = Column(String(50), ForeignKey("freeledger.users.id"), nullable=False)
    content = Column(Text, nullable=False)
    job_id = Column(String(50), nullable=True)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


@router.post("/send")
async def send_message(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    receiver_id = body.get("receiver_id")
    content = body.get("content", "").strip()
    if not receiver_id or not content:
        raise HTTPException(status_code=400, detail="receiver_id and content are required")

    receiver = await db.execute(select(User).where(User.id == receiver_id))
    if not receiver.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Receiver not found")

    msg = Message(
        sender_id=current_user.id,
        receiver_id=receiver_id,
        content=content,
        job_id=body.get("job_id"),
    )
    db.add(msg)
    await db.commit()
    return {"status": "sent", "message_id": msg.id}


@router.get("/inbox")
async def get_inbox(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Message)
        .where(
            or_(
                Message.receiver_id == current_user.id,
                Message.sender_id == current_user.id,
            )
        )
        .order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()
    return [
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "receiver_id": m.receiver_id,
            "content": m.content,
            "job_id": m.job_id,
            "read": m.read,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


@router.post("/{message_id}/read")
async def mark_read(
    message_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Message).where(Message.id == message_id, Message.receiver_id == current_user.id)
    )
    msg = result.scalar_one_or_none()
    if msg:
        msg.read = True
        await db.commit()
    return {"status": "ok"}


@router.get("/unread-count")
async def unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(func.count()).select_from(Message).where(
            Message.receiver_id == current_user.id,
            Message.read == False,
        )
    )
    return {"count": result.scalar() or 0}
