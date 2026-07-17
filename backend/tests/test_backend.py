"""
Backend Test Suite — 11 Test Cases
TC-AUTH-01, TC-AUTH-02, TC-CON-01, TC-CON-02,
TC-MS-01, TC-MS-02, TC-PAY-01, TC-PAY-02, TC-DISP-01, TC-DISP-02, TC-PERF-01
"""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from tests.conftest import auth
from app.models import ContractMilestone, Contract, MilestoneStatus, Dispute, DisputeStatus, ContractStatus


# ===================================================================
# TC-AUTH-01 — Successful Nonce Generation and Verification
# ===================================================================

class TestTC_AUTH_01:
    @pytest.mark.asyncio
    async def test_nonce_generation_and_wallet_login(self, tc, mock_redis_for_wallet):
        address = tc["client"].wallet_address
        mock_redis, store = mock_redis_for_wallet
        http = tc["http"]

        with patch("app.routers.wallet_auth._get_redis", return_value=mock_redis):
            resp = await http.get(f"/api/auth/wallet/challenge?address={address}")
            assert resp.status_code == 200
            nonce = resp.json()["nonce"]
            assert len(nonce) == 64
            assert f"nonce:{address.lower()}" in store

            with patch("eth_account.Account") as MockAccount:
                MockAccount.recover_message = MagicMock(return_value=address)
                resp = await http.post("/api/auth/wallet/login", json={
                    "address": address, "signature": "0x" + "ab" * 65, "role": "client",
                })
                assert resp.status_code == 200
                data = resp.json()
                assert "access_token" in data
                assert data["user"]["id"] == tc["client"].id
                assert f"nonce:{address.lower()}" not in store

    @pytest.mark.asyncio
    async def test_nonce_unique_per_request(self, tc, mock_redis_for_wallet):
        address = tc["client"].wallet_address
        mock_redis, store = mock_redis_for_wallet
        http = tc["http"]

        with patch("app.routers.wallet_auth._get_redis", return_value=mock_redis):
            r1 = await http.get(f"/api/auth/wallet/challenge?address={address}")
            r2 = await http.get(f"/api/auth/wallet/challenge?address={address}")
            assert r1.json()["nonce"] != r2.json()["nonce"]


# ===================================================================
# TC-AUTH-02 — Replay Attack Prevention via Nonce Invalidation
# ===================================================================

class TestTC_AUTH_02:
    @pytest.mark.asyncio
    async def test_rejected_replay_with_used_nonce(self, tc, mock_redis_for_wallet):
        address = tc["client"].wallet_address
        mock_redis, store = mock_redis_for_wallet
        http = tc["http"]

        with patch("app.routers.wallet_auth._get_redis", return_value=mock_redis):
            await http.get(f"/api/auth/wallet/challenge?address={address}")
            with patch("eth_account.Account") as MockAccount:
                MockAccount.recover_message = MagicMock(return_value=address)
                r1 = await http.post("/api/auth/wallet/login", json={
                    "address": address, "signature": "0x" + "ab" * 65, "role": "client",
                })
                assert r1.status_code == 200

            with patch("eth_account.Account") as MockAccount:
                MockAccount.recover_message = MagicMock(return_value=address)
                r2 = await http.post("/api/auth/wallet/login", json={
                    "address": address, "signature": "0x" + "ab" * 65, "role": "client",
                })
                assert r2.status_code == 401
                assert r2.json()["detail"]["code"] == "CHALLENGE_EXPIRED"

    @pytest.mark.asyncio
    async def test_signature_mismatch_rejected(self, tc, mock_redis_for_wallet):
        address = tc["client"].wallet_address
        wrong = "0x0000000000000000000000000000000000000001"
        mock_redis, store = mock_redis_for_wallet
        http = tc["http"]

        with patch("app.routers.wallet_auth._get_redis", return_value=mock_redis):
            await http.get(f"/api/auth/wallet/challenge?address={address}")
            with patch("eth_account.Account") as MockAccount:
                MockAccount.recover_message = MagicMock(return_value=wrong)
                r = await http.post("/api/auth/wallet/login", json={
                    "address": address, "signature": "0x" + "ab" * 65, "role": "client",
                })
                assert r.status_code == 401
                assert r.json()["detail"]["code"] == "SIGNATURE_MISMATCH"


# ===================================================================
# TC-CON-01 — Successful Contract Initialization and IPFS Upload
# ===================================================================

