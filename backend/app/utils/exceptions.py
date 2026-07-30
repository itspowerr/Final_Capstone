from fastapi import HTTPException, status

from app.utils.error_codes import ErrorCodes


class IPFSError(HTTPException):
    def __init__(self, detail="IPFS operation failed", code=ErrorCodes.IPFS_UPLOAD_FAILED):
        self.code = code
        super().__init__(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)
