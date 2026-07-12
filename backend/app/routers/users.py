from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import cast, func, or_, select, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.routers.auth import get_current_user
from app.schemas import UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
async def update_my_profile(
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        return UserResponse.model_validate(current_user)

    if "wallet_address" in update_data:
        addr = update_data["wallet_address"]
        if addr:
            existing = await db.execute(
                select(User).where(
                    User.wallet_address == addr,
                    User.id != current_user.id,
                )
            )
            if existing.scalar_one_or_none():
                del update_data["wallet_address"]

    for field, value in update_data.items():
        setattr(current_user, field, value)

    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.get("/lookup", response_model=UserResponse)
async def lookup_user(
    email: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "USER_NOT_FOUND", "message": "User not found"},
        )
    return UserResponse.model_validate(user)


@router.get("", response_model=dict)
async def list_users(
    search: str = Query(None),
    skills: str = Query(None),
    ids: str = Query(None),
    role: str = Query("freelancer"),
    experience_level: str = Query(None),
    is_available: bool = Query(None),
    min_rate: float = Query(None),
    max_rate: float = Query(None),
    min_rating: float = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(User)
    if ids:
        id_list = [id.strip() for id in ids.split(",") if id.strip()]
        query = query.where(User.id.in_(id_list))
    else:
        query = query.where(User.role == role)

    if search:
        q = f"%{search}%"
        query = query.where(
            or_(User.username.ilike(q), User.email.ilike(q), User.headline.ilike(q), User.bio.ilike(q))
        )

    if skills:
        skill_list = [s.strip() for s in skills.split(",") if s.strip()]
        for sk in skill_list:
            query = query.where(cast(User.skills, String).ilike(f"%{sk}%"))

    if experience_level:
        query = query.where(User.experience_level == experience_level)

    if is_available is not None:
        query = query.where(User.is_available == is_available)

    if min_rate is not None:
        query = query.where(User.hourly_rate >= min_rate)

    if max_rate is not None:
        query = query.where(User.hourly_rate <= max_rate)

    if min_rating is not None:
        query = query.where(User.rating >= min_rating)

    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar()

    query = query.offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()

    return {
        "users": [UserResponse.model_validate(u) for u in users],
        "total": total or 0,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit) if total else 1,
    }
