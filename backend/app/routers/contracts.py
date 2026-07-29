import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import AuditLog, Contract, ContractMilestone, ContractStatus, Job, MilestoneStatus, Proposal, User
from app.routers.auth import get_current_user
from app.schemas import (
    AuditLogResponse,
    ContractCreate,
    ContractDetail,
    ContractResponse,
    DisputeResponse,
    MilestoneReject,
    MilestoneResponse,
    MilestoneSubmit,
    ProjectHistoryResponse,
    ProjectStatusResponse,
    ProposalResponse,
)

from app.config import settings
from app.services import blockchain_service
import logging

logger = logging.getLogger("freeledger.contracts")
from app.services.audit_service import log_transition
from app.services.blockchain_service import create_contract_on_chain, get_contract_state, to_wei
from app.services.contract_service import fund_contract as do_fund_contract, sign_contract as do_sign_contract
from app.services.ipfs_service import upload_contract_terms

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
        on_chain_id=None,
        contract_address=None,
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

    # Deploy on-chain using backend key so the client on-chain matches the backend
    try:
        freelancer_addr = data.freelancer_id if data.freelancer_id else "0x0000000000000000000000000000000000000000"
        # Look up freelancer wallet if ID is provided
        if data.freelancer_id:
            fl_user = await db.get(User, data.freelancer_id)
            if fl_user and fl_user.wallet_address:
                freelancer_addr = fl_user.wallet_address

        client_wallet = current_user.wallet_address

        terms_doc = {
            "contract_id": contract.id,
            "title": data.title,
            "description": data.description,
            "total_amount": data.total_amount,
            "deadline": data.deadline.isoformat() if data.deadline else None,
            "client_id": current_user.id,
            "freelancer_id": data.freelancer_id,
            "milestones": [{"description": m.description, "amount": m.amount} for m in data.milestones],
        }
        try:
            ipfs_result = await upload_contract_terms(terms_doc)
            terms_cid = ipfs_result["cid"]
        except Exception:
            terms_cid = f"contract_{contract.id}"
        contract.terms_cid = terms_cid

        deadline_ts = int(data.deadline.timestamp()) if data.deadline else 0
        on_chain = await asyncio.to_thread(
            create_contract_on_chain,
            freelancer_address=freelancer_addr,
            title=data.title or "",
            terms_cid=terms_cid,
            total_amount_wei=to_wei(float(data.total_amount)),
            deadline=deadline_ts,
            milestone_descs=[m.description for m in data.milestones],
            milestone_amounts=[to_wei(float(m.amount)) for m in data.milestones],
            client_address=client_wallet,
        )
        if on_chain.get("on_chain_id") is not None:
            contract.on_chain_id = int(on_chain["on_chain_id"])
            contract.contract_address = on_chain.get("contract_address")
    except Exception as e:
        logger.exception("Failed to create contract on-chain: %s", e)

    await log_transition(
        db=db,
        entity_type="contract",
        entity_id=contract.id,
        action="create",
        actor_id=current_user.id,
        actor_role=current_user.role.value,
        from_status=None,
        to_status="pending_signatures",
    )
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

    response = {
        "contracts": [_contract_with_milestones(c) for c in contracts],
        "total": total or 0,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit) if total else 1,
    }

    if current_user.role.value == "freelancer":
        prop_query = (
            select(Proposal, Job.title)
            .join(Job, Proposal.job_id == Job.id)
            .where(Proposal.freelancer_id == current_user.id)
            .where(Proposal.status == "pending")
            .order_by(Proposal.created_at.desc())
        )
        prop_result = await db.execute(prop_query)
        proposals = []
        for prop, job_title in prop_result.all():
            p = ProposalResponse.model_validate(prop).model_dump()
            p["job_title"] = job_title
            proposals.append(p)
        response["proposals"] = proposals

    return response


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

    if contract.on_chain_id is not None:
        on_chain_id = int(contract.on_chain_id)
        await asyncio.to_thread(
            blockchain_service.approve_milestone_on_chain,
            contract_id=on_chain_id,
            milestone_index=index,
        )

    ms.status = MilestoneStatus.approved
    ms.approved_at = func.now()
    await db.flush()
    await log_transition(
        db=db,
        entity_type="milestone",
        entity_id=ms.id,
        action="approve",
        actor_id=current_user.id,
        actor_role=current_user.role.value,
        from_status="submitted",
        to_status="approved",
    )

    all_ms = await db.execute(
        select(ContractMilestone).where(ContractMilestone.contract_id == contract_id)
    )
    all_done = all(m.status == MilestoneStatus.approved for m in all_ms.scalars().all())
    if all_done:
        contract.status = ContractStatus.completed
        await log_transition(
            db=db,
            entity_type="contract",
            entity_id=contract.id,
            action="complete",
            actor_id=current_user.id,
            actor_role=current_user.role.value,
            from_status="active",
            to_status="completed",
        )

    from app.services.notification_service import create_notification
    await create_notification(
        db=db,
        user_id=contract.freelancer_id,
        type="milestone_approved",
        title="Milestone approved",
        message=f"Milestone \"{ms.description}\" was approved. Payment released!",
        entity_type="milestone",
        entity_id=ms.id,
    )
    if all_done:
        await create_notification(
            db=db,
            user_id=contract.freelancer_id,
            type="contract_completed",
            title="Contract completed",
            message=f"All milestones in \"{contract.title}\" are approved. Contract is complete!",
            entity_type="contract",
            entity_id=contract.id,
        )
    await db.commit()
    await db.refresh(ms)
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

    if contract.on_chain_id is not None:
        on_chain_id = int(contract.on_chain_id)
        await asyncio.to_thread(
            blockchain_service.reject_milestone_on_chain,
            contract_id=on_chain_id,
            milestone_index=index,
        )

    ms.status = MilestoneStatus.in_progress
    ms.deliverable_cid = None
    ms.submission_notes = None
    ms.submitted_at = None
    ms.rejection_reason = data.reason
    await db.flush()
    await log_transition(
        db=db,
        entity_type="milestone",
        entity_id=ms.id,
        action="reject",
        actor_id=current_user.id,
        actor_role=current_user.role.value,
        from_status="submitted",
        to_status="in_progress",
        details=data.reason,
    )
    from app.services.notification_service import create_notification
    await create_notification(
        db=db,
        user_id=contract.freelancer_id,
        type="milestone_rejected",
        title="Milestone rejected",
        message=f"Milestone \"{ms.description}\" was rejected. Reason: {data.reason}",
        entity_type="milestone",
        entity_id=ms.id,
    )
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
    if ms.status not in (MilestoneStatus.pending, MilestoneStatus.in_progress):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "MILESTONE_NOT_SUBMITTABLE", "message": "Only pending or in-progress milestones can be submitted"},
        )

    prev_status = ms.status.value

    if contract.on_chain_id is not None and data.deliverable_cid:
        on_chain_id = int(contract.on_chain_id)
        await asyncio.to_thread(
            blockchain_service.submit_milestone_on_chain,
            contract_id=on_chain_id,
            milestone_index=index,
            deliverable_cid=data.deliverable_cid,
        )

    ms.status = MilestoneStatus.submitted
    ms.deliverable_cid = data.deliverable_cid
    ms.submission_notes = data.submission_notes
    ms.submitted_at = func.now()
    await db.flush()
    await log_transition(
        db=db,
        entity_type="milestone",
        entity_id=ms.id,
        action="submit",
        actor_id=current_user.id,
        actor_role=current_user.role.value,
        from_status=prev_status,
        to_status="submitted",
    )
    from app.services.notification_service import create_notification
    await create_notification(
        db=db,
        user_id=contract.client_id,
        type="milestone_submitted",
        title="Milestone submitted",
        message=f"Freelancer submitted work for \"{ms.description}\". Review it when ready.",
        entity_type="milestone",
        entity_id=ms.id,
    )
    await db.commit()
    await db.refresh(ms)
    return MilestoneResponse.model_validate(ms)


