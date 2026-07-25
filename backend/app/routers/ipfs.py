import mimetypes
from io import BytesIO

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import StreamingResponse

from app.routers.auth import get_current_user
from app.models import User
from app.schemas import IPFSUploadResponse
from app.services import ipfs_service

router = APIRouter(prefix="/ipfs", tags=["ipfs"])


@router.post("/upload", response_model=IPFSUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    contents = await file.read()
    result = await ipfs_service.upload_file_bytes(contents, file.filename)
    await ipfs_service.pin_file(result["cid"])
    mime_type = mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    return IPFSUploadResponse(
        cid=result["cid"],
        size=result["size"],
        mime_type=mime_type,
    )


@router.get("/download/{cid}")
async def download_file(cid: str):
    data = await ipfs_service.download_file(cid)
    return StreamingResponse(
        BytesIO(data),
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{cid}"',
            "Content-Length": str(len(data)),
        },
    )
