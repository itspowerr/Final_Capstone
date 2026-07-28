"""
wallet_auth.py — Sarun's MetaMask Wallet Authentication

This module handles Sign-In with Ethereum (SIWE) flow:
  1. GET  /auth/wallet/challenge — Generate nonce, store in Redis (5-min TTL)
  2. GET  /auth/wallet/status   — Check if wallet address has an existing user
  3. POST /auth/wallet/login    — Verify ECDSA signature, create/login user, return JWT

Key Security Properties:
  - User's private key NEVER leaves MetaMask
  - Nonce prevents replay attacks (single-use + 5-min expiry)
  - Signature verification uses eth_account.Account.recover_message()
  - JWT tokens same format as email/password auth

Reference: anushree-fix SIWE implementation
"""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import AuthMethod, User, UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter(tags=["wallet_auth"])


async def _get_redis(request: Request):
    """Helper to get Redis client."""
    from app.redis_client import get_redis
    return await get_redis()


@router.get("/auth/wallet/challenge")
async def wallet_challenge(
    request: Request,
    address: str = Query(..., description="Ethereum wallet address (0x...)"),
):
    """
    Generate a random nonce for wallet authentication.

    Steps:
      1. Generate cryptographically secure random hex string (32 bytes → 64 hex chars)
      2. Store in Redis as 'nonce:<address>' with 300-second (5-min) TTL
      3. Return nonce to frontend so MetaMask can prompt user to sign it

    Why Redis? Nonces are ephemeral, need auto-expiry, and must survive server restarts
    (unlike in-memory dict). Redis TTL handles cleanup automatically.

    Security: Nonce ensures each auth request is unique — prevents replay attacks.
    """
    redis = await _get_redis(request)
    nonce = secrets.token_hex(32)
    await redis.set(f"nonce:{address.lower()}", nonce, ex=300)
    return {"nonce": nonce}