class TestTC_CON_01:
    @pytest.mark.asyncio
    async def test_contract_created_with_ipfs_and_onchain(self, tc):
        http, db = tc["http"], tc["db"]
        mock_ipfs = {"cid": "QmTestHash123", "size": 2048}
        mock_chain = {"on_chain_id": 42, "tx_hash": "0xabcd", "contract_address": "0x5FbDB2315678afecb367f032d93F642f64180aa3"}

        with patch("app.routers.contracts.upload_contract_terms", new_callable=AsyncMock, return_value=mock_ipfs), \
             patch("app.routers.contracts.asyncio.to_thread", new_callable=AsyncMock, return_value=mock_chain), \
             patch("app.routers.contracts.log_transition", new_callable=AsyncMock):
            r = await http.post("/api/contracts", json={
                "job_id": "job_001", "freelancer_id": "usr_freel1",
                "title": "Web3 DApp", "total_amount": 1000.0,
                "milestones": [{"description": "Frontend", "amount": 500.0}, {"description": "Backend", "amount": 500.0}],
            }, headers=auth("usr_client1"))
            assert r.status_code == 201
            d = r.json()
            assert d["title"] == "Web3 DApp"
            assert d["terms_cid"] == "QmTestHash123"
            assert d["on_chain_id"] == 42
            assert d["status"] == "pending_signatures"

    @pytest.mark.asyncio
    async def test_ipfs_failure_falls_back(self, tc):
        http = tc["http"]
        mock_chain = {"on_chain_id": 99, "tx_hash": "0x1234", "contract_address": "0x5FbDB2315678afecb367f032d93F642f64180aa3"}

        with patch("app.routers.contracts.upload_contract_terms", new_callable=AsyncMock, side_effect=Exception("IPFS down")), \
             patch("app.routers.contracts.asyncio.to_thread", new_callable=AsyncMock, return_value=mock_chain), \
             patch("app.routers.contracts.log_transition", new_callable=AsyncMock):
            r = await http.post("/api/contracts", json={
                "job_id": "job_001", "freelancer_id": "usr_freel1",
                "title": "Fallback", "total_amount": 500.0,
                "milestones": [{"description": "Work", "amount": 500.0}],
            }, headers=auth("usr_client1"))
            assert r.status_code == 201
            assert r.json()["terms_cid"].startswith("contract_")

    @pytest.mark.asyncio
    async def test_milestone_sum_mismatch(self, tc):
        r = await tc["http"].post("/api/contracts", json={
            "job_id": "job_001", "freelancer_id": "usr_freel1",
            "title": "Bad", "total_amount": 1000.0,
            "milestones": [{"description": "A", "amount": 300.0}, {"description": "B", "amount": 300.0}],
        }, headers=auth("usr_client1"))
        assert r.status_code == 400
        assert r.json()["detail"]["code"] == "MILESTONE_SUM_MISMATCH"

    @pytest.mark.asyncio
    async def test_non_client_blocked(self, tc):
        r = await tc["http"].post("/api/contracts", json={
            "job_id": "job_001", "title": "Nope", "total_amount": 100.0,
        }, headers=auth("usr_freel1"))
        assert r.status_code == 403
        assert r.json()["detail"]["code"] == "CLIENT_ONLY"


# ===================================================================
# TC-CON-02 — Graceful Handling of IPFS Gateway Timeout
# ===================================================================

class TestTC_CON_02:
    @pytest.mark.asyncio
    async def test_ipfs_timeout_fallback(self, tc):
        import httpx as hx
        mock_chain = {"on_chain_id": 1, "tx_hash": "0x5678", "contract_address": "0x5FbDB2315678afecb367f032d93F642f64180aa3"}

        with patch("app.routers.contracts.upload_contract_terms", new_callable=AsyncMock,
                   side_effect=hx.TimeoutException("timeout")), \
             patch("app.routers.contracts.asyncio.to_thread", new_callable=AsyncMock, return_value=mock_chain), \
             patch("app.routers.contracts.log_transition", new_callable=AsyncMock):
            r = await tc["http"].post("/api/contracts", json={
                "job_id": "job_001", "freelancer_id": "usr_freel1",
                "title": "Timeout Test", "total_amount": 200.0,
                "milestones": [{"description": "Task", "amount": 200.0}],
            }, headers=auth("usr_client1"))
            assert r.status_code == 201
            assert r.json()["terms_cid"].startswith("contract_")

    @pytest.mark.asyncio
    async def test_full_failure_still_persists(self, tc):
        with patch("app.routers.contracts.upload_contract_terms", new_callable=AsyncMock, side_effect=Exception("IPFS")), \
             patch("app.routers.contracts.asyncio.to_thread", new_callable=AsyncMock, side_effect=Exception("Chain")), \
             patch("app.routers.contracts.log_transition", new_callable=AsyncMock):
            r = await tc["http"].post("/api/contracts", json={
                "job_id": "job_001", "freelancer_id": "usr_freel1",
                "title": "Fail All", "total_amount": 100.0,
                "milestones": [{"description": "Task", "amount": 100.0}],
            }, headers=auth("usr_client1"))
            assert r.status_code == 201
            assert r.json()["on_chain_id"] is None