@router.get("/{contract_id}/status", response_model=ProjectStatusResponse)
async def get_project_status(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contract = await _get_contract_for_party(contract_id, current_user, db)

    milestones_result = await db.execute(
        select(ContractMilestone)
        .where(ContractMilestone.contract_id == contract_id)
        .order_by(ContractMilestone.index)
    )
    milestones = milestones_result.scalars().all()

    return ProjectStatusResponse(
        contract_id=contract.id,
        status=contract.status.value,
        milestones=[MilestoneResponse.model_validate(m) for m in milestones],
    )


@router.get("/{contract_id}/history", response_model=ProjectHistoryResponse)
async def get_project_history(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_contract_for_party(contract_id, current_user, db)

    milestone_ids_result = await db.execute(
        select(ContractMilestone.id)
        .where(ContractMilestone.contract_id == contract_id)
    )
    milestone_ids = [row[0] for row in milestone_ids_result.all()]

    query = select(AuditLog).where(
        (AuditLog.entity_type == "contract") & (AuditLog.entity_id == contract_id)
        | (AuditLog.entity_type == "milestone") & (AuditLog.entity_id.in_(milestone_ids))
    ).order_by(AuditLog.created_at.asc())

    result = await db.execute(query)
    logs = result.scalars().all()

    return ProjectHistoryResponse(
        history=[AuditLogResponse.model_validate(log) for log in logs]
    )


@router.post("/{contract_id}/sign", response_model=ContractDetail)
async def sign_contract(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    old_result = await db.execute(select(Contract).where(Contract.id == contract_id))
    old_contract = old_result.scalar_one_or_none()
    old_status = old_contract.status.value if old_contract else None

    try:
        contract = await do_sign_contract(db=db, contract_id=contract_id, user_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "SIGN_ERROR", "message": str(exc)},
        ) from exc

    await log_transition(
        db=db,
        entity_type="contract",
        entity_id=contract_id,
        action="sign",
        actor_id=current_user.id,
        actor_role=current_user.role.value,
        from_status=old_status,
        to_status=contract.status.value,
        details=f"{current_user.role.value} signed",
    )
    await db.commit()

    if contract.client_signed and contract.freelancer_signed:
        needs_on_chain = False
        if contract.on_chain_id is not None:
            try:
                await asyncio.to_thread(get_contract_state, int(contract.on_chain_id))
            except Exception:
                contract.on_chain_id = None
                needs_on_chain = True
        else:
            needs_on_chain = True

        if needs_on_chain:
            freelancer = await db.get(User, contract.freelancer_id)
            client = await db.get(User, contract.client_id)
            ms_result = await db.execute(
                select(ContractMilestone)
                .where(ContractMilestone.contract_id == contract_id)
                .order_by(ContractMilestone.index)
            )
            milestones = ms_result.scalars().all()
            if freelancer and freelancer.wallet_address and milestones:
                on_chain = await asyncio.to_thread(
                    create_contract_on_chain,
                    freelancer_address=freelancer.wallet_address,
                    title=contract.title or "",
                    terms_cid=contract.terms_cid,
                    total_amount_wei=to_wei(float(contract.total_amount)),
                    deadline=int(contract.deadline.timestamp()) if contract.deadline else 0,
                    milestone_descs=[m.description for m in milestones],
                    milestone_amounts=[to_wei(float(m.amount)) for m in milestones],
                    client_address=client.wallet_address if client else None,
                )
                if on_chain.get("on_chain_id") is not None:
                    contract.on_chain_id = int(on_chain["on_chain_id"])
                contract.contract_address = on_chain.get("contract_address")
                contract.status = ContractStatus.pending_funding
                await db.commit()

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


@router.post("/{contract_id}/fund", response_model=ContractDetail)
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

    old_result = await db.execute(select(Contract).where(Contract.id == contract_id))
    old_contract = old_result.scalar_one_or_none()
    old_status = old_contract.status.value if old_contract else None

    try:
        contract = await do_fund_contract(db=db, contract_id=contract_id, user_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "FUND_ERROR", "message": str(exc)},
        ) from exc

    await log_transition(
        db=db,
        entity_type="contract",
        entity_id=contract_id,
        action="fund",
        actor_id=current_user.id,
        actor_role=current_user.role.value,
        from_status=old_status,
        to_status=contract.status.value,
    )
    await db.commit()

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

