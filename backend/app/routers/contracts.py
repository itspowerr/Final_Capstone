from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Contract, ContractMilestone, ContractStatus, MilestoneStatus, Proposal, User
from app.routers.auth import get_current_user
from app.schemas import (
    ContractCreate,
    ContractDetail,
    ContractResponse,
    DisputeResponse,
    MilestoneReject,
    MilestoneResponse,
    MilestoneSubmit,
    ProposalResponse,
)

from app.services.contract_service import fund_contract as do_fund_contract, sign_contract as do_sign_contract

router = APIRouter(prefix="/contracts", tags=["contracts"])


def _enrich_contract(contract: Contract) -> ContractResponse:
    return ContractResponse.model_validate(contract)


@router.post("", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
async def create_contract(
    data: ContractCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role.value != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "CLIENT_ONLY", "message": "Only clients can create contracts"},
        )

    if data.milestones:
        total_milestone_amount = sum(m.amount for m in data.milestones)
        if abs(total_milestone_amount - data.total_amount) > 0.001:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "MILESTONE_SUM_MISMATCH",
                    "message": "Milestone amounts must sum to total_amount",
                },
            )

    contract = Contract(
        job_id=data.job_id,
        client_id=current_user.id,
        freelancer_id=data.freelancer_id,
        title=data.title,
        description=data.description,
        total_amount=data.total_amount,
        deadline=data.deadline,
        status=ContractStatus.pending_signatures,
    )
    db.add(contract)
    await db.flush()

    for i, m in enumerate(data.milestones):
        milestone = ContractMilestone(
            contract_id=contract.id,
            index=i,
            description=m.description,
            amount=m.amount,
            due_date=m.due_date,
            status=MilestoneStatus.pending,
        )
        db.add(milestone)

    await db.commit()
    await db.refresh(contract)
    return _enrich_contract(contract)


@router.get("", response_model=dict)
async def list_contracts(
    status_filter: str = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Contract).options(
        selectinload(Contract.milestones_rel)
    ).where(
        (Contract.client_id == current_user.id) | (Contract.freelancer_id == current_user.id)
    )
    if status_filter:
        query = query.where(Contract.status == ContractStatus(status_filter))

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    query = query.order_by(Contract.created_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    contracts = result.scalars().all()

    def _contract_with_milestones(c: Contract) -> dict:
        base = ContractResponse.model_validate(c).model_dump()
        base["milestones"] = [
            MilestoneResponse.model_validate(m).model_dump()
            for m in c.milestones_rel
        ]
        return base

    return {
        "contracts": [_contract_with_milestones(c) for c in contracts],
        "total": total or 0,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit) if total else 1,
    }


@router.get("/{contract_id}", response_model=ContractDetail)
async def get_contract(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Contract).options(
        selectinload(Contract.dispute)
    ).where(Contract.id == contract_id)
    result = await db.execute(query)
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

    milestones_result = await db.execute(
        select(ContractMilestone).where(
            ContractMilestone.contract_id == contract_id
        ).order_by(ContractMilestone.index)
    )
    milestones = milestones_result.scalars().all()

    dispute = None
    if contract.dispute:
        dispute = DisputeResponse.model_validate(contract.dispute)

    proposals_result = await db.execute(
        select(Proposal).where(Proposal.job_id == contract.job_id).order_by(Proposal.created_at.desc())
    )
    proposals = proposals_result.scalars().all()

    return ContractDetail(
        contract=_enrich_contract(contract),
        milestones=[MilestoneResponse.model_validate(m) for m in milestones],
        dispute=dispute,
        proposals=[ProposalResponse.model_validate(p) for p in proposals],
    )


async def _get_contract_for_party(contract_id: str, current_user: User, db: AsyncSession) -> Contract:
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
    return contract


async def _get_milestone(contract_id: str, index: int, db: AsyncSession) -> ContractMilestone:
    result = await db.execute(
        select(ContractMilestone).where(
            ContractMilestone.contract_id == contract_id,
            ContractMilestone.index == index,
        )
    )
    ms = result.scalar_one_or_none()
    if not ms:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "MILESTONE_NOT_FOUND", "message": "Milestone not found"},
        )
    return ms


@router.post("/{contract_id}/milestones/{index}/approve", response_model=MilestoneResponse)
async def approve_milestone(
    contract_id: str,
    index: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contract = await _get_contract_for_party(contract_id, current_user, db)
    if current_user.role.value != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "CLIENT_ONLY", "message": "Only the client can approve milestones"},
        )
    ms = await _get_milestone(contract_id, index, db)
    if ms.status != MilestoneStatus.submitted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "MILESTONE_NOT_SUBMITTED", "message": "Milestone has not been submitted"},
        )
    ms.status = MilestoneStatus.approved
    ms.approved_at = func.now()
    await db.commit()
    await db.refresh(ms)

    all_ms = await db.execute(
        select(ContractMilestone).where(ContractMilestone.contract_id == contract_id)
    )
    all_done = all(m.status == MilestoneStatus.approved for m in all_ms.scalars().all())
    if all_done:
        contract.status = ContractStatus.completed
        await db.commit()

    return MilestoneResponse.model_validate(ms)


