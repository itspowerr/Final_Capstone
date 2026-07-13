from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import AdminAccount, AuditLog, Contract, ContractMilestone, Dispute, DisputeStatus, Job, Proposal, User
from app.routers.auth import get_current_user, hash_password
from app.schemas import (
    AdminContractCreate,
    AdminJobCreate,
    AdminProposalCreate,
    AdminUserCreate,
    AuditLogResponse,
    ContractDisputeInfo,
    ContractResponse,
    DisputeResponse,
    JobResponse,
    MilestoneDisputeInfo,
    ProposalResponse,
    UserResponse,
)

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


@router.get("/dashboard", response_model=dict)
async def admin_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    user_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
    active_users = (await db.execute(select(func.count(User.id)).where(User.is_active == True))).scalar() or 0
    job_count = (await db.execute(select(func.count(Job.id)))).scalar() or 0
    open_jobs = (await db.execute(select(func.count(Job.id)).where(Job.status == "open"))).scalar() or 0
    contract_count = (await db.execute(select(func.count(Contract.id)))).scalar() or 0
    active_contracts = (await db.execute(select(func.count(Contract.id)).where(Contract.status == "active"))).scalar() or 0
    dispute_count = (await db.execute(select(func.count(Dispute.id)))).scalar() or 0
    active_disputes = (await db.execute(select(func.count(Dispute.id)).where(Dispute.status != "resolved"))).scalar() or 0

    total_volume = (await db.execute(select(func.coalesce(func.sum(Contract.total_amount), 0)))).scalar() or 0.0
    platform_fees = total_volume * 0.025

    admin_count = (await db.execute(select(func.count(User.id)).where(User.role == "admin"))).scalar() or 0
    client_count = (await db.execute(select(func.count(User.id)).where(User.role == "client"))).scalar() or 0
    freelancer_count = (await db.execute(select(func.count(User.id)).where(User.role == "freelancer"))).scalar() or 0

    recent = await db.execute(
        select(User).order_by(User.created_at.desc()).limit(5)
    )
    recent_users = [UserResponse.model_validate(u) for u in recent.scalars().all()]

    return {
        "total_users": user_count,
        "active_users": active_users,
        "total_jobs": job_count,
        "open_jobs": open_jobs,
        "total_contracts": contract_count,
        "active_contracts": active_contracts,
        "total_disputes": dispute_count,
        "active_disputes": active_disputes,
        "total_volume_eth": round(total_volume, 4),
        "platform_fees_accumulated": round(platform_fees, 4),
        "role_counts": {
            "admin": admin_count,
            "client": client_count,
            "freelancer": freelancer_count,
        },
        "recent_users": [{"id": u.id, "username": u.username, "email": u.email, "role": u.role, "joined": u.created_at.isoformat() if u.created_at else None} for u in recent_users],
    }


@router.get("/users", response_model=dict)
async def admin_list_users(
    search: str = Query(None),
    role: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    query = select(User).where(User.role != "admin")
    if search:
        q = f"%{search}%"
        query = query.where(
            or_(User.username.ilike(q), User.email.ilike(q))
        )
    if role:
        query = query.where(User.role == role)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    query = query.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    return {
        "users": [UserResponse.model_validate(u) for u in users],
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit) if total else 1,
    }