@router.get("/auth/wallet/status")
async def wallet_status(
    request: Request,
    address: str = Query(..., description="Ethereum wallet address (0x...)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Check if a wallet address is already linked to a user account.

    Returns:
      - { exists: true, user_id: "...", role: "client"|"freelancer" } if found
      - { exists: false } if not found

    Used by frontend to decide: show role selector (new user) or direct login (existing).
    """
    result = await db.execute(
        select(User).where(User.wallet_address == address.lower())
    )
    users = result.scalars().all()
    if not users:
        return {"exists": False}
    if len(users) == 1:
        return {
            "exists": True,
            "user_id": users[0].id,
            "role": users[0].role.value if users[0].role else None,
        }
    # Multiple accounts with this wallet
    return {
        "exists": True,
        "user_id": users[0].id,
        "role": None,
        "multiple": True,
        "roles": [u.role.value for u in users if u.role],
    }


@router.post("/auth/wallet/login")
async def wallet_login(
    request: Request,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate (or register) a user via MetaMask wallet signature.

    Expected body:
      {
        "address": "0x...",             // Wallet address from MetaMask
        "signature": "0x...",            // Signed nonce from MetaMask personal_sign
        "role": "client"|"freelancer",   // Required for new users
        "email": "user@example.com",     // Optional — link wallet to email (sign-up flow)
        "password": "..."                // Optional — for email-linked wallet accounts
        "username": "..."                // Optional — display name
      }

    Flows:
      A) Pure MetaMask Login (no email):
         - New user → auto-generated username/email, wallet as primary auth
         - Existing user → direct login
      B) Sign Up with Wallet + Email:
         - email + password + role provided
         - Create user with all fields, wallet_address linked
         - auth_method = 'wallet'
      C) Link Wallet to Existing Email Account:
         - email + password provided
         - Verify email/password login first
         - Link wallet_address to existing user
    """
    from eth_account import Account
    from eth_account.messages import encode_defunct

    redis = await _get_redis(request)
    address = body.get("address", "").lower()
    signature = body.get("signature", "")
    role = body.get("role")
    email = body.get("email", "").lower().strip()
    password = body.get("password")
    username = body.get("username")

    # Retrieve and delete nonce (single-use)
    nonce = await redis.get(f"nonce:{address}")
    if not nonce:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "CHALLENGE_EXPIRED",
                "message": "Challenge expired or already used. Request a new one.",
            },
        )
    await redis.delete(f"nonce:{address}")

    # Verify ECDSA signature — recovers the signer's address
    try:
        message = encode_defunct(text=nonce)
        recovered = Account.recover_message(message, signature=signature)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_SIGNATURE",
                "message": "Could not recover signer from signature.",
            },
        )

    if recovered.lower() != address:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "SIGNATURE_MISMATCH",
                "message": "Signature does not match the claimed address.",
            },
        )

    user = None

    # Flow C: If email+password provided, try linking wallet to existing email account
    if email and password:
        result = await db.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()
        if user:
            # Verify password
            if not pwd_context.verify(password, user.password_hash):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail={
                        "code": "INVALID_CREDENTIALS",
                        "message": "Email or password is incorrect.",
                    },
                )
            # Link wallet to existing user
            user.wallet_address = address
            user.auth_method = AuthMethod.wallet
            await db.commit()
            await db.refresh(user)

    # Flow A & B: If no user found by email, check by wallet address
    if not user:
        result = await db.execute(
            select(User).where(User.wallet_address == address)
        )
        existing_wallet_users = result.scalars().all()

        if existing_wallet_users:
            existing_count = len(existing_wallet_users)
            existing_roles = {u.role.value for u in existing_wallet_users}

            # If email provided (signup flow), check if we can add another account
            if email:
                if existing_count >= 2:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail={
                            "code": "WALLET_FULL",
                            "message": "This wallet is already linked to 2 accounts. Disconnect one first.",
                        },
                    )

                if role and role.lower() in existing_roles:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail={
                            "code": "WALLET_ROLE_EXISTS",
                            "message": f"This wallet is already linked to a {role} account.",
                        },
                    )

                if not role or role.lower() not in ("client", "freelancer"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail={
                            "code": "ROLE_REQUIRED",
                            "message": "New users must specify role: 'client' or 'freelancer'.",
                        },
                    )

                # Wallet has 1 account with different role — allow creating second account
                # Fall through to user creation below
            else:
                # Pure MetaMask login (no email) — filter by role if provided
                if role:
                    matched = [u for u in existing_wallet_users if u.role.value == role.lower()]
                    if matched:
                        user = matched[0]
                    else:
                        existing_role = existing_wallet_users[0].role.value
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail={
                                "code": "ROLE_MISMATCH",
                                "message": f"This wallet is registered as a {existing_role}, not a {role}. Please sign in as {existing_role}.",
                            },
                        )
                else:
                    # No role specified
                    if existing_count == 1:
                        user = existing_wallet_users[0]
                    else:
                        # Multiple accounts, no role — need role to disambiguate
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail={
                                "code": "ROLE_REQUIRED",
                                "message": "This wallet has multiple accounts. Please select your role.",
                            },
                        )

    if not user:
        # New user — require role selection
        if not role or role not in ("client", "freelancer"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "ROLE_REQUIRED",
                    "message": "New users must specify role: 'client' or 'freelancer'.",
                },
            )

        # Flow B: Create with email+password if provided
        if email and password:
            user = User(
                username=username or email.split("@")[0],
                email=email,
                password_hash=pwd_context.hash(password),
                auth_method=AuthMethod.wallet,
                wallet_address=address,
                role=UserRole(role),
                is_active=True,
            )
        else:
            # Flow A: Create with auto-generated fields
            user = User(
                username=f"wallet_{address[2:8]}",
                email=f"{address[2:]}@wallet.eth",
                password_hash=pwd_context.hash(secrets.token_hex(16)),
                auth_method=AuthMethod.wallet,
                wallet_address=address,
                role=UserRole(role),
                is_active=True,
            )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    access_token = jwt.encode(
        {
            "sub": user.id,
            "role": user.role.value,
            "exp": datetime.now(timezone.utc)
            + timedelta(minutes=settings.access_token_expire_minutes),
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    refresh_token = jwt.encode(
        {
            "sub": user.id,
            "type": "refresh",
            "exp": datetime.now(timezone.utc)
            + timedelta(days=settings.refresh_token_expire_days),
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role.value,
            "wallet_address": user.wallet_address,
            "auth_method": user.auth_method.value,
        },
    }
