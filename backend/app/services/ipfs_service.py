import json
import os
import tempfile
from typing import BinaryIO

import httpx

from app.config import settings
from app.utils.error_codes import ErrorCodes
from app.utils.exceptions import IPFSError


async def upload_file(file: BinaryIO, filename: str = None) -> dict:
    url = f"{settings.ipfs_api_url}/api/v0/add"
    files = {"file": (filename or "file", file)}
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, files=files)
            response.raise_for_status()
            result = response.json()
            return {
                "cid": result["Hash"],
                "size": result["Size"],
            }
    except httpx.HTTPError as e:
        raise IPFSError(f"Failed to upload to IPFS: {str(e)}", code=ErrorCodes.IPFS_UPLOAD_FAILED)


async def upload_file_bytes(data: bytes, filename: str = None) -> dict:
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as f:
            result = await upload_file(f, filename)
        return result
    finally:
        os.unlink(tmp_path)


async def download_file(cid: str) -> bytes:
    url = f"{settings.ipfs_api_url}/api/v0/cat?arg={cid}"
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url)
            response.raise_for_status()
            return response.content
    except httpx.HTTPError as e:
        raise IPFSError(f"Failed to download from IPFS: {str(e)}", code=ErrorCodes.IPFS_DOWNLOAD_FAILED)


async def pin_file(cid: str) -> bool:
    url = f"{settings.ipfs_api_url}/api/v0/pin/add?arg={cid}"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url)
            response.raise_for_status()
            return True
    except httpx.HTTPError:
        return False


async def file_exists(cid: str) -> bool:
    url = f"{settings.ipfs_api_url}/api/v0/refs?arg={cid}&limit=1"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url)
            return response.status_code == 200
    except httpx.HTTPError:
        return False


async def upload_contract_terms(contract_data: dict) -> dict:
    data_bytes = json.dumps(contract_data, indent=2, default=str).encode("utf-8")
    return await upload_file_bytes(data_bytes, filename="contract_terms.json")