@router.post("/{contract_id}/milestones/{index}/reject", response_model=MilestoneResponse)
async def reject_milestone(
    contract_id: str,
    index: int,
    data: MilestoneReject,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contract = await _get_contract_for_party(contract_id, current_user, db)
    if current_user.role.value != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "CLIENT_ONLY", "message": "Only the client can reject milestones"},
        )
    ms = await _get_milestone(contract_id, index, db)
    if ms.status != MilestoneStatus.submitted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "MILESTONE_NOT_SUBMITTED", "message": "Milestone has not been submitted"},
        )
    ms.status = MilestoneStatus.pending
    ms.deliverable_cid = None
    ms.submission_notes = None
    ms.submitted_at = None
    await db.commit()
    await db.refresh(ms)
    return MilestoneResponse.model_validate(ms)


@router.post("/{contract_id}/milestones/{index}/submit", response_model=MilestoneResponse)
async def submit_milestone(
    contract_id: str,
    index: int,
    data: MilestoneSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contract = await _get_contract_for_party(contract_id, current_user, db)
    if current_user.role.value != "freelancer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FREELANCER_ONLY", "message": "Only the freelancer can submit milestones"},
        )
    if contract.freelancer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "NOT_FREELANCER", "message": "You are not assigned to this contract"},
        )
    ms = await _get_milestone(contract_id, index, db)
    if ms.status != MilestoneStatus.pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "MILESTONE_NOT_PENDING", "message": "Only pending milestones can be submitted"},
        )
    ms.status = MilestoneStatus.submitted
    ms.deliverable_cid = data.deliverable_cid
    ms.submission_notes = data.submission_notes
    ms.submitted_at = func.now()
    await db.commit()
    await db.refresh(ms)
    return MilestoneResponse.model_validate(ms)


@router.post("/{contract_id}/sign", response_model=ContractResponse)
async def sign_contract(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        contract = do_sign_contract(db=db, contract_id=contract_id, user_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "SIGN_ERROR", "message": str(exc)},
        ) from exc

    result = await db.execute(
        select(Contract).options(selectinload(Contract.dispute)).where(Contract.id == contract_id)
    )
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CONTRACT_NOT_FOUND", "message": "Contract not found"},
        )
    milestones_result = await db.execute(
        select(ContractMilestone).where(ContractMilestone.contract_id == contract_id).order_by(ContractMilestone.index)
    )
    milestones = milestones_result.scalars().all()

    dispute = None
    if getattr(contract, "dispute", None):
        dispute = DisputeResponse.model_validate(contract.dispute)

    proposals_result = await db.execute(
        select(Proposal).where(Proposal.job_id == contract.job_id).order_by(Proposal.created_at.desc())
    )
    proposals = proposals_result.scalars().all()

    return ContractDetail(
        contract=_enrich_contract(contract),
        milestones=[MilestoneResponse.model_validate(m) for m in milestones],
        dispute=dispute,
        proposals=[ProposalResponse.model_validate(p) for p in proposals],
    )


@router.post("/{contract_id}/fund", response_model=ContractResponse)
async def fund_contract(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role.value != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "CLIENT_ONLY", "message": "Only the client can fund the contract"},
        )

    try:
        contract = do_fund_contract(db=db, contract_id=contract_id, user_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "FUND_ERROR", "message": str(exc)},
        ) from exc

    result = await db.execute(
        select(Contract).options(selectinload(Contract.dispute)).where(Contract.id == contract_id)
    )
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CONTRACT_NOT_FOUND", "message": "Contract not found"},
        )
    milestones_result = await db.execute(
        select(ContractMilestone).where(ContractMilestone.contract_id == contract_id).order_by(ContractMilestone.index)
    )
    milestones = milestones_result.scalars().all()

    dispute = None
    if getattr(contract, "dispute", None):
        dispute = DisputeResponse.model_validate(contract.dispute)

    proposals_result = await db.execute(
        select(Proposal).where(Proposal.job_id == contract.job_id).order_by(Proposal.created_at.desc())
    )
    proposals = proposals_result.scalars().all()

    return ContractDetail(
        contract=_enrich_contract(contract),
        milestones=[MilestoneResponse.model_validate(m) for m in milestones],
        dispute=dispute,
        proposals=[ProposalResponse.model_validate(p) for p in proposals],
    )

