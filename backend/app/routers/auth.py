from datetime import datetime, timedelta, timezone
from secrets import token_hex
from collections import defaultdict
import time

from fastapi import APIRouter, Depends, Header, HTTPException, status
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import AdminAccount, User, UserRole
from app.schemas import (
    AdminLoginRequest,
    ErrorResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    TOTPSetupResponse,
    TOTPStatusResponse,
    TOTPValidateRequest,
    TOTPVerifyRequest,
    UserResponse,
)
from app.services.totp_service import (
    create_temp_token,
    generate_backup_codes,
    generate_qr_data_url,
    generate_secret,
    get_totp_uri,
    hash_backup_codes,
    verify_backup_code,
    verify_code,
    verify_temp_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

totp_rate_limit: dict[str, list[float]] = defaultdict(list)
TOTP_MAX_ATTEMPTS = 5
TOTP_RATE_WINDOW = 60


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: str, backup_login: bool = False) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": user_id,
        "exp": expire,
        "type": "access",
        "iat": datetime.now(timezone.utc),
        "jti": token_hex(16),
        "backup_login": backup_login,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    payload = {
        "sub": user_id,
        "exp": expire,
        "type": "refresh",
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except Exception:
        return None


async def get_current_user(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "MISSING_AUTH_HEADER", "message": "Missing authorization header"},
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_AUTH_SCHEME", "message": "Invalid authorization scheme"},
        )

    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Invalid or expired token"},
        )

    user_id: str = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_PAYLOAD", "message": "Invalid token payload"},
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "USER_INACTIVE", "message": "User not found or inactive "},
        )

    return user


@router.post("/register", response_model=TokenResponse)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == request.email.lower()))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "EMAIL_EXISTS", "message": "Email already registered "},
        )

    user = User(
        email=request.email.lower(),
        password_hash=hash_password(request.password),
        auth_method="email",
        username=request.username or request.email.split("@")[0],
        role=UserRole(request.role.lower()),
    )
    db.add(user)
    await db.flush()

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(
            User.email == request.email.lower(),
        )
    )
    user = result.scalar_one_or_none()
    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email or password "},
        )
    if not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "Invalid email or password "},
        )

    if user.totp_enabled and user.totp_secret:
        totp_token = create_temp_token(user.id)
        return TokenResponse(
            access_token="",
            refresh_token="",
            user=UserResponse.model_validate(user),
            requires_totp=True,
            totp_token=totp_token,
        )

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/admin/login", response_model=TokenResponse)
async def admin_login(request: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == request.username))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "Invalid username or password "},
        )
    if not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "Invalid username or password "},
        )
    if user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ADMIN_REQUIRED", "message": "Admin access required "},
        )

    admin_account = await db.execute(select(AdminAccount).where(AdminAccount.user_id == user.id))
    if not admin_account.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ADMIN_ACCOUNT_MISSING", "message": "Admin account not configured "},
        )

    if user.totp_enabled and user.totp_secret:
        totp_token = create_temp_token(user.id)
        return TokenResponse(
            access_token="",
            refresh_token="",
            user=UserResponse.model_validate(user),
            requires_totp=True,
            totp_token=totp_token,
        )

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(request.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_REFRESH", "message": "Invalid refresh token "},
        )

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "USER_NOT_FOUND", "message": "User not found "},
        )

    access_token = create_access_token(user.id)
    new_refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.get("/totp/status", response_model=TOTPStatusResponse)
async def totp_status(current_user: User = Depends(get_current_user)):
    return TOTPStatusResponse(
        enabled=current_user.totp_enabled or False,
        has_secret=bool(current_user.totp_secret),
    )


