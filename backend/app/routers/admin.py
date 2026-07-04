from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import AdminAccount, AuditLog, Contract, Dispute, DisputeStatus, User
from app.routers.auth import get_current_user
from app.schemas import AuditLogResponse, DisputeResponse

router = APIRouter(prefix="/admin", tags=["admin"])


async def _require_admin(current_user: User, db: AsyncSession) -> User:
    result = await db.execute(
        select(AdminAccount).where(AdminAccount.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ADMIN_REQUIRED", "message": "Admin access required"},
        )
    return current_user


@router.get("/disputes", response_model=dict)
async def admin_list_disputes(
    status_filter: str = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    query = select(Dispute).options(selectinload(Dispute.contract))
    if status_filter:
        query = query.where(Dispute.status == status_filter)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()

    query = query.order_by(Dispute.created_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    disputes = result.scalars().all()

    return {
        "disputes": [DisputeResponse.model_validate(d) for d in disputes],
        "total": total or 0,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit) if total else 1,
    }


@router.get("/audit-logs", response_model=dict)
async def list_audit_logs(
    entity_type: str = Query(None),
    entity_id: str = Query(None),
    action: str = Query(None),
    actor_id: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    query = select(AuditLog)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
    if action:
        query = query.where(AuditLog.action == action)
    if actor_id:
        query = query.where(AuditLog.actor_id == actor_id)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()

    query = query.order_by(AuditLog.created_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()

    return {
        "logs": [AuditLogResponse.model_validate(log) for log in logs],
        "total": total or 0,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit) if total else 1,
    }
