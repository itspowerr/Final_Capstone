import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Contract, ContractStatus, MilestoneStatus
from app.services.blockchain_service import get_contract_state

logger = logging.getLogger("freeledger.contract_service")


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
        if contract.on_chain_id is not None:
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

    if contract.status not in (ContractStatus.pending_funding, ContractStatus.active):
        raise ValueError("Contract is not awaiting funding")

    if contract.on_chain_id is None:
        raise ValueError("Contract has no on-chain binding")

    on_chain_id = int(contract.on_chain_id)

    try:
        on_chain_state = await asyncio.to_thread(get_contract_state, on_chain_id)
        on_chain_status = on_chain_state.get("status")
    except Exception as e:
        raise ValueError(f"Could not verify on-chain contract: {e}")

    if on_chain_status == 0:
        raise ValueError(
            "Contract not yet funded — use MetaMask to complete the funding transaction first"
        )
    elif on_chain_status != 1:
        raise ValueError(
            f"On-chain contract is in state {on_chain_status} — cannot fund"
        )

    contract.status = ContractStatus.active
    for ms in contract.milestones:
        ms.status = MilestoneStatus.in_progress
    await db.commit()
    await db.refresh(contract)
    return contract
