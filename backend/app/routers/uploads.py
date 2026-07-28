import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse

from app.models import User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/uploads", tags=["uploads"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
    ".pdf", ".doc", ".docx", ".txt", ".md",
    ".zip", ".json",
}


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    ext = Path(file.filename).suffix.lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_FILE_TYPE", "message": f"File type '{ext}' not allowed. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"},
        )

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"code": "FILE_TOO_LARGE", "message": f"File exceeds maximum size of {MAX_UPLOAD_SIZE // (1024*1024)}MB"},
        )

    file_id = str(uuid.uuid4())
    dest = UPLOAD_DIR / f"{file_id}{ext}"
    dest.write_bytes(content)
    return {
        "file_id": file_id,
        "filename": file.filename or f"file{ext}",
        "size": len(content),
    }


@router.get("/{file_id}")
async def serve_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
):
    for f in UPLOAD_DIR.iterdir():
        if f.stem == file_id and f.is_file():
            return FileResponse(f)
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "FILE_NOT_FOUND", "message": "File not found"},
    )