# ===================================================================
# TC-MS-01 — Milestone Deliverable Upload and DB State Transition
# ===================================================================

class TestTC_MS_01:
    @pytest.mark.asyncio
    async def test_freelancer_submits_milestone(self, tc):
        http, db = tc["http"], tc["db"]

        ms = await db.get(ContractMilestone, "ms_000")
        assert ms.status.value == "pending"

        with patch("app.routers.contracts.log_transition", new_callable=AsyncMock), \
             patch("app.routers.contracts.blockchain_service") as mock_bc:
            mock_bc.submit_milestone_on_chain = MagicMock(return_value="0xabc")
            r = await http.post("/api/contracts/ct_001/milestones/0/submit",
                                json={"deliverable_cid": "QmDeliverable123", "submission_notes": "Done!"},
                                headers=auth("usr_freel1"))
            assert r.status_code == 200
            d = r.json()
            assert d["status"] == "submitted"
            assert d["deliverable_cid"] == "QmDeliverable123"
            assert d["submission_notes"] == "Done!"

    @pytest.mark.asyncio
    async def test_submit_without_cid(self, tc):
        with patch("app.routers.contracts.log_transition", new_callable=AsyncMock), \
             patch("app.routers.contracts.blockchain_service") as mock_bc:
            mock_bc.submit_milestone_on_chain = MagicMock(return_value="0xabc")
            r = await tc["http"].post("/api/contracts/ct_001/milestones/0/submit",
                                      json={"submission_notes": "Notes only"},
                                      headers=auth("usr_freel1"))
            assert r.status_code == 200
            assert r.json()["deliverable_cid"] is None


# ===================================================================
# TC-MS-02 — Rejection of Submissions on Already Approved Milestones
# ===================================================================

class TestTC_MS_02:
    @pytest.mark.asyncio
    async def test_cannot_submit_approved(self, tc):
        from app.models import MilestoneStatus
        db, http = tc["db"], tc["http"]
        ms = await db.get(ContractMilestone, "ms_001")
        ms.status = MilestoneStatus.approved
        await db.commit()

        r = await http.post("/api/contracts/ct_001/milestones/1/submit",
                            json={"deliverable_cid": "QmLate"},
                            headers=auth("usr_freel1"))
        assert r.status_code == 400
        assert r.json()["detail"]["code"] == "MILESTONE_NOT_PENDING"

    @pytest.mark.asyncio
    async def test_cannot_submit_already_submitted(self, tc):
        from app.models import MilestoneStatus
        db, http = tc["db"], tc["http"]
        ms = await db.get(ContractMilestone, "ms_000")
        ms.status = MilestoneStatus.submitted
        await db.commit()

        r = await http.post("/api/contracts/ct_001/milestones/0/submit",
                            json={"deliverable_cid": "QmDup"},
                            headers=auth("usr_freel1"))
        assert r.status_code == 400

    @pytest.mark.asyncio
    async def test_non_freelancer_blocked(self, tc):
        r = await tc["http"].post("/api/contracts/ct_001/milestones/0/submit",
                                  json={"deliverable_cid": "QmBad"},
                                  headers=auth("usr_client1"))
        assert r.status_code == 403
        assert r.json()["detail"]["code"] == "FREELANCER_ONLY"


# ===================================================================
# TC-PAY-01 — Successful Escrow Release and DB Paid Transition
# ===================================================================

