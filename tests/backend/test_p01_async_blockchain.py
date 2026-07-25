import unittest
import os
import sys
import json
import time

# Add backend directory to path so app can be imported
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))

from app.config import settings
# Override credentials for local testing
settings.client_private_key = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
settings.freelancer_private_key = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"

from app.services.blockchain_service import (
    get_web3,
    get_contract,
    get_contract_state,
    get_milestone_state,
    get_eth_balance,
    create_contract_on_chain,
    fund_contract_on_chain,
    submit_milestone_on_chain,
    approve_milestone_on_chain,
    reject_milestone_on_chain,
    raise_dispute_on_chain,
    resolve_dispute_on_chain,
)

class TestAsyncBlockchainService(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.w3 = get_web3()
        if not cls.w3.is_connected():
            raise ConnectionError("Hardhat node not running or not accessible at " + settings.rpc_url)

        # Deploy a fresh GigEscrow contract for testing
        cls.deployer_private_key = settings.client_private_key
        cls.deployer_acct = cls.w3.eth.account.from_key(cls.deployer_private_key)

        abi_path = os.path.abspath(os.path.join(
            os.path.dirname(__file__), "..", "..", "backend", "app", "contracts", "GigEscrow.json"
        ))

        with open(abi_path) as f:
            contract_json = json.load(f)
            abi = contract_json.get("abi", contract_json)
            bytecode = contract_json.get("bytecode", "")
            if isinstance(bytecode, dict):
                bytecode = bytecode.get("object", "")

        cls.abi = abi
        cls.bytecode = bytecode

        # Deploy
        ContractFactory = cls.w3.eth.contract(abi=abi, bytecode=bytecode)
        nonce = cls.w3.eth.get_transaction_count(cls.deployer_acct.address)
        tx = ContractFactory.constructor().build_transaction({
            "from": cls.deployer_acct.address,
            "nonce": nonce,
            "gasPrice": cls.w3.eth.gas_price,
        })
        signed = cls.w3.eth.account.sign_transaction(tx, cls.deployer_private_key)
        tx_hash = cls.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = cls.w3.eth.wait_for_transaction_receipt(tx_hash)

        cls.contract_address = receipt.contractAddress
        settings.contract_address = cls.contract_address

        # Target addresses for test
        cls.client_addr = cls.deployer_acct.address
        cls.freelancer_acct = cls.w3.eth.account.from_key(settings.freelancer_private_key)
        cls.freelancer_addr = cls.freelancer_acct.address

    def test_01_connection(self):
        """Test connection to the blockchain node"""
        self.assertTrue(self.w3.is_connected())

    def test_02_contract_load(self):
        """Test contract loading and initialization"""
        contract = get_contract()
        self.assertEqual(contract.address, self.contract_address)

    def test_03_get_eth_balance(self):
        """Test balance retrieval helper"""
        balance = get_eth_balance(self.client_addr)
        self.assertGreater(balance, 0.0)

    def test_04_create_contract(self):
        """Test creating an escrow contract on-chain"""
        title = "Python Test Project"
        terms_cid = "QmTestTerms"
        total_amount = self.w3.to_wei(2.0, "ether")
        deadline = int(time.time()) + 86400
        milestone_descs = ["Milestone 1", "Milestone 2"]
        milestone_amounts = [self.w3.to_wei(0.8, "ether"), self.w3.to_wei(1.2, "ether")]

        res = create_contract_on_chain(
            freelancer_address=self.freelancer_addr,
            title=title,
            terms_cid=terms_cid,
            total_amount_wei=total_amount,
            deadline=deadline,
            milestone_descs=milestone_descs,
            milestone_amounts=milestone_amounts,
            client_private_key=settings.client_private_key
        )

        self.assertIsNotNone(res["on_chain_id"])
        self.assertIsNotNone(res["tx_hash"])
        self.assertEqual(res["contract_address"], self.contract_address)

        # Check state on-chain
        state = get_contract_state(res["on_chain_id"])
        self.assertEqual(state["client"].lower(), self.client_addr.lower())
        self.assertEqual(state["freelancer"].lower(), self.freelancer_addr.lower())
        self.assertEqual(state["title"], title)
        self.assertEqual(state["total_amount"], total_amount)
        self.assertEqual(state["status"], 0) # Created

    def test_05_fund_contract(self):
        """Test funding a contract on-chain"""
        # Create a new contract
        total_amount = self.w3.to_wei(1.0, "ether")
        res = create_contract_on_chain(
            freelancer_address=self.freelancer_addr,
            title="Funding Test",
            terms_cid="QmFund",
            total_amount_wei=total_amount,
            deadline=int(time.time()) + 86400,
            milestone_descs=["MS 1"],
            milestone_amounts=[total_amount],
            client_private_key=settings.client_private_key
        )
        on_chain_id = res["on_chain_id"]

        # Fund
        tx_hash = fund_contract_on_chain(on_chain_id, total_amount, settings.client_private_key)
        self.assertIsNotNone(tx_hash)

        # Check status
        state = get_contract_state(on_chain_id)
        self.assertEqual(state["status"], 1) # InProgress

        # Check milestone status
        m_state = get_milestone_state(on_chain_id, 0)
        self.assertEqual(m_state["status"], 1) # Funded

    def test_06_submit_milestone(self):
        """Test submitting milestone deliverables on-chain"""
        total_amount = self.w3.to_wei(1.0, "ether")
        res = create_contract_on_chain(
            freelancer_address=self.freelancer_addr,
            title="Submission Test",
            terms_cid="QmSubmit",
            total_amount_wei=total_amount,
            deadline=int(time.time()) + 86400,
            milestone_descs=["MS 1"],
            milestone_amounts=[total_amount],
            client_private_key=settings.client_private_key
        )
        on_chain_id = res["on_chain_id"]
        fund_contract_on_chain(on_chain_id, total_amount, settings.client_private_key)

        # Submit
        deliverable_cid = "QmDeliverableHash"
        tx_hash = submit_milestone_on_chain(
            contract_id=on_chain_id,
            milestone_index=0,
            deliverable_cid=deliverable_cid,
            freelancer_private_key=settings.freelancer_private_key
        )
        self.assertIsNotNone(tx_hash)

        m_state = get_milestone_state(on_chain_id, 0)
        self.assertEqual(m_state["status"], 2) # Submitted
        self.assertEqual(m_state["deliverable_cid"], deliverable_cid)

    def test_07_approve_milestone(self):
        """Test milestone approval and payout release on-chain"""
        total_amount = self.w3.to_wei(1.0, "ether")
        res = create_contract_on_chain(
            freelancer_address=self.freelancer_addr,
            title="Approval Test",
            terms_cid="QmApprove",
            total_amount_wei=total_amount,
            deadline=int(time.time()) + 86400,
            milestone_descs=["MS 1"],
            milestone_amounts=[total_amount],
            client_private_key=settings.client_private_key
        )
        on_chain_id = res["on_chain_id"]
        fund_contract_on_chain(on_chain_id, total_amount, settings.client_private_key)
        submit_milestone_on_chain(on_chain_id, 0, "QmHash", settings.freelancer_private_key)

        initial_balance = get_eth_balance(self.freelancer_addr)

        # Approve
        tx_hash = approve_milestone_on_chain(on_chain_id, 0, settings.client_private_key)
        self.assertIsNotNone(tx_hash)

        m_state = get_milestone_state(on_chain_id, 0)
        self.assertEqual(m_state["status"], 3) # Approved

        # Since it was the only milestone, the contract should complete
        state = get_contract_state(on_chain_id)
        self.assertEqual(state["status"], 2) # Completed

        # Check payout (milestone is 1.0 ETH, platform fee 2.5% = 0.025 ETH, payout 0.975 ETH)
        final_balance = get_eth_balance(self.freelancer_addr)
        self.assertAlmostEqual(final_balance - initial_balance, 0.975, places=4)

    def test_08_reject_milestone(self):
        """Test milestone rejection on-chain"""
        total_amount = self.w3.to_wei(1.0, "ether")
        res = create_contract_on_chain(
            freelancer_address=self.freelancer_addr,
            title="Rejection Test",
            terms_cid="QmReject",
            total_amount_wei=total_amount,
            deadline=int(time.time()) + 86400,
            milestone_descs=["MS 1"],
            milestone_amounts=[total_amount],
            client_private_key=settings.client_private_key
        )
        on_chain_id = res["on_chain_id"]
        fund_contract_on_chain(on_chain_id, total_amount, settings.client_private_key)
        submit_milestone_on_chain(on_chain_id, 0, "QmHash", settings.freelancer_private_key)

        # Reject
        tx_hash = reject_milestone_on_chain(on_chain_id, 0, settings.client_private_key)
        self.assertIsNotNone(tx_hash)

        m_state = get_milestone_state(on_chain_id, 0)
        self.assertEqual(m_state["status"], 1) # Funded (reset)
        self.assertEqual(m_state["deliverable_cid"], "")

    def test_09_dispute_and_resolve(self):
        """Test raise and resolve dispute flows on-chain"""
        total_amount = self.w3.to_wei(2.0, "ether")
        res = create_contract_on_chain(
            freelancer_address=self.freelancer_addr,
            title="Dispute Test",
            terms_cid="QmDispute",
            total_amount_wei=total_amount,
            deadline=int(time.time()) + 86400,
            milestone_descs=["MS 1", "MS 2"],
            milestone_amounts=[self.w3.to_wei(1.0, "ether"), self.w3.to_wei(1.0, "ether")],
            client_private_key=settings.client_private_key
        )
        on_chain_id = res["on_chain_id"]
        fund_contract_on_chain(on_chain_id, total_amount, settings.client_private_key)

        # Raise dispute
        tx_hash = raise_dispute_on_chain(on_chain_id, settings.client_private_key)
        self.assertIsNotNone(tx_hash)

        state = get_contract_state(on_chain_id)
        self.assertEqual(state["status"], 4) # Disputed

        # Resolve dispute (refund to client)
        initial_balance = get_eth_balance(self.client_addr)
        tx_hash = resolve_dispute_on_chain(on_chain_id, release_to_freelancer=False, admin_private_key=settings.client_private_key)
        self.assertIsNotNone(tx_hash)

        state = get_contract_state(on_chain_id)
        self.assertEqual(state["status"], 3) # Cancelled (reverted/refunded)

        # Refund check
        final_balance = get_eth_balance(self.client_addr)
        # Note: client is also owner and paid gas, so final balance will be initial + 2.0 ETH minus gas cost
        self.assertGreater(final_balance - initial_balance, 1.95)

if __name__ == "__main__":
    unittest.main()
