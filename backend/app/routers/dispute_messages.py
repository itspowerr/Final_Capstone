import json
import uuid
from typing import Dict, Set

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, func, or_, select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import Base, async_session_factory, get_db
from app.routers.auth import get_current_user
from app.models import Dispute, DisputeStatus, User

router = APIRouter(prefix="/dispute-messages", tags=["dispute-messages"])


class DisputeConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            dead = []
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.active_connections[user_id].discard(ws)

    async def broadcast_to_both(self, sender_id: str, receiver_id: str, message: dict):
        await self.send_to_user(sender_id, message)
        await self.send_to_user(receiver_id, message)


manager = DisputeConnectionManager()


class DisputeMessage(Base):
    __tablename__ = "dispute_messages"
    __table_args__ = {"schema": "freeledger"}

    id = Column(String(50), primary_key=True, default=lambda: f"dmsg_{uuid.uuid4().hex[:12]}")
    dispute_id = Column(String(50), ForeignKey("freeledger.disputes.id"), nullable=False, index=True)
    sender_id = Column(String(50), ForeignKey("freeledger.users.id"), nullable=False)
    content = Column(Text, nullable=False)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


async def _get_admin_and_client(dispute_id: str, db: AsyncSession):
    result = await db.execute(select(Dispute).where(Dispute.id == dispute_id))
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    from app.models import Contract
    contract_result = await db.execute(select(Contract).where(Contract.id == dispute.contract_id))
    contract = contract_result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    return dispute, contract


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)


@router.post("/initiate")
async def initiate_chat(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Only admins can initiate dispute chats")

    dispute_id = body.get("dispute_id")
    if not dispute_id:
        raise HTTPException(status_code=400, detail="dispute_id is required")

    dispute, contract = await _get_admin_and_client(dispute_id, db)

    existing = await db.execute(
        select(DisputeMessage).where(DisputeMessage.dispute_id == dispute_id).limit(1)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Chat already exists for this dispute")

    content = body.get("content", "").strip()
    if not content:
        content = f"Admin has initiated a discussion regarding dispute {dispute_id}."

    msg = DisputeMessage(
        dispute_id=dispute_id,
        sender_id=current_user.id,
        content=content,
    )
    db.add(msg)
    await db.commit()

    message_data = {
        "type": "dispute_message",
        "message": {
            "id": msg.id,
            "dispute_id": msg.dispute_id,
            "sender_id": msg.sender_id,
            "content": msg.content,
            "read": False,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
        },
    }

    if contract.client_id:
        await manager.send_to_user(contract.client_id, message_data)

    return {"status": "initiated", "message_id": msg.id}


@router.post("/send")
async def send_message(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dispute_id = body.get("dispute_id")
    content = body.get("content", "").strip()
    if not dispute_id or not content:
        raise HTTPException(status_code=400, detail="dispute_id and content are required")

    dispute, contract = await _get_admin_and_client(dispute_id, db)

    is_admin = current_user.role.value == "admin"
    is_client = str(contract.client_id) == str(current_user.id)

    if not is_admin and not is_client:
        raise HTTPException(status_code=403, detail="You are not a party to this dispute")

    if is_client:
        msg_check = await db.execute(
            select(DisputeMessage).where(
                DisputeMessage.dispute_id == dispute_id,
                DisputeMessage.sender_id != current_user.id,
            ).limit(1)
        )
        if not msg_check.scalar_one_or_none():
            raise HTTPException(
                status_code=403,
                detail="You can only reply after an admin has initiated the chat",
            )

    msg = DisputeMessage(
        dispute_id=dispute_id,
        sender_id=current_user.id,
        content=content,
    )
    db.add(msg)
    await db.commit()

    message_data = {
        "type": "dispute_message",
        "message": {
            "id": msg.id,
            "dispute_id": msg.dispute_id,
            "sender_id": msg.sender_id,
            "content": msg.content,
            "read": False,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
        },
    }

    other_ids = set()
    if is_admin and contract.client_id:
        other_ids.add(contract.client_id)
    elif is_client:
        admin_result = await db.execute(
            select(DisputeMessage.sender_id).where(
                DisputeMessage.dispute_id == dispute_id,
            ).distinct()
        )
        for (uid,) in admin_result.all():
            if uid != current_user.id:
                other_ids.add(uid)

    for uid in other_ids:
        await manager.send_to_user(uid, message_data)
    await manager.send_to_user(current_user.id, message_data)

    return {"status": "sent", "message_id": msg.id}


@router.get("/{dispute_id}")
async def get_messages(
    dispute_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    dispute, contract = await _get_admin_and_client(dispute_id, db)

    is_admin = current_user.role.value == "admin"
    is_client = str(contract.client_id) == str(current_user.id)

    if not is_admin and not is_client:
        raise HTTPException(status_code=403, detail="You are not a party to this dispute")

    result = await db.execute(
        select(DisputeMessage)
        .where(DisputeMessage.dispute_id == dispute_id)
        .order_by(DisputeMessage.created_at.asc())
    )
    messages = result.scalars().all()

    return [
        {
            "id": m.id,
            "dispute_id": m.dispute_id,
            "sender_id": m.sender_id,
            "content": m.content,
            "read": m.read,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


@router.delete("/{dispute_id}")
async def delete_chat(
    dispute_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete dispute chats")

    result = await db.execute(
        select(DisputeMessage).where(DisputeMessage.dispute_id == dispute_id)
    )
    messages = result.scalars().all()

    if not messages:
        raise HTTPException(status_code=404, detail="No messages found for this dispute")

    await db.execute(
        delete(DisputeMessage).where(DisputeMessage.dispute_id == dispute_id)
    )
    await db.commit()

    _, contract = await _get_admin_and_client(dispute_id, db)
    if contract.client_id:
        await manager.send_to_user(contract.client_id, {
            "type": "dispute_chat_deleted",
            "dispute_id": dispute_id,
        })

    return {"status": "deleted"}


@router.post("/{dispute_id}/read")
async def mark_read(
    dispute_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(DisputeMessage).where(
            DisputeMessage.dispute_id == dispute_id,
            DisputeMessage.sender_id != current_user.id,
            DisputeMessage.read == False,
        )
    )
    unread = result.scalars().all()
    for msg in unread:
        msg.read = True
    if unread:
        await db.commit()
    return {"status": "ok", "marked": len(unread)}


@router.get("/{dispute_id}/unread-count")
async def unread_count(
    dispute_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(func.count()).select_from(DisputeMessage).where(
            DisputeMessage.dispute_id == dispute_id,
            DisputeMessage.sender_id != current_user.id,
            DisputeMessage.read == False,
        )
    )
    return {"count": result.scalar() or 0}