@router.put("/users/{user_id}", response_model=UserResponse)
async def admin_update_user(
    user_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    allowed_fields = {"username", "email", "role", "is_active", "headline", "hourly_rate", "bio", "skills", "experience_level"}
    for key, value in data.items():
        if key in allowed_fields:
            setattr(user, key, value)

    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_user(
    data: AdminUserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    if data.role == "admin":
        raise HTTPException(status_code=403, detail="Cannot create admin users")

    existing = await db.execute(select(User).where(User.email == data.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already exists")

    user = User(
        username=data.username,
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        role=data.role.lower(),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()


@router.get("/jobs", response_model=dict)
async def admin_list_jobs(
    search: str = Query(None),
    status: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    query = select(Job).options(selectinload(Job.client))
    if search:
        q = f"%{search}%"
        query = query.where(or_(Job.title.ilike(q)))
    if status:
        query = query.where(Job.status == status)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    query = query.order_by(Job.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    jobs = result.scalars().all()

    enriched = []
    for j in jobs:
        jd = JobResponse.model_validate(j).model_dump()
        if j.client:
            jd["client_name"] = j.client.username or j.client.email
        enriched.append(jd)

    return {
        "jobs": enriched,
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit) if total else 1,
    }


@router.put("/jobs/{job_id}", response_model=JobResponse)
async def admin_update_job(
    job_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    allowed_fields = {"title", "description", "budget", "category", "skills", "status"}
    for key, value in data.items():
        if key in allowed_fields:
            setattr(job, key, value)

    await db.commit()
    await db.refresh(job)
    return JobResponse.model_validate(job)


@router.post("/jobs", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_job(
    data: AdminJobCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    client = await db.execute(select(User).where(User.id == data.client_id))
    if not client.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Client not found")

    job = Job(
        client_id=data.client_id,
        title=data.title,
        description=data.description,
        budget=data.budget,
        category=data.category,
        skills=data.skills,
        duration_days=data.duration_days,
        status=data.status,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return JobResponse.model_validate(job)


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    await db.execute(delete(Job).where(Job.id == job_id))
    await db.commit()


@router.get("/proposals", response_model=dict)
async def admin_list_proposals(
    search: str = Query(None),
    status: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    query = select(Proposal).options(selectinload(Proposal.job), selectinload(Proposal.freelancer))
    if search:
        q = f"%{search}%"
        query = query.where(or_(Proposal.cover_letter.ilike(q)))
    if status:
        query = query.where(Proposal.status == status)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    query = query.order_by(Proposal.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    proposals = result.scalars().all()

    enriched = []
    for p in proposals:
        pd = ProposalResponse.model_validate(p).model_dump()
        if p.job:
            pd["job_title"] = p.job.title
        if p.freelancer:
            pd["freelancer_name"] = p.freelancer.username or p.freelancer.email
        enriched.append(pd)

    return {
        "proposals": enriched,
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit) if total else 1,
    }


@router.put("/proposals/{proposal_id}", response_model=ProposalResponse)
async def admin_update_proposal(
    proposal_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    result = await db.execute(select(Proposal).where(Proposal.id == proposal_id))
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    allowed_fields = {"bid_amount", "cover_letter", "status"}
    for key, value in data.items():
        if key in allowed_fields:
            setattr(proposal, key, value)

    await db.commit()
    await db.refresh(proposal)
    return ProposalResponse.model_validate(proposal)


@router.post("/proposals", response_model=ProposalResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_proposal(
    data: AdminProposalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    job = await db.execute(select(Job).where(Job.id == data.job_id))
    if not job.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Job not found")
    freelancer = await db.execute(select(User).where(User.id == data.freelancer_id))
    if not freelancer.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Freelancer not found")

    existing = await db.execute(
        select(Proposal).where(
            Proposal.job_id == data.job_id,
            Proposal.freelancer_id == data.freelancer_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Proposal already exists for this job and freelancer")

    proposal = Proposal(
        job_id=data.job_id,
        freelancer_id=data.freelancer_id,
        bid_amount=data.bid_amount,
        cover_letter=data.cover_letter,
        estimated_days=data.estimated_days,
        status=data.status,
    )
    db.add(proposal)
    await db.commit()
    await db.refresh(proposal)
    return ProposalResponse.model_validate(proposal)


@router.delete("/proposals/{proposal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_proposal(
    proposal_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    result = await db.execute(select(Proposal).where(Proposal.id == proposal_id))
    proposal = result.scalar_one_or_none()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    await db.execute(delete(Proposal).where(Proposal.id == proposal_id))
    await db.commit()


@router.get("/contracts", response_model=dict)
async def admin_list_contracts(
    search: str = Query(None),
    status: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    query = select(Contract)
    if search:
        q = f"%{search}%"
        query = query.where(or_(Contract.title.ilike(q)))
    if status:
        query = query.where(Contract.status == status)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    query = query.order_by(Contract.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    contracts = result.scalars().all()

    enriched = []
    for c in contracts:
        cd = {
            "id": c.id,
            "title": c.title,
            "total_amount": c.total_amount,
            "status": c.status.value if c.status else None,
            "on_chain_id": c.on_chain_id,
            "client_id": c.client_id,
            "freelancer_id": c.freelancer_id,
            "client_signed": c.client_signed,
            "freelancer_signed": c.freelancer_signed,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        enriched.append(cd)

    return {
        "contracts": enriched,
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit) if total else 1,
    }


@router.put("/contracts/{contract_id}", response_model=dict)
async def admin_update_contract(
    contract_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    allowed_fields = {"title", "total_amount", "status"}
    for key, value in data.items():
        if key in allowed_fields:
            if key == "status":
                from app.models import ContractStatus
                value = ContractStatus(value)
            setattr(contract, key, value)

    await db.commit()
    await db.refresh(contract)
    return {
        "id": contract.id,
        "title": contract.title,
        "status": contract.status.value if contract.status else None,
    }


@router.post("/contracts", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_contract(
    data: AdminContractCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    client = await db.execute(select(User).where(User.id == data.client_id))
    if not client.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Client not found")
    freelancer = await db.execute(select(User).where(User.id == data.freelancer_id))
    if not freelancer.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Freelancer not found")
    job = await db.execute(select(Job).where(Job.id == data.job_id))
    if not job.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Job not found")

    from app.models import ContractStatus
    contract = Contract(
        job_id=data.job_id,
        client_id=data.client_id,
        freelancer_id=data.freelancer_id,
        title=data.title,
        description=data.description,
        total_amount=data.total_amount,
        deadline=data.deadline,
        status=ContractStatus(data.status),
    )
    db.add(contract)
    await db.commit()
    await db.refresh(contract)
    return ContractResponse.model_validate(contract)


@router.delete("/contracts/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_contract(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    await db.execute(delete(Contract).where(Contract.id == contract_id))
    await db.commit()


@router.get("/disputes", response_model=dict)
async def admin_list_disputes(
    status_filter: str = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    query = select(Dispute).options(
        selectinload(Dispute.contract).selectinload(Contract.milestones_rel)
    )
    if status_filter:
        query = query.where(Dispute.status == status_filter)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()

    query = query.order_by(Dispute.created_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    disputes = result.scalars().unique().all()

    enriched = []
    for d in disputes:
        resp = DisputeResponse.model_validate(d)
        if d.contract:
            resp.contract_detail = ContractDisputeInfo.model_validate(d.contract)
            resp.milestones = [MilestoneDisputeInfo.model_validate(m) for m in d.contract.milestones_rel]
        enriched.append(resp)

    return {
        "disputes": enriched,
        "total": total or 0,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit) if total else 1,
    }


@router.delete("/disputes/{dispute_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_dispute(
    dispute_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _require_admin(current_user, db)

    result = await db.execute(select(Dispute).where(Dispute.id == dispute_id))
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    await db.execute(delete(Dispute).where(Dispute.id == dispute_id))
    await db.commit()


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
