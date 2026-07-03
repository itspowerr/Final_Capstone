from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Contract, ContractStatus, ContractMilestone, MilestoneStatus, User
from app.routers.auth import get_current_user
from app.services.blockchain_service import fund_contract_on_chain


async def sign_contract(db: AsyncSession, contract_id: str, user_id: str) -> Contract:
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        raise ValueError("Contract not found")

    if contract.client_id == user_id:
        if contract.client_signed:
            raise ValueError("Already signed by client")
        contract.client_signed = True
    elif contract.freelancer_id == user_id:
        if contract.freelancer_signed:
            raise ValueError("Already signed by freelancer")
        contract.freelancer_signed = True
    else:
        raise ValueError("Not a party to this contract")

    if contract.client_signed and contract.freelancer_signed:
        if contract.status in (ContractStatus.pending_signatures, ContractStatus.pending_funding):
            contract.status = ContractStatus.pending_funding

    await db.commit()
    await db.refresh(contract)
    return contract


async def fund_contract(db: AsyncSession, contract_id: str, user_id: str) -> Contract:
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = result.scalar_one_or_none()
    if not contract:
        raise ValueError("Contract not found")

    if contract.client_id != user_id:
        raise ValueError("Only the client can fund the contract")

    if contract.status != ContractStatus.pending_funding:
        raise ValueError("Contract is not awaiting funding")

    if contract.on_chain_id is None:
        raise ValueError("Contract has no on-chain binding")

    if not settings.client_private_key:
        raise ValueError("No private key configured for on-chain funding")

    await fund_contract_on_chain(
        on_chain_id=int(contract.on_chain_id),
        amount_wei=to_wei(float(contract.total_amount)),
        client_private_key=settings.client_private_key,
    )

    contract.status = ContractStatus.active
    await db.commit()
    await db.refresh(contract)
    return contract
