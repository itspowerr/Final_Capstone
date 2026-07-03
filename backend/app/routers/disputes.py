from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Contract, ContractStatus, Dispute, DisputeStatus, User
from app.routers.auth import get_current_user
from app.schemas import DisputeCreate, DisputeResponse

router = APIRouter(tags=["disputes"])


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

    dispute = Dispute(
        contract_id=contract_id,
        raised_by=current_user.id,
        reason=data.reason,
        status=DisputeStatus.open,
    )
    db.add(dispute)

    contract.status = ContractStatus.disputed
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
