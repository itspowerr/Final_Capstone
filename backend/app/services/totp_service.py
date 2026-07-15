import base64
import io
import secrets
import string

import pyotp
import qrcode
import qrcode.image.svg


ISSUER = "FreeLedger"
BACKUP_CODES_COUNT = 8
BACKUP_CODE_LENGTH = 8


def generate_secret() -> str:
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str) -> str:
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=ISSUER)


def generate_qr_data_url(uri: str) -> str:
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=6, border=2)
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{b64}"


def verify_code(secret: str, code: str, valid_window: int = 1) -> bool:
    if not secret or not code:
        return False
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=valid_window)


def generate_backup_codes() -> list[str]:
    codes = []
    for _ in range(BACKUP_CODES_COUNT):
        alphabet = string.ascii_uppercase + string.digits
        code = ''.join(secrets.choice(alphabet) for _ in range(BACKUP_CODE_LENGTH))
        formatted = f"{code[:4]}-{code[4:]}"
        codes.append(formatted)
    return codes


def hash_backup_codes(codes: list[str]) -> list[str]:
    import hashlib
    hashed = []
    for code in codes:
        h = hashlib.sha256(code.encode()).hexdigest()
        hashed.append(h)
    return hashed


def verify_backup_code(code: str, hashed_codes: list[str]) -> tuple[bool, list[str]]:
    import hashlib
    code_upper = code.strip().upper()
    h = hashlib.sha256(code_upper.encode()).hexdigest()
    if h in hashed_codes:
        remaining = [c for c in hashed_codes if c != h]
        return True, remaining
    return False, hashed_codes


def create_temp_token(user_id: str) -> str:
    from datetime import datetime, timedelta, timezone
    from jose import jwt
    from app.config import settings

    expire = datetime.now(timezone.utc) + timedelta(minutes=5)
    payload = {
        "sub": user_id,
        "exp": expire,
        "type": "totp_pending",
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def verify_temp_token(token: str) -> str | None:
    from jose import jwt
    from app.config import settings

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("type") == "totp_pending":
            return payload.get("sub")
    except Exception:
        pass
    return None
