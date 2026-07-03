from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Contract, ContractMilestone, Proposal, User
from app.routers.auth import get_current_user
from app.schemas import ProposalResponse

from app.services.blockchain_service import create_contract_on_chain, to_wei

router = APIRouter(prefix="/proposals", tags=["proposals"])


@router.post("", response_model=ProposalResponse, status_code=status.HTTP_201_CREATED)
async def create_proposal(
    data: ProposalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role.value != "freelancer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FREELANCER_ONLY", "message": "Only freelancers can submit proposals"},
        )

    existing = await db.execute(
        select(Proposal).where(
            Proposal.job_id == data.job_id,
            Proposal.freelancer_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ALREADY_APPLIED", "message": "You have already applied to this job"},
        )

    proposal = Proposal(
        job_id=data.job_id,
        freelancer_id=current_user.id,
        cover_letter=data.cover_letter,
        bid_amount=data.bid_amount,
        estimated_days=data.estimated_days,
    )
    db.add(proposal)
    await db.commit()
    await db.refresh(proposal)
    return ProposalResponse.model_validate(proposal)


@router.get("", response_model=dict)
async def list_proposals(
    job_id: str = Query(None),
    client_id: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if client_id:
        query = (
            select(Proposal)
            .join(Job, Proposal.job_id == Job.id)
            .where(Job.client_id == client_id)
            .order_by(Proposal.created_at.desc())
        )
    elif job_id:
        query = select(Proposal).where(Proposal.job_id == job_id).order_by(Proposal.created_at.desc())
    elif current_user.role.value == "freelancer":
        query = select(Proposal).where(Proposal.freelancer_id == current_user.id).order_by(Proposal.created_at.desc())
    else:
        query = select(Proposal).order_by(Proposal.created_at.desc())

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()

    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    proposals = result.scalars().all()

    return {
        "proposals": [ProposalResponse.model_validate(p) for p in proposals],
        "total": total or 0,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit) if total else 1,
    }


@router.post("/{proposal_id}/accept", response_model=ProposalResponse)
async def accept_proposal(
    proposal_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role.value != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "CLIENT_ONLY", "message": "Only clients can accept proposals"},
        )

    result = await db.execute(select(Proposal).where(Proposal.id == proposal_id))
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PROPOSAL_NOT_FOUND", "message": "Proposal not found"},
        )
    if proposal.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "PROPOSAL_NOT_PENDING", "message": "Proposal is no longer pending"},
        )

    result = await db.execute(
        select(Contract).where(
            Contract.job_id == proposal.job_id,
            Contract.client_id == current_user.id,
            Contract.freelancer_id.is_(None),
        )
    )
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "NO_AVAILABLE_CONTRACT", "message": "No available contract found for this job"},
        )

    contract.freelancer_id = proposal.freelancer_id
    proposal.status = "accepted"
    proposal.contract_id = contract.id

    remaining = await db.execute(
        select(Proposal).where(
            Proposal.job_id == proposal.job_id,
            Proposal.id != proposal_id,
            Proposal.status == "pending",
        )
    )
    for p in remaining.scalars().all():
        p.status = "rejected"

    await db.commit()
    await db.refresh(proposal)
    return ProposalResponse.model_validate(proposal)