class TestTC_PAY_01:
    @pytest.mark.asyncio
    async def test_client_approves_milestone(self, tc):
        from app.models import MilestoneStatus
        db, http = tc["db"], tc["http"]
        ms = await db.get(ContractMilestone, "ms_000")
        ms.status = MilestoneStatus.submitted
        await db.commit()

        with patch("app.routers.contracts.log_transition", new_callable=AsyncMock):
            r = await http.post("/api/contracts/ct_001/milestones/0/approve",
                                headers=auth("usr_client1"))
            assert r.status_code == 200
            assert r.json()["status"] == "approved"
            assert r.json()["approved_at"] is not None

    @pytest.mark.asyncio
    async def test_approve_all_completes_contract(self, tc):
        from app.models import MilestoneStatus, ContractStatus
        db, http = tc["db"], tc["http"]
        ms0 = await db.get(ContractMilestone, "ms_000")
        ms1 = await db.get(ContractMilestone, "ms_001")
        ms0.status = MilestoneStatus.submitted
        ms1.status = MilestoneStatus.submitted
        await db.commit()

        with patch("app.routers.contracts.log_transition", new_callable=AsyncMock):
            r1 = await http.post("/api/contracts/ct_001/milestones/0/approve", headers=auth("usr_client1"))
            assert r1.status_code == 200
            r2 = await http.post("/api/contracts/ct_001/milestones/1/approve", headers=auth("usr_client1"))
            assert r2.status_code == 200

            ct = await db.get(Contract, "ct_001")
            assert ct.status == ContractStatus.completed

    @pytest.mark.asyncio
    async def test_approve_pending_fails(self, tc):
        r = await tc["http"].post("/api/contracts/ct_001/milestones/0/approve",
                                  headers=auth("usr_client1"))
        assert r.status_code == 400
        assert r.json()["detail"]["code"] == "MILESTONE_NOT_SUBMITTED"


# ===================================================================
# TC-PAY-02 — RBAC Block on Milestone Approval
# ===================================================================

class TestTC_PAY_02:
    @pytest.mark.asyncio
    async def test_freelancer_cannot_approve(self, tc):
        from app.models import MilestoneStatus
        db = tc["db"]
        ms = await db.get(ContractMilestone, "ms_000")
        ms.status = MilestoneStatus.submitted
        await db.commit()

        r = await tc["http"].post("/api/contracts/ct_001/milestones/0/approve",
                                  headers=auth("usr_freel1"))
        assert r.status_code == 403
        assert r.json()["detail"]["code"] == "CLIENT_ONLY"

    @pytest.mark.asyncio
    async def test_unauthenticated_blocked(self, tc):
        from app.models import MilestoneStatus
        db = tc["db"]
        ms = await db.get(ContractMilestone, "ms_000")
        ms.status = MilestoneStatus.submitted
        await db.commit()

        r = await tc["http"].post("/api/contracts/ct_001/milestones/0/approve")
        assert r.status_code == 401


# ===================================================================
# TC-DISP-01 — Dispute Escalation and Escrow Lockout
# ===================================================================

class TestTC_DISP_01:
    @pytest.mark.asyncio
    async def test_client_raises_dispute(self, tc):
        from app.models import ContractStatus
        http, db = tc["http"], tc["db"]

        with patch("app.routers.disputes.blockchain_service") as mock_bc, \
             patch("app.routers.disputes.log_transition", new_callable=AsyncMock), \
             patch("app.routers.disputes.create_notification", new_callable=AsyncMock):
            mock_bc.raise_dispute_on_chain = MagicMock(return_value="0xdef")
            r = await http.post("/api/contracts/ct_001/disputes",
                                json={"reason": "Unacceptable quality"},
                                headers=auth("usr_client1"))
            assert r.status_code == 201
            d = r.json()
            assert d["status"] == "open"
            assert d["raised_by"] == "usr_client1"

            ct = await db.get(Contract, "ct_001")
            assert ct.status == ContractStatus.disputed

    @pytest.mark.asyncio
    async def test_freelancer_raises_dispute(self, tc):
        with patch("app.routers.disputes.blockchain_service") as mock_bc, \
             patch("app.routers.disputes.log_transition", new_callable=AsyncMock), \
             patch("app.routers.disputes.create_notification", new_callable=AsyncMock):
            mock_bc.raise_dispute_on_chain = MagicMock(return_value="0xdef")
            r = await tc["http"].post("/api/contracts/ct_001/disputes",
                                      json={"reason": "Client ghosting"},
                                      headers=auth("usr_freel1"))
            assert r.status_code == 201

    @pytest.mark.asyncio
    async def test_cannot_dispute_completed(self, tc):
        db = tc["db"]
        ct = await db.get(Contract, "ct_001")
        ct.status = ContractStatus.completed
        await db.commit()

        r = await tc["http"].post("/api/contracts/ct_001/disputes",
                                  json={"reason": "Late"}, headers=auth("usr_client1"))
        assert r.status_code == 400

    @pytest.mark.asyncio
    async def test_duplicate_dispute_blocked(self, tc):
        from app.models import DisputeStatus
        db, http = tc["db"], tc["http"]
        ct = await db.get(Contract, "ct_001")
        ct.status = ContractStatus.active
        await db.flush()
        d = Dispute(contract_id="ct_001", raised_by="usr_client1",
                    reason="Existing", status=DisputeStatus.open)
        db.add(d)
        await db.commit()

        r = await http.post("/api/contracts/ct_001/disputes",
                            json={"reason": "Another"}, headers=auth("usr_client1"))
        assert r.status_code == 400
        assert r.json()["detail"]["code"] == "DISPUTE_EXISTS"


