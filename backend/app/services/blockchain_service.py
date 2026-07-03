import json
import logging
import os

from web3 import Web3

from app.config import settings

logger = logging.getLogger("freeledger.blockchain_service")

_web3: Web3 | None = None
_contract: any = None


def get_web3() -> Web3:
    global _web3
    if _web3 is None:
        _web3 = Web3(Web3.HTTPProvider(
            settings.rpc_url,
            request_kwargs={"timeout": settings.blockchain_timeout},
        ))
        if not _web3.is_connected():
            raise ConnectionError(f"Cannot connect to RPC at {settings.rpc_url}")
    return _web3


def get_contract():
    global _contract
    if _contract is None:
        w3 = get_web3()
        if not settings.contract_address:
            raise ValueError("Contract address not configured")

        abi_path = os.path.join(
            os.path.dirname(__file__), "..", "contracts", "GigEscrow.json"
        )
        if not os.path.exists(abi_path):
            raise FileNotFoundError(f"ABI not found at {abi_path}")

        with open(abi_path) as f:
            contract_json = json.load(f)
            abi = contract_json.get("abi", contract_json)

        _contract = w3.eth.contract(address=settings.contract_address, abi=abi)
    return _contract


def get_contract_state(on_chain_id: int) -> dict:
    contract = get_contract()
    details = contract.functions.getContractDetails(on_chain_id).call()
    return {
        "client": details[0],
        "freelancer": details[1],
        "title": details[2],
        "status": details[5],
        "milestone_count": details[6],
        "completed_milestones": details[7],
    }


def get_eth_balance(address: str) -> float:
    w3 = get_web3()
    balance_wei = w3.eth.get_balance(Web3.to_checksum_address(address))
    return float(Web3.from_wei(balance_wei, "ether"))


def to_wei(eth_amount: float) -> int:
    return Web3.to_wei(eth_amount, "ether")


def from_wei(wei_amount: int) -> float:
    return float(Web3.from_wei(wei_amount, "ether"))


def build_contract_tx(fn, address: str, gas: int = 200000, value: int = 0) -> dict:
    w3 = get_web3()
    nonce = w3.eth.get_transaction_count(Web3.to_checksum_address(address))
    gas_price = w3.eth.gas_price
    tx = fn.build_transaction(
        {"from": address, "nonce": nonce, "gas": gas, "gasPrice": gas_price, "value": value}
    )
    return tx


def sign_and_send(tx: dict, private_key: str) -> str:
    w3 = get_web3()
    signed = w3.eth.account.sign_transaction(tx, private_key)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=settings.blockchain_tx_timeout)
    if receipt.status != 1:
        raise RuntimeError("Transaction reverted")
    return receipt.transaction_hash.hex()


def create_contract_on_chain(freelancer_address: str, title: str, terms_cid: str, total_amount_wei: int, deadline: int, milestone_descs: list[str], milestone_amounts: list[int], client_private_key: str | None = None) -> dict:
    w3 = get_web3()
    contract = get_contract()
    pk = client_private_key or settings.client_private_key
    if not pk:
        raise ValueError("Server private key not configured for contract creation")

    if not freelancer_address:
        raise ValueError("Freelancer wallet address is required for on-chain contract creation")

    account = w3.eth.account.from_key(pk)
    freelancer_address = Web3.to_checksum_address(freelancer_address)

    fn = contract.functions.createContract(
        freelancer_address,
        title,
        terms_cid,
        int(total_amount_wei),
        int(deadline),
        milestone_descs,
        milestone_amounts,
    )
    tx = build_contract_tx(fn, account.address)
    tx_hash = sign_and_send(tx, pk)

    on_chain_id = None
    try:
        receipt = w3.eth.get_transaction_receipt(tx_hash)
        logs = contract.events.ContractCreated().process_receipt(receipt)
        if logs:
            on_chain_id = logs[0]["args"]["contractId"]
    except Exception:
        on_chain_id = None

    return {
        "on_chain_id": on_chain_id,
        "tx_hash": tx_hash,
        "contract_address": settings.contract_address,
    }


def fund_contract_on_chain(on_chain_id: int, amount_wei: int, client_private_key: str | None = None) -> str:
    pk = client_private_key or settings.client_private_key
    if not pk:
        raise ValueError("Server private key not configured for contract funding")
    w3 = get_web3()
    contract = get_contract()
    account = w3.eth.account.from_key(pk)
    fn = contract.functions.fundContract(int(on_chain_id))
    tx = build_contract_tx(fn, account.address, value=int(amount_wei))
    return sign_and_send(tx, pk)