@router.post("/totp/setup", response_model=TOTPSetupResponse)
async def totp_setup(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "TOTP_ALREADY_ENABLED", "message": "2FA is already enabled. Disable it first to re-setup."},
        )

    secret = generate_secret()
    uri = get_totp_uri(secret, current_user.email or current_user.username)
    qr_code = generate_qr_data_url(uri)
    backup = generate_backup_codes()
    hashed = hash_backup_codes(backup)

    current_user.totp_secret = secret
    current_user.totp_backup_codes = hashed
    await db.commit()

    return TOTPSetupResponse(
        secret=secret,
        qr_code=qr_code,
        backup_codes=backup,
        uri=uri,
    )


@router.post("/totp/verify")
async def totp_verify(
    data: TOTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "NO_TOTP_SECRET", "message": "No TOTP setup in progress. Start setup first."},
        )

    if not verify_code(current_user.totp_secret, data.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_CODE", "message": "Invalid verification code. Check your authenticator app."},
        )

    current_user.totp_enabled = True
    await db.commit()

    return {"status": "enabled", "message": "2FA has been enabled successfully."}


@router.post("/totp/validate")
async def totp_validate(
    data: TOTPValidateRequest,
    db: AsyncSession = Depends(get_db),
):
    user_id = verify_temp_token(data.totp_token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOTP_TOKEN", "message": "Invalid or expired verification session. Please login again."},
        )

    now = time.time()
    rate_key = f"totp_{user_id}"
    totp_rate_limit[rate_key] = [t for t in totp_rate_limit[rate_key] if now - t < TOTP_RATE_WINDOW]
    if len(totp_rate_limit[rate_key]) >= TOTP_MAX_ATTEMPTS:
        oldest = totp_rate_limit[rate_key][0]
        remaining = int(TOTP_RATE_WINDOW - (now - oldest)) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "RATE_LIMITED", "message": f"Too many attempts. Wait {remaining} seconds and try again."},
        )
    totp_rate_limit[rate_key].append(now)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "USER_NOT_FOUND", "message": "User not found."},
        )

    code = data.code.strip()

    code_valid = False
    used_backup_code = False
    if user.totp_secret and verify_code(user.totp_secret, code):
        code_valid = True
    elif user.totp_backup_codes:
        code_valid, remaining = verify_backup_code(code, user.totp_backup_codes)
        if code_valid:
            used_backup_code = True
            user.totp_backup_codes = remaining
            await db.commit()

    if not code_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CODE", "message": "Invalid verification code."},
        )

    totp_rate_limit.pop(rate_key, None)

    access_token = create_access_token(user.id, backup_login=used_backup_code)
    refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
        backup_login=used_backup_code,
    )


@router.post("/totp/disable")
async def totp_disable(
    data: TOTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "TOTP_NOT_ENABLED", "message": "2FA is not enabled."},
        )

    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "NO_TOTP_SECRET", "message": "No TOTP secret found. Contact support."},
        )

    if not verify_code(current_user.totp_secret, data.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_CODE", "message": "Invalid verification code. Check your authenticator app."},
        )

    current_user.totp_enabled = False
    current_user.totp_secret = None
    current_user.totp_backup_codes = []
    await db.commit()

    return {"status": "disabled", "message": "2FA has been disabled successfully."}


@router.post("/totp/reset")
async def totp_reset(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Reset 2FA after logging in with a backup code. No TOTP code required."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "MISSING_AUTH_HEADER", "message": "Missing authorization header"},
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_AUTH_SCHEME", "message": "Invalid authorization scheme"},
        )

    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Invalid or expired token"},
        )

    if not payload.get("backup_login"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "BACKUP_LOGIN_REQUIRED", "message": "2FA reset is only available after logging in with a backup code."},
        )

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "USER_NOT_FOUND", "message": "User not found."},
        )

    if not user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "TOTP_NOT_ENABLED", "message": "2FA is not enabled."},
        )

    user.totp_enabled = False
    user.totp_secret = None
    user.totp_backup_codes = []
    await db.commit()

    return {"status": "disabled", "message": "2FA has been reset. You can now set it up on a new device."}