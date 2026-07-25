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


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    file_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix if file.filename else ""
    dest = UPLOAD_DIR / f"{file_id}{ext}"
    content = await file.read()
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