# ===================================================================
# TC-DISP-02 — Admin-Only Dispute Settlement Execution
# ===================================================================

class TestTC_DISP_02:
    @pytest.mark.asyncio
    async def test_admin_resolves_release(self, tc):
        from app.models import DisputeStatus, Dispute
        db, http = tc["db"], tc["http"]
        d = Dispute(contract_id="ct_001", raised_by="usr_client1",
                    reason="Test", status=DisputeStatus.open)
        db.add(d)
        await db.commit()
        await db.refresh(d)

        with patch("app.routers.disputes.create_notification", new_callable=AsyncMock):
            r = await http.post(f"/api/disputes/{d.id}/resolve",
                                json={"release_to_freelancer": True, "resolution_notes": "Client fault"},
                                headers=auth("usr_admin1"))
            assert r.status_code == 200
            data = r.json()
            assert data["status"] == "resolved"
            assert data["decision"] == "release"
            assert data["resolved_by"] == "usr_admin1"

    @pytest.mark.asyncio
    async def test_admin_resolves_refund(self, tc):
        from app.models import DisputeStatus, Dispute
        db, http = tc["db"], tc["http"]
        d = Dispute(contract_id="ct_001", raised_by="usr_freel1",
                    reason="Refund", status=DisputeStatus.open)
        db.add(d)
        await db.commit()
        await db.refresh(d)

        with patch("app.routers.disputes.create_notification", new_callable=AsyncMock):
            r = await http.post(f"/api/disputes/{d.id}/resolve",
                                json={"release_to_freelancer": False, "resolution_notes": "Freelancer fault"},
                                headers=auth("usr_admin1"))
            assert r.status_code == 200
            assert r.json()["decision"] == "refund"

    @pytest.mark.asyncio
    async def test_client_cannot_resolve(self, tc):
        from app.models import DisputeStatus, Dispute
        db = tc["db"]
        d = Dispute(contract_id="ct_001", raised_by="usr_client1",
                    reason="X", status=DisputeStatus.open)
        db.add(d)
        await db.commit()
        await db.refresh(d)

        r = await tc["http"].post(f"/api/disputes/{d.id}/resolve",
                                  json={"release_to_freelancer": True},
                                  headers=auth("usr_client1"))
        assert r.status_code == 403

    @pytest.mark.asyncio
    async def test_freelancer_cannot_resolve(self, tc):
        from app.models import DisputeStatus, Dispute
        db = tc["db"]
        d = Dispute(contract_id="ct_001", raised_by="usr_freel1",
                    reason="Y", status=DisputeStatus.open)
        db.add(d)
        await db.commit()
        await db.refresh(d)

        r = await tc["http"].post(f"/api/disputes/{d.id}/resolve",
                                  json={"release_to_freelancer": True},
                                  headers=auth("usr_freel1"))
        assert r.status_code == 403


# ===================================================================
# TC-PERF-01 — Race Condition Prevention on Concurrent Approvals
# ===================================================================

class TestTC_PERF_01:
    @pytest.mark.asyncio
    async def test_concurrent_approve_only_one_succeeds(self, tc):
        from app.models import MilestoneStatus
        db = tc["db"]
        ms = await db.get(ContractMilestone, "ms_000")
        ms.status = MilestoneStatus.submitted
        await db.commit()

        with patch("app.routers.contracts.log_transition", new_callable=AsyncMock):
            tasks = [
                tc["http"].post("/api/contracts/ct_001/milestones/0/approve",
                                headers=auth("usr_client1"))
                for _ in range(5)
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            statuses = [r.status_code if not isinstance(r, Exception) else "error" for r in results]
            assert statuses.count(200) == 1
            assert statuses.count(400) == 4

    @pytest.mark.asyncio
    async def test_double_approve_rejected(self, tc):
        from app.models import MilestoneStatus
        db, http = tc["db"], tc["http"]
        ms = await db.get(ContractMilestone, "ms_001")
        ms.status = MilestoneStatus.submitted
        await db.commit()

        with patch("app.routers.contracts.log_transition", new_callable=AsyncMock):
            r1 = await http.post("/api/contracts/ct_001/milestones/1/approve",
                                 headers=auth("usr_client1"))
            assert r1.status_code == 200
            r2 = await http.post("/api/contracts/ct_001/milestones/1/approve",
                                 headers=auth("usr_client1"))
            assert r2.status_code == 400
