import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import AdminAccount, Contract, ContractStatus, Dispute, DisputeStatus, User
from app.routers.auth import get_current_user
from app.schemas import DisputeCreate, DisputeResolveRequest, DisputeResponse
from app.services import blockchain_service
from app.services.audit_service import log_transition

router = APIRouter(tags=["disputes"])


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


@router.post("/contracts/{contract_id}/disputes", response_model=DisputeResponse, status_code=status.HTTP_201_CREATED)
async def create_dispute(
    contract_id: str,
    data: DisputeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CONTRACT_NOT_FOUND", "message": "Contract not found"},
        )
    if contract.client_id != current_user.id and contract.freelancer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "NOT_CONTRACT_PARTY", "message": "Not a party to this contract"},
        )

    if contract.status == ContractStatus.completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "CONTRACT_COMPLETED", "message": "Cannot dispute a completed contract"},
        )

    if contract.status == ContractStatus.cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "CONTRACT_CANCELLED", "message": "Cannot dispute a cancelled contract"},
        )

    existing = await db.execute(
        select(Dispute).where(
            Dispute.contract_id == contract_id,
            Dispute.status != DisputeStatus.resolved,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "DISPUTE_EXISTS", "message": "An active dispute already exists for this contract"},
        )

    if contract.on_chain_id is not None:
        try:
            on_chain_id = int(contract.on_chain_id)
            await asyncio.to_thread(
                blockchain_service.raise_dispute_on_chain,
                contract_id=on_chain_id,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"code": "BLOCKCHAIN_DISPUTE_FAILED", "message": f"On-chain dispute failed: {exc}"},
            )

    dispute = Dispute(
        contract_id=contract_id,
        raised_by=current_user.id,
        reason=data.reason,
        status=DisputeStatus.open,
    )
    db.add(dispute)

    old_status = contract.status.value if contract.status else None
    contract.status = ContractStatus.disputed
    await db.flush()
    await log_transition(
        db=db,
        entity_type="contract",
        entity_id=contract.id,
        action="dispute",
        actor_id=current_user.id,
        actor_role=current_user.role.value,
        from_status=old_status,
        to_status="disputed",
        details=data.reason,
    )
    from app.services.notification_service import create_notification
    from app.models import User as UserModel, AdminAccount
    admins = await db.execute(select(AdminAccount))
    for admin in admins.scalars().all():
        await create_notification(
            db=db,
            user_id=admin.user_id,
            type="dispute_raised",
            title="Dispute raised",
            message=f"A dispute was raised on contract \"{contract.title}\". Reason: {data.reason[:100]}",
            entity_type="dispute",
            entity_id=dispute.id,
        )
    await db.commit()
    await db.refresh(dispute)
    return DisputeResponse.model_validate(dispute)


@router.post("/disputes/{dispute_id}/resolve", response_model=DisputeResponse)
async def resolve_dispute(
    dispute_id: str,
    data: DisputeResolveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    result = await db.execute(
        select(Dispute).options(selectinload(Dispute.contract)).where(Dispute.id == dispute_id)
    )
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DISPUTE_NOT_FOUND", "message": "Dispute not found"},
        )
    if dispute.status == DisputeStatus.resolved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ALREADY_RESOLVED", "message": "Dispute already resolved"},
        )

    contract = dispute.contract
    if contract and contract.on_chain_id is not None:
        try:
            on_chain_id = int(contract.on_chain_id)
            await asyncio.to_thread(
                blockchain_service.resolve_dispute_on_chain,
                contract_id=on_chain_id,
                release_to_freelancer=data.release_to_freelancer,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={"code": "BLOCKCHAIN_RESOLVE_FAILED", "message": f"On-chain resolution failed: {exc}"},
            )

    dispute.status = DisputeStatus.resolved
    dispute.decision = "release" if data.release_to_freelancer else "refund"
    dispute.resolved_by = current_user.id
    dispute.resolution_notes = data.resolution_notes

    if contract:
        old_status = contract.status.value if contract.status else None
        contract.status = ContractStatus.completed if data.release_to_freelancer else ContractStatus.cancelled
        await db.flush()
        await log_transition(
            db=db,
            entity_type="contract",
            entity_id=contract.id,
            action="resolve_dispute",
            actor_id=current_user.id,
            actor_role=current_user.role.value,
            from_status=old_status,
            to_status=contract.status.value,
            details=f"Decision: {'release to freelancer' if data.release_to_freelancer else 'refund to client'}. {data.resolution_notes or ''}",
        )
        from app.services.notification_service import create_notification
        decision = "released to freelancer" if data.release_to_freelancer else "refunded to client"
        if contract.client_id:
            await create_notification(
                db=db,
                user_id=contract.client_id,
                type="dispute_resolved",
                title="Dispute resolved",
                message=f"Dispute on \"{contract.title}\" resolved: {decision}. {data.resolution_notes or ''}",
                entity_type="dispute",
                entity_id=dispute.id,
            )
        if contract.freelancer_id:
            await create_notification(
                db=db,
                user_id=contract.freelancer_id,
                type="dispute_resolved",
                title="Dispute resolved",
                message=f"Dispute on \"{contract.title}\" resolved: {decision}. {data.resolution_notes or ''}",
                entity_type="dispute",
                entity_id=dispute.id,
            )

    await db.commit()
    await db.refresh(dispute)
    return DisputeResponse.model_validate(dispute)


@router.get("/disputes", response_model=dict)
async def list_disputes(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    subq = select(Contract.id).where(
        (Contract.client_id == current_user.id) | (Contract.freelancer_id == current_user.id)
    ).subquery()

    query = select(Dispute).where(Dispute.contract_id.in_(select(subq.c.id)))
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
