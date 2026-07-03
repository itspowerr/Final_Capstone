from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Contract, Job, User
from app.routers.auth import get_current_user
from app.schemas import JobCreate, JobDetailResponse, JobResponse, JobUpdate, MilestoneResponse

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[JobResponse])
async def list_jobs(
    status_filter: str = Query(None, alias="status"),
    category: str = Query(None),
    search: str = Query(None),
    client_id: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Job)
    if status_filter:
        query = query.where(Job.status == status_filter)
    if category:
        query = query.where(Job.category == category)
    if client_id:
        query = query.where(Job.client_id == client_id)
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Job.title.ilike(search_term),
                Job.description.ilike(search_term),
            )
        )
    query = query.order_by(Job.created_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    job_data: JobCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role.value != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "CLIENT_ONLY", "message": "Only clients can post jobs"},
        )
    job = Job(
        client_id=current_user.id,
        title=job_data.title,
        description=job_data.description,
        budget=job_data.budget,
        category=job_data.category,
        skills=job_data.skills,
        duration_days=job_data.duration_days,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


@router.put("/{job_id}/on-chain-id", response_model=JobResponse)
async def set_on_chain_job_id(
    job_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    on_chain_job_id = body.get("on_chain_job_id")
    if on_chain_job_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "on_chain_job_id is required"},
        )
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "JOB_NOT_FOUND", "message": "Job not found"},
        )
    if job.client_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "NOT_OWNER", "message": "Only the job owner can set on-chain ID"},
        )
    job.on_chain_job_id = on_chain_job_id
    await db.commit()
    await db.refresh(job)
    return job


@router.get("/{job_id}", response_model=JobDetailResponse)
async def get_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "JOB_NOT_FOUND", "message": "Job not found"},
        )
    milestones = []
    contract_id = None
    ct_result = await db.execute(
        select(Contract).options(selectinload(Contract.milestones_rel))
        .where(Contract.job_id == job_id)
        .order_by(Contract.created_at.desc())
        .limit(1)
    )
    contract = ct_result.scalar_one_or_none()
    if contract:
        contract_id = contract.id
        milestones = [MilestoneResponse.model_validate(m) for m in contract.milestones_rel]

    return JobDetailResponse(
        **JobResponse.model_validate(job).model_dump(),
        contract_id=contract_id,
        milestones=milestones,
    )


@router.put("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: str,
    job_data: JobUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "JOB_NOT_FOUND", "message": "Job not found"},
        )
    if job.client_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "NOT_OWNER", "message": "Only the job owner can update"},
        )
    update_data = job_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(job, field, value)
    await db.commit()
    await db.refresh(job)
    return job


@router.delete("/{job_id}")
async def delete_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "JOB_NOT_FOUND", "message": "Job not found"},
        )
    if job.client_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "NOT_ALLOWED", "message": "Not authorized to delete this job"},
        )
    await db.delete(job)
    await db.commit()
    return {"message": "Job deleted"}
