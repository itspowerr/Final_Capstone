from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import Job, Message, Thread, User, UserRole
from app.routers.auth import get_current_user
from app.schemas import MessageResponse, MessageSend

router = APIRouter(prefix="/messages", tags=["messages"])

def participant(user_id):
    return or_(Thread.client_id == user_id, Thread.freelancer_id == user_id)

@router.get("/threads")
async def list_threads(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Thread).options(selectinload(Thread.client), selectinload(Thread.freelancer), selectinload(Thread.job)).where(participant(current_user.id)).order_by(Thread.created_at.desc()))
    items=[]
    for thread in result.scalars().all():
        last=(await db.execute(select(Message).where(Message.thread_id == thread.id).order_by(Message.created_at.desc()).limit(1))).scalar_one_or_none()
        unread=(await db.execute(select(func.count(Message.id)).where(Message.thread_id == thread.id, Message.receiver_id == current_user.id, Message.read.is_(False)))).scalar_one()
        other=thread.freelancer if thread.client_id == current_user.id else thread.client
        items.append({"id":thread.id,"other_user":{"id":other.id,"username":other.username,"email":other.email,"role":other.role.value},"job":{"id":thread.job.id,"title":thread.job.title} if thread.job else None,"latest_message":MessageResponse.model_validate(last) if last else None,"unread_count":unread,"created_at":thread.created_at})
    items.sort(key=lambda x: (x["latest_message"].created_at if x["latest_message"] else x["created_at"]), reverse=True)
    return {"threads":items}

@router.get("/threads/{thread_id}")
async def get_messages(thread_id: str, limit: int=Query(100,ge=1,le=200), db: AsyncSession=Depends(get_db), current_user: User=Depends(get_current_user)):
    thread=(await db.execute(select(Thread).where(Thread.id == thread_id, participant(current_user.id)))).scalar_one_or_none()
    if not thread: raise HTTPException(404, detail={"code":"THREAD_NOT_FOUND","message":"Conversation not found"})
    messages=(await db.execute(select(Message).where(Message.thread_id == thread_id).order_by(Message.created_at.asc()).limit(limit))).scalars().all()
    await db.execute(update(Message).where(Message.thread_id == thread_id, Message.receiver_id == current_user.id, Message.read.is_(False)).values(read=True)); await db.commit()
    return {"messages":[MessageResponse.model_validate(m) for m in messages]}

@router.post("/send", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(data: MessageSend, db: AsyncSession=Depends(get_db), current_user: User=Depends(get_current_user)):
    content=data.content.strip()
    if not content: raise HTTPException(422, detail={"code":"EMPTY_MESSAGE","message":"Message cannot be empty"})
    receiver=(await db.execute(select(User).where(User.id == data.receiver_id, User.is_active.is_(True)))).scalar_one_or_none()
    if not receiver: raise HTTPException(404, detail={"code":"USER_NOT_FOUND","message":"Recipient not found"})
    if receiver.id == current_user.id: raise HTTPException(400, detail={"code":"SELF_MESSAGE","message":"You cannot message yourself"})
    if receiver.role == current_user.role or UserRole.admin in (receiver.role,current_user.role): raise HTTPException(400, detail={"code":"INVALID_RECIPIENT","message":"Messages are available between clients and freelancers"})
    client_id=current_user.id if current_user.role == UserRole.client else receiver.id
    freelancer_id=current_user.id if current_user.role == UserRole.freelancer else receiver.id
    if data.job_id:
        job=(await db.execute(select(Job).where(Job.id == data.job_id, Job.client_id == client_id))).scalar_one_or_none()
        if not job:
            raise HTTPException(404, detail={"code":"JOB_NOT_FOUND","message":"Job not found or does not belong to this client"})
    job_clause=Thread.job_id == data.job_id if data.job_id else Thread.job_id.is_(None)
    thread=(await db.execute(select(Thread).where(Thread.client_id == client_id, Thread.freelancer_id == freelancer_id, job_clause))).scalar_one_or_none()
    if not thread: thread=Thread(client_id=client_id,freelancer_id=freelancer_id,job_id=data.job_id); db.add(thread); await db.flush()
    message=Message(thread_id=thread.id,sender_id=current_user.id,receiver_id=receiver.id,content=content); db.add(message); await db.commit(); await db.refresh(message)
    return MessageResponse.model_validate(message)

@router.get("/unread-count")
async def unread_count(db: AsyncSession=Depends(get_db), current_user: User=Depends(get_current_user)):
    count=(await db.execute(select(func.count(Message.id)).where(Message.receiver_id == current_user.id, Message.read.is_(False)))).scalar_one(); return {"count":count}
