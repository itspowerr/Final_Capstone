1|# FreeLedger — Sarun's Capstone Project Details
2|
3|**Student:** Sarun Maharjan (0371759)
4|**Supervisor:** Subit Timalsina
5|**Project:** FreeLedger — Decentralized Freelance Protocol
6|**Role:** Project Manager / Contract & Blockchain Developer
7|**Date:** 2026-07-02
8|
9|---
10|
11|## Table of Contents
12|
13|1. [Project Overview](#1-project-overview)
14|2. [What's Completed ✅](#2-whats-completed-)
15|3. [What's Left to Complete ❌](#3-whats-left-to-complete-)
16|4. [MetaMask Authentication — Complete Flow](#4-metamask-authentication--complete-flow)
17|5. [Blockchain Implementation — What's Stored On-Chain vs Off-Chain](#5-blockchain-implementation--whats-stored-on-chain-vs-off-chain)
18|6. [Architecture — Sarun's Scope](#6-architecture--saruns-scope)
19|7. [How to Run the Project](#7-how-to-run-the-project)
20|8. [Using Remix IDE to Inspect the Contract Visually](#8-using-remix-ide-to-inspect-the-contract-visually)
21|9. [File Reference by Layer](#9-file-reference-by-layer)
22|
23|---
24|
25|## 1. Project Overview
26|
27|FreeLedger is a **decentralized freelance escrow platform** that replaces traditional intermediaries (like Upwork/Fiverr) with blockchain-based trust. The core idea:
28|
29|| Centralized Problem | FreeLedger Solution |
30||---------------------|---------------------|
31|| Platform fees 10-20% | 2.5% smart contract fee |
32|| Payment delays 30-60 days | Instant on-chain settlement |
33|| Opaque dispute resolution | Transparent on-chain dispute resolution |
34|| Password-based auth (phishable) | MetaMask wallet signature (cryptographic) |
35|| Single point of failure (servers) | Hybrid — FastAPI + blockchain redundancy |
36|
37|---
38|
39|## 2. What's Completed ✅
40|
41|### 2.1 Smart Contract — GigEscrow.sol ✅
42|**File:** `contracts/contracts/GigEscrow.sol` — **317 lines**
43|
44|A milestone-based escrow contract with:
45|
46|```
47|5 Contract States:     Created → InProgress → Completed / Cancelled / Disputed
48|5 Milestone Sub-States: Pending → Funded → Submitted → Approved / Rejected
49|```
50|
51|**Key Functions:**
52|
53|| Function | Caller | What it does |
54||----------|--------|-------------|
55|| `createContract()` | Anyone (as client) | Creates escrow with freelancer, milestones, terms CID |
56|| `setFreelancer()` | Client | Sets freelancer address after creation |
57|| `fundContract()` | Client (payable) | Locks exact totalAmount ETH, transitions to InProgress |
58|| `submitMilestone()` | Freelancer | Submits deliverable IPFS CID for a milestone |
59|| `approveMilestone()` | Client | Releases payout − 2.5% fee to freelancer, fee to owner |
60|| `rejectMilestone()` | Client | Resets milestone to Funded, clears deliverable |
61|| `raiseDispute()` | Either party / owner | Sets contract to Disputed state |
62|| `resolveDispute()` | Owner only | Release to freelancer OR refund client |
63|| `cancelContract()` | Client | Cancel before funding only |
64|| `getContractDetails()` | Anyone (view) | Read contract state from blockchain |
65|| `getMilestoneDetails()` | Anyone (view) | Read milestone state from blockchain |
66|
67|**Security:** OpenZeppelin `ReentrancyGuard` on all payment functions, `Ownable` for admin control, 4 custom modifiers (`onlyContractParty`, `onlyClient`, `onlyFreelancer`, `contractExistsMod`).
68|
69|**Deployed Address:** `0x5FbDB2315678afecb367f032d93F642f64180aa3` (local Hardhat)
70|
71|### 2.2 Deployment Script ✅
72|**File:** `contracts/scripts/deploy.js` — **50 lines**
73|- Deploys GigEscrow to Hardhat
74|- Writes `CONTRACT_ADDRESS` to `backend/.env` and `frontend/.env`
75|- Copies compiled ABI JSON to `backend/app/contracts/GigEscrow.json`
76|
77|### 2.3 Contract ABI ✅
78|**File:** `backend/app/contracts/GigEscrow.json` (64,468 bytes)
79|- Full ABI needed for Web3.py backend interaction
80|
81|### 2.4 MetaMask Wallet Authentication ✅
82|
83|| File | Lines | Purpose |
84||------|-------|---------|
85|| `frontend/src/services/web3.js` | 121 | MetaMask provider, signer, network switching, contract instance |
86|| `frontend/src/services/auth.js` | 102 | SIWE flow: connectWallet → getChallenge → signMessage → walletLogin |
87|| `frontend/src/services/api.js` | 46 | Axios wrapper + JWT auto-attach + auto-refresh on 401 |
88|| `backend/app/routers/wallet_auth.py` | 281 | 3 endpoints: challenge, status, login |
89|
90|**Endpoints:**
91|- `GET /api/auth/wallet/challenge?address=0x...` — Generate nonce, store in Redis (300s TTL)
92|- `GET /api/auth/wallet/status?address=0x...` — Check if wallet has existing user
93|- `POST /api/auth/wallet/login` — Verify ECDSA signature, create/link user, issue JWT
94|
95|### 2.5 Email/Password Auth ✅
96|**File:** `backend/app/routers/auth.py` — **234 lines**
97|
98|| Endpoint | Method | Purpose |
99||----------|--------|---------|
100|| `/api/auth/register` | POST | Register with email, password, username, role |
101|| `/api/auth/login` | POST | Login with email + password |
102|| `/api/auth/admin/login` | POST | Admin login with username + password |
103|| `/api/auth/refresh` | POST | Rotate refresh token |
104|| `/api/auth/me` | GET | Get current user from JWT |
105|
106|### 2.6 Backend API Routers ✅
107|
108|| Router | File | Lines | What it does |
109||--------|------|-------|-------------|
110|| Jobs | `routers/jobs.py` | 184 | Full CRUD: create list get update delete |
111|| Proposals | `routers/proposals.py` | 145 | Submit proposal, list, accept proposal |
112|| Contracts | `routers/contracts.py` | 258 | Create, list, get detail, milestone approve/reject |
113|| Disputes | `routers/disputes.py` | 84 | Create dispute, list disputes |
114|| Uploads | `routers/uploads.py` | ~30 | File upload endpoint |
115|| Users | `routers/users.py` | ~60 | User profile/update |
116|
117|### 2.7 Backend Infrastructure ✅
118|- `app/models.py` — SQLAlchemy models (users, jobs, proposals, contracts, milestones, disputes, threads, messages, notifications, admin_accounts)
119|- `app/schemas.py` — Pydantic request/response models
120|- `app/config.py` — Settings from `.env` (pydantic-settings)
121|- `app/database.py` — Async SQLAlchemy engine + session
122|- `app/redis_client.py` — Redis async client
123|- `app/utils/error_codes.py` — Structured error code definitions
124|- `app/utils/exceptions.py` — Custom HTTP exceptions
125|
126|### 2.8 Blockchain Service — Partial ⚠️ (72 lines)
127|**File:** `backend/app/services/blockchain_service.py`
128|
129|**Implemented (72 lines):**
130|- `get_web3()` — Creates HTTP provider to Hardhat RPC
131|- `get_contract()` — Loads contract from ABI JSON + address
132|- `get_contract_state(on_chain_id)` — Calls `getContractDetails()` view function
133|- `get_eth_balance(address)` — Queries ETH balance
134|- `to_wei()`, `from_wei()` — Unit conversion helpers
135|
136|**NOT implemented (needs ~292 more lines):**
137|- `create_contract_on_chain()` — Build → sign → send → wait for receipt
138|- `fund_contract_on_chain()` — Same pattern for funding
139|- `submit_milestone_on_chain()` — Submit deliverable CID
140|- `approve_milestone_on_chain()` — Approve + release payment
141|- `reject_milestone_on_chain()` — Reject milestone
142|- `raise_dispute_on_chain()` — Raise dispute
143|- `resolve_dispute_on_chain()` — Resolve dispute (release/refund)
144|
145|### 2.9 Event Listener ✅
146|**File:** `backend/app/services/event_listener.py` — **120 lines**
147|- Async background task polling every 5 seconds
148|- Tracks `ContractCreated` events via `get_logs()`
149|- Syncs `on_chain_job_id` to Job table in PostgreSQL
150|- Redis checkpointing for restart resilience
151|
152|### 2.10 Docker Infrastructure ✅
153|- `docker/docker-compose.yml` — PostgreSQL 15 + Redis 7
154|- `docker/postgres/init.sql` — Schema with 10 tables, 7 enums in `freeledger` schema
155|
156|### 2.11 Network Error Fix — PostProjectModal + ensureCorrectNetwork ✅
157|
158|**Files Modified (2026-07-02):**
159|
160|| File | Lines | Fix |
161||------|-------|-----|
162|| `frontend/src/services/web3.js` | 121 | `ensureCorrectNetwork()` now **throws** when MetaMask rejects the network switch (error code !== 4902). Previously, rejection was silently swallowed — code continued on wrong network, then `contract.createContract()` failed with a cryptic "Network Error" |
163|| `frontend/src/components/shared/PostProjectModal.js` | 334 | Added `console.log('=== POST PROJECT ERROR ===', err)` before the catch handler. Open DevTools (F12) before posting to see the exact error object and determine which step failed |
164|
165|**Bug:** In `web3.js:79-106`, the `catch` block only handled `switchError.code === 4902` (chain not found). Any other error (including `code: 4001` = user rejected) fell through silently. The code continued as if the network was switched, then `createContract()` failed because MetaMask was still on the wrong network. The error propagated through `err.message` as "Network Error" (ethers.js v6 connection failure message), not from `err.response` (which is undefined for ethers errors), making it look like a backend issue when it was actually a MetaMask network mismatch.
166|
167|**Fix:** Added `else { throw switchError; }` so network switch failures propagate to the UI properly.
168|
169|### 2.12 Capstone Report — All 7 Chapters ✅
170|**Location:** `/home/sarun/Desktop/capstone_report/chapters/`
171|
172|| Chapter | File | Status |
173||---------|------|--------|
174|| 1 Introduction | `01_Introduction.md` | Complete |
175|| 2 Literature Review | `02_Literature_Review.md` | Complete |
176|| 3 Methodology | `03_Methodology.md` | Complete |
177|| 4 System Design | `04_System_Design.md` | Complete |
178|| 5 Implementation | `05_Implementation.md` (+ `chapter5_implementation.md`) | Complete |
179|| 6 Testing | `06_Testing.md` (+ `chapter6_system_testing.md`) | Complete |
180|| 7 Conclusion | `07_Conclusion.md` (+ `chapter7_conclusion_critical_evaluation.md`) | Complete |
181|
182|---
183|
184|## 3. What's Left to Complete ❌
185|
186|### Priority 1 (Critical — Must Do for Capstone II)
187|
188|| # | Item | File(s) Needed | Why |
189||---|------|---------------|-----|
190|| 1 | **Blockchain Transaction Functions** | Expand `services/blockchain_service.py` from 72→364 lines | Without these, backend can't actually CREATE or FUND contracts on-chain — it can only read state |
191|| 2 | **Smart Contract Tests** | `contracts/test/GigEscrow.test.js` + `GigEscrowEdgeCases.test.js` | Report claims 70 tests but they don't exist in this directory. Need to bring from Capstonev2 or rewrite |
192|| 3 | **Backend Unit Tests** | `tests/backend/test_p01_async_blockchain.py` | 9 blockchain service tests that verify transaction functions work |
193|
194|### Priority 2 (Important — Completes the System)
195|
196|| # | Item | File(s) Needed |
197||---|------|---------------|
198|| 4 | **Auth Service Layer** | `services/auth_service.py` | Separate crypto logic from router (clean architecture) |
199|| 5 | **Contract Service** | `services/contract_service.py` | Orchestrator: DB + blockchain + IPFS coordination |
200|
201|### Priority 3 (Nice-to-Have / Team Deliverables)
202|
203|| # | Item | File(s) Needed |
204||---|------|---------------|
205|| 6 | Admin Router | `routers/admin.py` |
206|| 7 | Messages Router | `routers/messages.py` |
207|| 8 | Notifications Router | `routers/notifications.py` |
208|| 9 | IPFS Service | `services/ipfs_service.py` |
209|| 10 | WebSocket | `services/websocket/` |
210|
211|---
212|
213|## 4. MetaMask Authentication — Complete Flow
214|
215|### Step-by-Step with Code Paths
216|
217|```
218|┌──────────────────────────────────────────────────────────────────┐
219|│ USER clicks "Connect with MetaMask" button on FreeLedger login   │
220|└────────────────────────────────┬─────────────────────────────────┘
221|                                 │
222|                                 ▼
223|┌──────────────────────────────────────────────────────────────────┐
224|│ 1. auth.js: connectWallet()                                      │
225|│                                                                  │
226|│    function:                                                     │
227|│      if (!window.ethereum) throw "MetaMask not installed"         │
228|│      provider = new BrowserProvider(window.ethereum)              │
229|│      await provider.send('eth_requestAccounts', [])              │
230|│         → MetaMask popup: "Connect this site?"                   │
231|│      signer = await provider.getSigner()                         │
232|│      address = await signer.getAddress()                         │
233|│      return { address: address.toLowerCase() }                   │
234|│                                                                  │
235|│    file: frontend/src/services/auth.js (line 29-44)              │
236|│    file: frontend/src/services/web3.js (line 30-35)              │
237|└──────────────────────────────┬───────────────────────────────────┘
238|                               │
239|                               ▼
240|┌──────────────────────────────────────────────────────────────────┐
241|│ 2. auth.js: checkWalletStatus(address)                           │
242|│                                                                  │
243|│    GET /api/auth/wallet/status?address=0x...                     │
244|│    → wallet_auth.py: wallet_status()                             │
245|│      - SELECT * FROM users WHERE wallet_address = address        │
246|│      - Returns { exists: true/false, user_id?, role? }           │
247|│                                                                  │
248|│    If exists: Show "Sign in" button -> skip role selector        │
249|│    If not: Show role selector (client/freelancer)                │
250|│                                                                  │
251|│    file: frontend/src/services/auth.js (line 97-102)             │
252|│    file: backend/app/routers/wallet_auth.py (line 65-90)         │
253|└──────────────────────────────┬───────────────────────────────────┘
254|                               │
255|                               ▼
256|┌──────────────────────────────────────────────────────────────────┐
257|│ 3. auth.js: getChallenge(address)                                │
258|│                                                                  │
259|│    GET /api/auth/wallet/challenge?address=0x...                  │
260|│    → wallet_auth.py: wallet_challenge()                          │
261|│      - nonce = secrets.token_hex(32)                             │
262|│        → 64-character hex string: "a1b2c3d4..."                 │
263|│      - Redis SETEX nonce:{address} {nonce} EX 300                │
264|│        → expires in 5 minutes                                    │
265|│      - Returns { nonce: "a1b2c3d4..." }                         │
266|│                                                                  │
267|│    file: frontend/src/services/auth.js (line 53-58)              │
268|│    file: backend/app/routers/wallet_auth.py (line 41-62)         │
269|└──────────────────────────────┬───────────────────────────────────┘
270|                               │
271|                               ▼
272|┌──────────────────────────────────────────────────────────────────┐
273|│ 4. auth.js: signMessage(provider, nonce)                        │
274|│                                                                  │
275|│    signer = await provider.getSigner()                           │
276|│    signature = await signer.signMessage(nonce)                   │
277|│      → MetaMask popup: "Sign this message?"                      │
278|│      → User clicks "Sign"                                        │
279|│      → MetaMask calls personal_sign internally:                  │
280|│        1. Hashes message: "\x19Ethereum Signed Message:\n64..."  │
281|│        2. Signs hash with user's private key                     │
282|│        3. Returns {v, r, s} ECDSA signature                     │
283|│      → Returns 0x-prefixed hex signature                        │
284|│                                                                  │
285|│    file: frontend/src/services/auth.js (line 68-71)              │
286|│    file: frontend/src/services/web3.js (line 42-44)              │
287|└──────────────────────────────┬───────────────────────────────────┘
288|                               │
289|                               ▼
290|┌──────────────────────────────────────────────────────────────────┐
291|│ 5. auth.js: walletLogin({ address, signature, role, ... })      │
292|│                                                                  │
293|│    POST /api/auth/wallet/login                                   │
294|│    Body: { address, signature, role?, email?, password? }        │
295|│    → wallet_auth.py: wallet_login()                              │
296|│                                                                  │
297|│    Step A: Get nonce from Redis                                  │
298|│      nonce = redis.get("nonce:{address}")                        │
299|│      redis.delete("nonce:{address}")      // single-use!        │
300|│      if null → "Challenge expired" error                        │
301|│                                                                  │
302|│    Step B: ECDSA Signature Verification                         │
303|│      message = encode_defunct(text=nonce)                       │
304|│        → wraps: "\x19Ethereum Signed Message:\n64{nonce}"      │
305|│      recovered = Account.recover_message(message, signature)     │
306|│        → mathematically recovers signer's public address        │
307|│      if recovered.lower() != address.lower()                    │
308|│        → "Signature mismatch" error                             │
309|│                                                                  │
310|│    Step C: User Resolution (Flow A/B/C)                         │
311|│      Flow A — Pure MetaMask Login:                              │
312|│        No email provided → find/create user by wallet_address   │
313|│        New user: auto-gen username "wallet_{first6chars}"       │
314|│        New user: auto-gen email "{address}@wallet.eth"          │
315|│      Flow B — Sign Up with Wallet + Email:                      │
316|│        email + password + role provided                         │
317|│        Create user with all fields + wallet_address linked      │
318|│      Flow C — Link Wallet to Existing Email Account:            │
319|│        email + password provided → verify credentials           │
320|│        Link wallet_address to existing user                     │
321|│                                                                  │
322|│    Step D: Issue JWT Tokens                                     │
323|│      access_token: { sub: user.id, role, exp: 30min }           │
324|│      refresh_token: { sub: user.id, type: "refresh", exp: 7d } │
325|│      Signed with HS256 using settings.jwt_secret                │
326|│                                                                  │
327|│    Returns: { access_token, refresh_token, user }               │
328|│                                                                  │
329|│    file: backend/app/routers/wallet_auth.py (line 93-281)       │
330|│    file: frontend/src/services/auth.js (line 85-88)             │
331|└──────────────────────────────┬───────────────────────────────────┘
332|                               │
333|                               ▼
334|┌──────────────────────────────────────────────────────────────────┐
335|│ 6. Frontend stores tokens in localStorage                       │
336|│    localStorage.setItem("access_token", token)                   │
337|│    localStorage.setItem("refresh_token", token)                  │
338|│    localStorage.setItem("user", JSON.stringify(user))           │
339|│                                                                  │
340|│ 7. All subsequent API calls via api.js                          │
341|│    api.interceptors.request.use():                               │
342|│      Reads access_token from localStorage                       │
343|│      Attaches: Authorization: Bearer ***                    │
344|│                                                                  │
345|│ 8. Auto-refresh on 401                                          │
346|│    api.interceptors.response.use():                              │
347|│      If 401 response AND not already retried:                   │
348|│        1. POST /api/auth/refresh with refresh_token             │
349|│        2. Store new tokens                                      │
350|│        3. Retry original request                                │
351|│      If refresh fails too → clear all tokens → redirect /login  │
352|│                                                                  │
353|│    file: frontend/src/services/api.js (entire file, 46 lines)   │
354|│    file: backend/app/routers/auth.py: refresh() (line 204-229)  │
355|└──────────────────────────────────────────────────────────────────┘
356|```
357|
358|### Cryptographic Details
359|
360|```
361|ECDSA Signature Verification:
362|
363|  User's Private Key (NEVER leaves MetaMask)
364|           │
365|           ▼
366|  MetaMask signs message "a1b2c3d4..."
367|           │
368|           ▼
369|  Signature = { v: 27, r: 0x..., s: 0x... }
370|           │
371|           ▼  Sent to backend as "0x..." hex string
372|           │
373|  Backend recovers signer address:
374|    message_hash = keccak256("\x19Ethereum Signed Message:\n64a1b2c3d4...")
375|    recovered = ecrecover(message_hash, v, r, s)
376|    recovered == claimed_address? → YES = authenticated
377|
378|  Security properties:
379|    - Private key NEVER transmitted
380|    - Nonce prevents replay attacks (single-use + 300s TTL)
381|    - ECDSA recovery mathematically proves wallet ownership
382|    - No passwords stored (except email-linked accounts)
383|```
384|
385|---
386|
387|## 5. Blockchain Implementation — What's Stored On-Chain vs Off-Chain
388|
389|### Critical Architectural Point: Jobs & Proposals are NOT on Blockchain
390|
391|| Data | Where Stored | Why |
392||------|-------------|-----|
393|| **Jobs** (title, description, budget, skills) | **PostgreSQL only** | Storing text on-chain costs ~$50-500 gas per byte — a single job description could cost $100+ |
394|| **Proposals** (cover letter, bid amount) | **PostgreSQL only** | Same reason — large text is too expensive on-chain |
395|| **Contract Escrow** (amount, status, milestones) | **Blockchain + PostgreSQL** | Funds must be on-chain. Metadata (title, description) stored off-chain for efficiency |
396|| **Disputes** | **PostgreSQL** | Reason text is large; on-chain only tracks the dispute state |
397|
398|The **on-chain contract** only stores: client address, freelancer address, title (string), termsCID (IPFS hash), totalAmount (uint256), deadline (uint256), status (enum 0-4), milestoneCount (uint256), completedMilestones (uint256), and per-milestone: description (string), amount (uint256), deliverableCID (string), status (enum), submittedAt (uint256), approvedAt (uint256).
399|
400|This is the most important architectural concept to understand for your report.
401|
402|### What goes ON the blockchain (immutable, public, costs gas)
403|
404|```
405|┌─────────────────────────────────────────────────────────────┐
406|│                     ETHEREUM BLOCKCHAIN                     │
407|│  (Hardhat local: 0x5FbDB2315678afecb367f032d93F642f64180aa3)│
408|├─────────────────────────────────────────────────────────────┤
409|│                                                             │
410|│  GigEscrow Smart Contract Storage (on-chain state):         │
411|│                                                             │
412|│  EscrowContract {                                           │
413|│    client:        0xf39Fd...        ← wallet address       │
414|│    freelancer:    0x70997...        ← wallet address       │
415|│    title:         "Build React App" ← string               │
416|│    termsCID:      "QmX5..."        ← IPFS hash (small!)   │
417|│    totalAmount:   10.0 ETH         ← locked funds          │
418|│    deadline:      1750000000       ← unix timestamp        │
419|│    status:        InProgress        ← enum (0-4)           │
420|│    milestoneCount: 3                                        │
421|│    completedMilestones: 1                                   │
422|│  }                                                          │
423|│                                                             │
424|│  Milestone[0] {                                             │
425|│    description:   "Setup project"   ← string               │
426|│    amount:        3.0 ETH                                  │
427|│    deliverableCID: "QmY8..."       ← IPFS hash             │
428|│    status:        Approved         ← enum                   │
429|│    submittedAt:   1748300000       ← timestamp              │
430|│    approvedAt:    1748300100       ← timestamp              │
431|│  }                                                          │
432|│                                                             │
433|│  Milestone[1] {                                             │
434|│    amount:        3.5 ETH                                  │
435|│    status:        Submitted                                │
436|│    ...                                                     │
437|│  }                                                          │
438|│                                                             │
439|│  ETH Balance: 7.0 ETH (locked by contract)                 │
440|│  3.0 released to freelancer, 2.5% fee (0.075 ETH)          │
441|│  to owner                                                    │
442|│                                                             │
443|│  Key Properties:                                            │
444|│  ✓ Everyone can verify: "yes, 10 ETH is locked"            │
445|│  ✓ Client can't withdraw early                             │
446|│  ✓ Freelancer can prove milestone approval                 │
447|│  ✓ Dispute resolution is transparent                       │
448|│  ✗ Expensive to store large data (use IPFS)                │
449|│  ✗ Slow (~12s per block on mainnet)                        │
450|└─────────────────────────────────────────────────────────────┘
451|```
452|
453|### What goes OFF the blockchain (PostgreSQL database)
454|
455|```
456|┌─────────────────────────────────────────────────────────────┐
457|│             POSTGRESQL (freeledger schema)                   │
458|│  (localhost:5432, accessed via FastAPI/SQLAlchemy)          │
459|├─────────────────────────────────────────────────────────────┤
460|│                                                             │
461|│  users:                                                     │
462|│    id                  | uuid                               │
463|│    username            | "Sarun"                            │
464|│    email               | "sarun@example.com"                │
465|│    password_hash       | "$2b$12$..." (bcrypt)             │
466|│    wallet_address      | "0x1234..." (nullable)            │
467|│    auth_method         | "email" | "wallet"                 │
468|│    role                | "client" | "freelancer" | "admin"  │
469|│    skills              | ["solidity", "react"]              │
470|│    industries          | ["blockchain", "fintech"]          │
471|│    portfolio_cids      | ["QmPortfolio1"]                   │
472|│  ─────────────────────────────────────────────────────────   │
473|│  jobs:                                                      │
474|│    id                  | uuid                               │
475|│    client_id           | (FK → users)                      │
476|│    title               | "Need React Developer"             │
477|│    description         | long text here...                  │
478|│    budget              | 10.0                               │
479|│    category            | "web development"                  │
480|│    skills              | ["react", "solidity"]              │
481|│    status              | "open" | "in_progress" | "filled"  │
482|│    on_chain_job_id     | 42 (nullable — link to contract)  │
483|│  ─────────────────────────────────────────────────────────   │
484|│  proposals:                                                 │
485|│    id                  | uuid                               │
486|│    job_id              | (FK → jobs)                       │
487|│    freelancer_id       | (FK → users)                      │
488|│    cover_letter        | "I'm experienced..."               │
489|│    bid_amount          | 9.5                                │
490|│    status              | "pending" | "accepted" | "rejected"│
491|│  ─────────────────────────────────────────────────────────   │
492|│  contracts:                                                 │
493|│    id                  | uuid                               │
494|│    job_id              | (FK → jobs)                       │
495|│    client_id           | (FK → users)                      │
496|│    freelancer_id       | (FK → users)                      │
497|│    on_chain_id         | 42 (links to smart contract ID)   │
498|│    contract_address    | "0x..." (deployed address)        │
499|│    total_amount        | 10.0                               │
500|│    status              | "pending" | "active" | ...        │
501|│    client_signed       | true/false                         │
502|│    freelancer_signed   | true/false                         │
503|│  ─────────────────────────────────────────────────────────   │
504|│  contract_milestones:                                       │
505|│    id                  | uuid                               │
506|│    contract_id         | (FK → contracts)                  │
507|│    index               | 2                                  │
508|│    description         | "Setup CI/CD pipeline"             │
509|│    amount              | 3.0                                │
510|│    status              | "pending" | "submitted" | ...     │
511|│    deliverable_cid     | "QmY8..." (nullable)              │
512|│  ─────────────────────────────────────────────────────────   │
513|│  disputes:                                                  │
514|│    id                  | uuid                               │
515|│    contract_id         | (FK → contracts)                  │
516|│    raised_by           | (FK → users)                      │
517|│    reason              | "Deliverable not per spec"         │
518|│    status              | "open" | "resolved"                │
519|│    resolution          | "release" | "refund" (nullable)   │
520|│  ─────────────────────────────────────────────────────────   │
521|│  Key Properties:                                            │
522|│  ✓ Fast read/write (milliseconds)                           │
523|│  ✓ Complex queries (search, filter, paginate)               │
524|│  ✓ Large data (descriptions, terms, cover letters)          │
525|│  ✓ Free to store (no gas costs)                             │
526|│  ✗ Centralized (single point of failure)                    │
527|│  ✗ Trusted third party (you control the data)               │
528|└─────────────────────────────────────────────────────────────┘
529|```
530|
531|### The Bridge: `Contract.on_chain_id`
532|
533|The critical link between off-chain and on-chain:
534|
535|```
536|PostgreSQL (off-chain)           Ethereum (on-chain)
537|═══════════════════════          ═══════════════════
538|contracts table:                 GigEscrow contract:
539|  id = "abc-123"         ───→   contractId = 42
540|  on_chain_id = 42       ←───   (mapping lookup)
541|  contract_address =           contracts[42]
542|    "0x5FbDB..."
543|  status = "active"     ←───   Status.InProgress
544|
545|How it's created:
546|1. Client fills form on website → POST /api/contracts
547|2. Backend stores in PostgreSQL (status: pending_signatures)
548|3. Backend calls create_contract_on_chain() → gets on_chain_id
549|4. Backend updates PostgreSQL: on_chain_id = 42
550|5. Now off-chain record is linked to on-chain contract
551|```
552|
553|### What each operation actually STORES on-chain
554|
555|| Operation | Gas Cost | What gets written to blockchain |
556||-----------|----------|-------------------------------|
557|| `createContract()` | ~500K-2M gas | Client addr, freelancer addr, title, termsCID, totalAmount, deadline, milestone descriptions + amounts |
558|| `fundContract()` | ~50K gas | ETH transfer to contract, status change to InProgress, milestone statuses set to Funded |
559|| `submitMilestone()` | ~50K gas | deliverableCID string, status change to Submitted, submittedAt timestamp |
560|| `approveMilestone()` | ~80K gas | ETH transfer to freelancer (−2.5% fee), ETH transfer to owner, status Approved, approvedAt, completedMilestones++, auto-complete if final |
561|| `rejectMilestone()` | ~30K gas | Clear deliverableCID, reset status to Funded, clear submittedAt |
562|| `raiseDispute()` | ~30K gas | Status change to Disputed |
563|| `resolveDispute()` | ~80K gas | ETH transfer to freelancer OR client, fee to owner, status to Completed or Cancelled |
564|| `cancelContract()` | ~30K gas | Status change to Cancelled (only before funding) |
565|
566|### Example: Complete Lifecycle of a 10 ETH, 3-Milestone Contract
567|
568|```
569|                   On-Chain                                Off-Chain
570|                   --------                                ---------
571|1. Client creates  contractId = 1                         job.id = "job-abc"
572|   contract:       client = 0xf39Fd...                    contract.id = "ctr-abc"
573|                   freelancer = 0x70997...                 on_chain_id = 1
574|                   totalAmount = 10 ETH                    status = pending_signatures
575|                   status = Created
576|                   milestones[0] = Pending, 3 ETH
577|                   milestones[1] = Pending, 3.5 ETH
578|                   milestones[2] = Pending, 3.5 ETH
579|
580|2. Client funds    ETH: -10.0 (to contract)               status = active
581|   contract:       status = InProgress
582|                   milestones[*] = Funded
583|
584|3. Freelancer      deliverableCID = "QmHash1"              milestone[0].status = submitted
585|   submits ms#0    status = Submitted                      deliverable_cid = "QmHash1"
586|
587|4. Client approves  ETH: -3.0 (from contract)              milestone[0].status = approved
588|   ms#0             Freelancer: +2.925 ETH (after 2.5% fee) contract.completedMilestones++
589|                    Owner: +0.075 ETH (fee)
590|                    status = Approved
591|
592|5. Freelancer      deliverableCID = "QmHash2"              milestone[1].status = submitted
593|   submits ms#1    status = Submitted
594|
595|6. Client rejects   deliverableCID = ""                     milestone[1].status = pending (reset)
596|   ms#1             status = Funded (reset)                 deliverable_cid = null
597|                   (no ETH transfer)
598|
599|7. Freelancer      deliverableCID = "QmHash3"              milestone[1].status = submitted
600|   resubmits ms#1  status = Submitted
601|
602|8. Client approves  ETH: -3.5 (from contract)              milestone[1].status = approved
603|   ms#1             Freelancer: +3.4125 ETH
604|                    Owner: +0.0875 ETH
605|
606|9. Freelancer      deliverableCID = "QmHash4"              milestone[2].status = submitted
607|   submits ms#2    status = Submitted
608|
609|10. Client raises   status = Disputed                       contract.status = disputed
610|    dispute                                                  dispute created
611|
612|11. Owner resolves  ETH: -3.5 (remaining balance)          dispute.status = resolved
613|    (release)       Freelancer: +3.4125 ETH                  contract.status = completed
614|                    Owner: +0.0875 ETH
615|                    status = Completed
616|
617|    FINAL STATE:
618|    Contract 1: Completed
619|    Freelancer total: 2.925 + 3.4125 + 3.4125 = 9.75 ETH
620|    Owner total (fees): 0.075 + 0.0875 + 0.0875 = 0.25 ETH = 2.5% of 10 ETH
621|    Client paid: 10 ETH (got work delivered)
622|```
623|
624|---
625|
626|## 6. Architecture — Sarun's Scope
627|
628|### High-Level Architecture
629|
630|```
631|┌─────────────────────────────────────────────────────────────────────┐
632|│                        BROWSER (User)                               │
633|│  ┌────────────────────────────────────────────────────────────────┐ │
634|│  │  React App (localhost:3000)                                    │ │
635|│  │  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐   │ │
636|│  │  │ Login Page │  │ Client Pages │  │ Freelancer Pages     │   │ │
637|│  │  │ Landing    │  │ Dashboard    │  │ Dashboard            │   │ │
638|│  │  │            │  │ Explore Jobs │  │ Find Jobs            │   │ │
639|│  │  │            │  │ My Contracts │  │ My Contracts         │   │ │
640|│  │  │            │  │ Profile      │  │ My Profile           │   │ │
641|│  │  └─────┬──────┘  └──────┬───────┘  └──────────┬───────────┘   │ │
642|│  │        │                │                     │                │ │
643|│  │  ┌─────▼────────────────▼─────────────────────▼────────────┐   │ │
644|│  │  │ Services Layer                                           │   │ │
645|│  │  │  auth.js  web3.js  api.js  contractAbi.js               │   │ │
646|│  │  └─────┬──────────────────────────────────────────┬─────────┘   │ │
647|│  └────────┼──────────────────────────────────────────┼─────────────┘ │
648|└───────────┼──────────────────────────────────────────┼───────────────┘
649|            │ HTTP (axios)                             │ MetaMask
650|            │ localhost:8000/api                       │ EIP-1193
651|            │                                          │
652|┌───────────▼──────────────────────────────────────────────────────────┐
653|│                        BACKEND (FastAPI)                            │
654|│                                                                     │
655|│  ┌─────────────────────────────────────────────────────────────────┐ │
656|│  │ Routers Layer                                                   │ │
657|│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐ ┌──────────┐ │ │
658|│  │  │  auth   │ │wallet_auth│ │  jobs   │ │proposals││ contracts│ │ │
659|│  │  │  .py    │ │   .py     │ │  .py    │ │  .py   │ │  .py    │ │ │
660|│  │  └────┬────┘ └────┬─────┘ └────┬─────┘ └───┬────┘ └────┬─────┘ │ │
661|│  │       │           │            │           │          │        │ │
662|│  │  ┌────▼───────────▼────────────▼───────────▼──────────▼─────┐  │ │
663|│  │  │ Services Layer                                             │  │ │
664|│  │  │  blockchain_service.py (72 lines - PARTIAL)                │  │ │
665|│  │  │  event_listener.py      (120 lines - COMPLETE)            │  │ │
666|│  │  └──────────┬────────────────────────────────────────┬───────┘  │ │
667|│  └─────────────┼────────────────────────────────────────┼──────────┘ │
668|└────────────────┼────────────────────────────────────────┼────────────┘
669|                 │                                        │
670|                 ▼                                        ▼
671|┌─────────────────────────┐          ┌──────────────────────────────────┐
672|│     PostgreSQL          │          │       Hardhat Node (Local ETH)   │
673|│  (freeledger schema)    │          │  localhost:8545                  │
674|│                         │          │                                  │
675|│  ┌───────────────────┐  │          │  GigEscrow.sol                   │
676|│  │ users             │  │          │  ┌────────────────────────────┐ │
677|│  │ jobs              │  │          │  │ state: ContractStatus       │ │
678|│  │ proposals         │  │          │  │ funds: 7.0 ETH locked      │ │
679|│  │ contracts         │◄─┼──────────┼──│ on_chain_id = 42           │ │
680|│  │ contract_milestones│  │          │  │ milestones[3]              │ │
681|│  │ disputes          │  │          │  │ events[9]                  │ │
682|│  │ threads/messages  │  │          │  └────────────────────────────┘ │
683|│  │ notifications     │  │          │                                  │
684|│  └───────────────────┘  │          └──────────────────────────────────┘
685|└─────────────────────────┘
686|```
687|
688|### Sarun's Scope Boundary
689|
690|```
691|MY RESPONSIBILITY (Contract & Blockchain Developer)
692|═══════════════════════════════════════════════════════
693|
694|┌─────────────────────────────────────────┐
695|│         SMART CONTRACT LAYER            │
696|│  • GigEscrow.sol — escrow logic         │
697|│  • Hardhat — compile, deploy, test      │
698|│  • 5-state lifecycle + milestone states │
699|│  • 2.5% platform fee                    │
700|│  • ReentrancyGuard security             │
701|└────────────────┬────────────────────────┘
702|                 │
703|┌────────────────▼────────────────────────┐
704|│       BLOCKCHAIN SERVICE LAYER          │
705|│  • blockchain_service.py — Web3.py     │
706|│  • Build → sign → send → wait pattern  │
707|│  • Nonce management + gas estimation   │
708|│  • Event listener (5s polling)         │
709|└────────────────┬────────────────────────┘
710|                 │
711|┌────────────────▼────────────────────────┐
712|│     METAMASK AUTHENTICATION LAYER       │
713|│  • auth.js + web3.js (frontend)         │
714|│  • wallet_auth.py (backend)             │
715|│  • ECDSA signature verification         │
716|│  • Nonce generation + Redis TTL         │
717|│  • JWT issuance + refresh rotation      │
718|└────────────────┬────────────────────────┘
719|                 │
720|┌────────────────▼────────────────────────┐
721|│     INTEGRATION & TESTING               │
722|│  • Contract tests (70 planned)          │
723|│  • Backend blockchain service tests     │
724|│  • Runtime verification                 │
725|│  • ABI contract management              │
726|└─────────────────────────────────────────┘
727|
728|TEAM MEMBERS' RESPONSIBILITY (not my scope)
729|═══════════════════════════════════════════════
730|• Bijee Dangol — Frontend (React UI, pages)
731|• Pawan Poudel — Backend/Database (PostgreSQL schema, other routers)
732|• Anushree Pradhan — Backend/API (other API endpoints)
733|• Runa Maphu — Workflow/Junior Backend (support)
734|```
735|
736|### Data Flow for a Complete Contract Lifecycle (Sarun's Scope)
737|
738|```
739|CLIENT creates a contract:
740|
741|  Frontend auth.js           Backend wallet_auth.py          Blockchain
742|  ────────────────           ──────────────────────          ───────────
743|  1. connectWallet() ──────► 2. Challenge (nonce)
744|  3. signMessage()   ◄──────
745|  4. walletLogin()   ──────► 5. Verify ECDSA signature
746|                             6. Issue JWT ◄──────────────► Store in localStorage
747|  7. POST /contracts  ──────► 8. Save to PostgreSQL (status: pending)
748|                             9. create_contract_on_chain() ──► 10. GigEscrow.createContract()
749|                            11. Store on_chain_id ◄────────── 12. Tx receipt
750|                            13. Return to frontend
751|
752|CLIENT funds the contract:
753|
754|  Frontend                   Backend                        Blockchain
755|  ────────                   ──────                         ──────────
756|  1. POST /contracts/{id}/fund ──► 2. fund_contract_on_chain() ──► 3. GigEscrow.fundContract()
757|                                4. Update DB status ◄──────────── 5. Tx receipt
758|
759|FREELANCER submits milestone:
760|
761|  1. POST /milestones/{idx}/submit ──► 2. submit_milestone_on_chain() ──► 3. GigEscrow.submitMilestone()
762|                                       4. Update DB ◄──────────────────── 5. Tx receipt
763|
764|CLIENT approves milestone:
765|
766|  1. POST /milestones/{idx}/approve ──► 2. approve_milestone_on_chain() ──► 3. GigEscrow.approveMilestone()
767|                                          (ETH released on-chain!)          (Freelancer gets paid)
768|                                         4. Update DB ◄──────────────────── 5. Tx receipt
769|
770|DISPUTE raised:
771|
772|  1. POST /contracts/{id}/dispute ──► 2. raise_dispute_on_chain() ──► 3. GigEscrow.raiseDispute()
773|                                       4. Update DB + events ◄───────── 5. Tx receipt
774|
775|ADMIN resolves dispute:
776|
777|  1. POST /admin/disputes/{id}/resolve ──► 2. resolve_dispute_on_chain() ──► 3. GigEscrow.resolveDispute()
778|                                              (ETH released or refunded)
779|                                             4. Update DB + events ◄───────── 5. Tx receipt
780|```
781|
782|---
783|
784|## 7. How to Run the Project
785|
786|```bash
787|# 1. Start infrastructure (PostgreSQL + Redis)
788|cd docker && docker-compose up -d
789|
790|# 2. Start Hardhat local blockchain
791|cd ../contracts && npx hardhat node &
792|# → Runs on localhost:8545
793|# → Accounts pre-funded with 10000 ETH each
794|
795|# 3. Deploy GigEscrow contract
796|npx hardhat run scripts/deploy.js --network localhost
797|
798|# 4. Start backend (FastAPI)
799|cd ../backend && source venv/bin/activate
800|python -m uvicorn app.main:app --reload --port 8000
801|# → Runs on localhost:8000
802|
803|# 5. Start frontend (main)
804|cd ../frontend && npm start
805|# → Runs on localhost:3000
806|
807|# 6. Start frontend (admin mode, separate terminal)
808|cd ../frontend && npm run start:admin
809|# → Runs on localhost:3001
810|```
811|
812|---
813|
814|## 8. Using Remix IDE to Inspect the Contract Visually
815|
816|Remix is a browser-based IDE for Ethereum that can connect to your local Hardhat node. Here's how:
817|
818|### Step 1: Install MetaMask and connect to Hardhat
819|
820|1. Install the **MetaMask** browser extension (Chrome/Firefox)
821|2. Click MetaMask icon → **Network** dropdown → **Add Network Manually**
822|3. Enter:
823|   - **Network Name:** Hardhat Local
824|   - **RPC URL:** `http://127.0.0.1:8545`
825|   - **Chain ID:** `31337`
826|   - **Currency Symbol:** `ETH`
827|4. Click **Save**
828|
829|### Step 2: Import a Hardhat account into MetaMask
830|
831|1. In MetaMask, click the account circle → **Import Account**
832|2. Paste this private key (from `contract-address.txt`):
833|   ```
834|   0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
835|   ```
836|3. This is Account #0 (the deployer) — has 10000 ETH on the local network
837|4. You should see **10000 ETH** balance on the Hardhat Local network
838|
839|### Step 3: Open Remix and load the contract
840|
841|1. Go to **https://remix.ethereum.org/**
842|2. In the **File Explorer** tab (left sidebar), create a new file:
843|   - Right-click `contracts` → **New File** → name it `GigEscrow.sol`
844|3. Open your local `GigEscrow.sol` from `contracts/contracts/GigEscrow.sol`
845|   - **Option A:** Copy-paste the entire file content
846|   - **Option B:** Use Upload button if available
847|4. In the left sidebar, click the **Solidity Compiler** tab (2nd icon, looks like "S")
848|5. Select compiler version `0.8.20` or `0.8.24`
849|6. Click **Compile GigEscrow.sol**
850|   - ✓ Should show green checkmark with no errors
851|
852|### Step 4: Connect Remix to your deployed contract
853|
854|1. Click the **Deploy & Run Transactions** tab (3rd icon, looks like Ethereum logo)
855|2. **Environment:** Select **"Injected Provider - MetaMask"**
856|   - MetaMask will open → Connect the account you imported
857|3. **Contract:** Select `GigEscrow` from the dropdown
858|4. **At Address:** Paste your deployed contract address:
859|   ```
860|   0x5FbDB2315678afecb367f032d93F642f64180aa3
861|   ```
862|5. Click **"At Address"** button
863|6. The contract instance appears below, showing ALL functions
864|
865|### Step 5: Read contract state (visual tool!)
866|
867|Under **Deployed Contracts**, you'll see:
868|
869|```
870|GIGESCROW AT 0X5FBD... (BLUE = READ, RED = WRITE)
871|
872|🔵 Read-Only Functions (blue buttons, no gas, free):
873|   [contractCounter]     [contractExists]     [contracts]
874|   [milestones]          [clientContracts]     [freelancerContracts]
875|   [getContractDetails]  [getMilestoneDetails] [getContractBalance]
876|   [owner]               [PLATFORM_FEE_BPS]
877|
878|🔴 Write Functions (red buttons, costs gas):
879|   [createContract]      [fundContract]        [setFreelancer]
880|   [submitMilestone]     [approveMilestone]    [rejectMilestone]
881|   [raiseDispute]        [resolveDispute]      [cancelContract]
882|```
883|
884|**To check contract #1's state:**
885|1. Next to `getContractDetails`, enter `1` (the contract ID)
886|2. Click the button → Remix shows:
887|   ```
888|   0: address: client → 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
889|   1: address: freelancer → 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
890|   2: string: title → "Build React dApp"
891|   3: string: termsCID → "QmX5..."
892|   4: uint256: totalAmount → 10000000000000000000 (10 ETH in wei)
893|   5: uint256: deadline → 1750000000
894|   6: uint8: status → 1 (InProgress)
895|   7: uint256: milestoneCount → 3
896|   8: uint256: completedMilestones → 1
897|   ```
898|
899|**To check milestone #0 details:**
900|1. Enter `1` (contractId) and `0` (milestoneIndex)
901|2. Click `getMilestoneDetails` → shows:
902|   ```
903|   0: string: description → "Setup project"
904|   1: uint256: amount → 3000000000000000000 (3 ETH)
905|   2: string: deliverableCID → "QmY8..."
906|   3: uint8: status → 2 (Approved)
907|   4: uint256: submittedAt → 1748300000
908|   5: uint256: approvedAt → 1748300100
909|   ```
910|
911|**To check contract balance:**
912|1. Enter `1` (contractId) in `getContractBalance`
913|2. Click → shows remaining locked ETH in wei
914|
915|### Step 6: Simulate a contract lifecycle visually
916|
917|Using Remix + MetaMask, you can step through the entire flow:
918|
919|```
920|1. createContract(
921|     "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",  // freelancer
922|     "Test Contract",
923|     "QmTest",
924|     10000000000000000000,         // 10 ETH in wei
925|     1750000000,                   // deadline
926|     ["Milestone 1", "Milestone 2"],
927|     [5000000000000000000, 5000000000000000000]  // 5 ETH + 5 ETH
928|   )
929|   → MetaMask confirms → getContractDetails(1) shows status = 0 (Created)
930|
931|2. fundContract(1)
932|   → Send 10 ETH in value field (at top of Remix)
933|   → MetaMask confirms → getContractDetails(1) shows status = 1 (InProgress)
934|
935|3. Switch MetaMask to Account #1 (freelancer)
936|   → submitMilestone(1, 0, "QmDeliverable1")
937|   → getMilestoneDetails(1, 0) shows status = 2 (Submitted)
938|
939|4. Switch back to Account #0 (client)
940|   → approveMilestone(1, 0)
941|   → MetaMask confirms → Freelancer receives 4.875 ETH (5 - 2.5%)
942|   → getMilestoneDetails(1, 0) shows status = 3 (Approved)
943|```
944|
945|---
946|
947|## 9. File Reference by Layer
948|
949|### Smart Contract Layer
950|| File | Lines | Status |
951||------|-------|--------|
952|| `contracts/contracts/GigEscrow.sol` | 317 | Complete |
953|| `contracts/scripts/deploy.js` | 50 | Complete |
954|| `contracts/hardhat.config.js` | ~15 | Complete |
955|| `backend/app/contracts/GigEscrow.json` | ABI | Complete |
956|| `contracts/test/GigEscrow.test.js` | 326 | ❌ Missing |
957|| `contracts/test/GigEscrowEdgeCases.test.js` | 517 | ❌ Missing |
958|
959|### Blockchain Service Layer
960|| File | Lines | Status |
961||------|-------|--------|
962|| `backend/app/services/blockchain_service.py` | 72 | ⚠️ Partial (needs 364) |
963|| `backend/app/services/event_listener.py` | 120 | Complete |
964|
965|### Authentication Layer
966|| File | Lines | Status |
967||------|-------|--------|
968|| `frontend/src/services/web3.js` | 119 | Complete |
969|| `frontend/src/services/auth.js` | 102 | Complete |
970|| `frontend/src/services/api.js` | 46 | Complete |
971|| `frontend/src/services/contractAbi.js` | ~40 | Complete |
972|| `backend/app/routers/wallet_auth.py` | 281 | Complete |
973|| `backend/app/routers/auth.py` | 234 | Complete |
974|
975|### Backend API Layer
976|| File | Lines | Status |
977||------|-------|--------|
978|| `backend/app/routers/jobs.py` | 184 | Complete |
979|| `backend/app/routers/proposals.py` | 145 | Complete |
980|| `backend/app/routers/contracts.py` | 258 | Complete |
981|| `backend/app/routers/disputes.py` | 84 | Complete |
982|| `backend/app/routers/uploads.py` | ~30 | Complete |
983|| `backend/app/routers/users.py` | ~60 | Complete |
984|| `backend/app/main.py` | 65 | Complete |
985|
986|### Backend Infrastructure
987|| File | Lines | Status |
988||------|-------|--------|
989|| `backend/app/models.py` | ~200 | Complete |
990|| `backend/app/schemas.py` | ~120 | Complete |
991|| `backend/app/config.py` | ~40 | Complete |
992|| `backend/app/database.py` | ~30 | Complete |
993|| `backend/app/redis_client.py` | ~20 | Complete |
994|| `backend/app/utils/error_codes.py` | ~15 | Complete |
995|| `backend/app/utils/exceptions.py` | ~15 | Complete |
## 10. Repair Log

| Date | Issue | Root Cause | Fix Applied | Files Changed |
|------|-------|------------|-----|---------------|
| 2026-07-02 | Client job posting modal: Network Error | Backend FastAPI was not running (port 8000 returning 000). PostgreSQL schema was missing `on_chain_job_id` column in `freeledger.jobs`, which would 500 even if backend started. Hardhat Docker container was using Node 18 image, which is incompatible with installed Hardhat (requires Node >= 20), causing RPC failure. | 1. Added `on_chain_job_id INTEGER NULL` to `docker/postgres/init.sql` and ran `ALTER TABLE` on live DB. 2. Bumped Hardhat container image from `node:18` to `node:20` and force-recreated container. 3. Started backend via uvicorn. | `docker/postgres/init.sql`, `docker/docker-compose.yml` |


## 11. start.sh Improvements

| Date | Issue | Fix |
|------|-------|-----|
| 2026-07-02 | start.sh had no backend health verification, no graceful failure on unhealthy backend, and no auto-pull node:20 | Pulls node:20 automatically, verifies `/health` returns 200, prints common fixes upfront on failure |

### Verification
- `curl http://127.0.0.1:8000/health` → `200 OK`
- `curl http://127.0.0.1:8000/api/health` → `200 OK`
- Registered test client → created job → API returned `200` with job object containing `on_chain_job_id: null`
- Hardhat JSON-RPC → responded with block number after container recreate
- Contract redeployed to `0x5FbDB2315678afecb367f032d93F642f64180aa3`

### Notes
- `docker compose up -d` was run as a background process (`background=true`) because it triggered the terminal long-lived-process guard.
- Backend was started manually with `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` from `backend/` venv.
- Backend event listener continues to log connection errors in a retry loop but does not crash the server; it will recover once Hardhat is consistently available.

---
## 10. PlantUML Diagram Accuracy Audit

This section documents which diagrams in `capstone_report/docs/plantuml/` accurately reflect the current system behavior and which do not, as of the Approach B implementation pass.

### Accurate Diagrams
- `02_Authentication.puml` — Reflects the actual wallet auth flow implemented in `frontend/src/services/auth.js` and `backend/app/routers/wallet_auth.py`.
- `06_Solidity_API.puml` — Matches the `GigEscrow.sol` function surface and access-control rules documented in the smart contract.
- `07_Escrow_State_Machine.puml` — Correctly describes the Solidity enum lifecycle: Created → InProgress → Completed / Cancelled / Disputed, with milestone sub-states Pending → Funded → Submitted → Approved / Rejected.
- `08_System_Test_Plan.puml` — Parametrized test boundary diagram is structurally accurate for the Hardhat test scenarios.
- `09a_Proposal_Creation_Activity.puml` — Matches `proposals.py` create/list/accept flow.
- `09d_Dispute_Resolution_Activity.puml` — Generally aligned with `disputes.py` + `raiseDispute()` / `resolveDispute()` on-chain functions.
- `10_Architecture.puml` — Layer stack (React, FastAPI, PostgreSQL, Hardhat, IPFS) matches the actual deployment topology.
- `11a_Controllers.puml` — Controller / endpoint grouping matches the router files present in `backend/app/routers/`.
- `12_API_Interaction.puml` — REST method/path convention matches the current routers.
- `13_Deployment.puml` — Docker + Hardhat + uvicorn stack matches project instructions.

### Inaccurate Diagrams (MUST UPDATE BEFORE SUBMISSION)

| Diagram | Inaccuracy | What Actually Happens |
|---------|-----------|----------------------|
| `03_Contract_Creation.puml` | Shows frontend driving on-chain deployment. | Contract deployment is triggered server-side during `POST /api/proposals/{id}/accept` in `backend/app/routers/proposals.py`, not from a direct client form submit. There is no `POST /api/contracts/create` endpoint, and there is no `POST /api/contracts/:id/confirm` endpoint. |
| `04_Contract_Execution.puml` | Shows on-chain payment release on milestone approval. | `POST /api/contracts/:id/milestones/{index}/approve` (`approve_milestone` in `routers/contracts.py`) only updates PostgreSQL to `MilestoneStatus.approved`. There is no on-chain payment release during milestone approval. |
| `04_Contract_Execution.puml` | Shows `verifySignature(freelancerSignature)` on backend. | No signature-verification service exists; `Web3.eth.account` is only used for server-side transaction signing. |
| `05_State_Machine.puml` | Uses states `Draft → Pending → Signed → Active → Submitted → Approved → Paid → Revision → Disputed → Completed`. | Actual `ContractStatus` enum in `backend/app/models.py` is: `draft`, `pending_review`, `pending_signatures`, `pending_funding`, `active`, `delivered`, `revision_requested`, `completed`, `cancelled`, `disputed`. |
| `09b_Contract_Creation_Activity.puml` | Shows client filling form → deploy → both sign → both signed → client deposits ETH → Active. | Current implemented flow (Approach B): client accepts proposal → backend deploys contract (`pending_funding`) → client signs → freelancer signs → still `pending_funding` → client funds → `active`. Signing and funding are separate steps. |
| `09c_Milestone_Execution_Activity.puml` | Shows on-chain payment release on approval. | Current backend does not implement on-chain payment release during milestone approval. |
| `11b_Services.puml` | Shows `IPFSService`, `SignatureVerification`, `AuthService`, and `ContractService` with methods that don't exist as separate service modules. | `backend/app/services/` contains only `blockchain_service.py`, `event_listener.py`, and (new) `contract_service.py`. There is no `IPFSService` (CID is stubbed), no `SignatureVerification` service (signing is done inline via `web3.py`), and no `AuthService` (logic lives in `wallet_auth.py` router). |
| `01_Architecture.puml` | Shows React app deploying directly to Solidity contract. | In the current system, the **backend** (`blockchain_service.py` / `contract_service.py`) builds, signs, and broadcasts contract-deployment transactions using the server private key. The frontend never deploys contracts. |
| `01_Architecture.puml` | Shows `eth_authentication()` and Redis session abstractions (`session_create`, `session_verify`) as first-class boxes. | No such named functions/service layer exists. Auth uses JWT in `wallet_auth.py`; Redis is used only for nonce storage in the auth flow, not for session tokens. |
| `11c_Entities.puml` | Shows `Session`, `Signature`, `Deliverable` entities with attributes that don't match real DB models. | PostgreSQL has no `sessions`, `signatures`, or `deliverables` tables. The `Contract` model has no `pseudonymousId`, `clientPseudonym`, `freelancerPseudonym`, `signedAt`, or `txHash` columns. |
| `03_Contract_Creation.puml` & `09b` | Reference `termsCID` as if uploaded to IPFS before or during contract creation. | Current flow writes a stub CID `contract_{contract.id}` in `contract_service.py`; there is no live IPFS upload path integrated into contract creation. |

### Recommended Actions
1. Update `05_State_Machine.puml` to use real `ContractStatus` and `MilestoneStatus` enum values from `backend/app/models.py:103-166`.
2. Update `03_Contract_Creation.puml` and `09b_Contract_Creation_Activity.puml` to describe proposal-accept-driven deployment and the split sign/fund flow (`pending_funding` → `active`).
3. Update `04_Contract_Execution.puml` to remove on-chain payment release from milestone approval.
4. Update `11b_Services.puml` to reflect the real service modules: `contract_service.py` (sign / fund orchestration) and `blockchain_service.py` (tx build/sign/send + helpers).
5. Update `01_Architecture.puml` so the backend is the contract-deployment actor, not the React app.
6. Update `11c_Entities.puml` to match actual SQLAlchemy model fields (`models.py`).

---

## 11. Repair Log

| Date | Issue | Root Cause | Fix Applied | Files Changed |
|------|-------|------------|-----|---------------|
| 2026-07-02 | Client job posting modal: Network Error | Backend FastAPI was not running (port 8000 returning 000). PostgreSQL schema was missing `on_chain_job_id` column in `freeledger.jobs`, which would 500 even if backend started. Hardhat Docker container was using Node 18 image, which is incompatible with installed Hardhat (requires Node >= 20), causing RPC failure. | 1. Added `on_chain_job_id INTEGER NULL` to `docker/postgres/init.sql` and ran `ALTER TABLE` on live DB. 2. Bumped Hardhat container image from `node:18` to `node:20` and force-recreated container. 3. Started backend via uvicorn. | `docker/postgres/init.sql`, `docker/docker-compose.yml` |

---

## 12. Approach B Implementation Log (2026-07-03)

| Change | File | What Was Added / Fixed |
|--------|------|------------------------|
| Contract service | `backend/app/services/contract_service.py` | Split signing and funding into separate service functions |
| Router sign/fund | `backend/app/routers/contracts.py` | `POST /contracts/{id}/sign` now only records signatures; `POST /contracts/{id}/fund` only funds and activates |
| Proposal accept | `backend/app/routers/proposals.py` | Accepting a proposal now deploys the contract on-chain, stores `on_chain_id` and `contract_address`, and sets status to `pending_funding` |
| Frontend client | `frontend/src/pages/client/MyContracts.js` | Added `Fund Contract` button for `pending_funding` contracts |
| Frontend freelancer | `frontend/src/pages/freelancer/MyContracts.js` | Added `Sign Contract` button for `pending_signatures` contracts |

---

## 13. start.sh Improvements

| Date | Issue | Fix |
|------|-------|-----|
| 2026-07-02 | start.sh had no backend health verification, no graceful failure on unhealthy backend, and no auto-pull node:20 | Pulls node:20 automatically, verifies `/health` returns 200, prints common fixes upfront on failure |

### Verification
- `curl http://127.0.0.1:8000/health` → `200 OK`
- `curl http://127.0.0.1:8000/api/health` → `200 OK`
- Registered test client → created job → API returned `200` with job object containing `on_chain_job_id: null`
- Hardhat JSON-RPC → responded with block number after container recreate
- Contract redeployed to `0x5FbDB2315678afecb367f032d93F642f64180aa3`

### Notes
- `docker compose up -d` was run as a background process (`background=true`) because it triggered the terminal long-lived-process guard.
- Backend was started manually with `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` from `backend/` venv.
- Backend event listener continues to log connection errors in a retry loop but does not crash the server; it will recover once Hardhat is consistently available.

---

---

## 14. IPFS Integration + On-Chain Operations Log (2026-07-04)

### Files Created

| File | Purpose |
|------|---------|
| `backend/app/services/ipfs_service.py` | Upload/download/pin files to IPFS Kubo API via httpx |
| `backend/app/services/ipfs_monitor.py` | Background health check of IPFS node (30s interval) |
| `backend/app/services/repin_service.py` | Background repin loop (6 hour interval) for all CIDs in DB |
| `backend/app/services/health_service.py` | Enhanced `/api/health` aggregating DB, Redis, IPFS, Blockchain, Event Listener |
| `backend/app/services/audit_service.py` | `log_transition()` helper for writing audit log entries |
| `backend/app/routers/ipfs.py` | `POST /api/ipfs/upload` (auth) + `GET /api/ipfs/download/{cid}` |
| `backend/app/routers/admin.py` | `GET /api/admin/disputes` + `GET /api/admin/audit-logs` |
| `frontend/src/pages/admin/AuditLogs.js` | Admin audit log viewer with filterable table |
| `frontend/src/pages/admin/AdminContracts.js` | (updated) Added audit log queries |
| `docker/ipfs/config.sh` | IPFS CORS init script (`Access-Control-Allow-Origin: *`) |
| `IPFS.txt` | Full IPFS implementation documentation |

### Files Modified

| File | Change |
|------|--------|
| `docker/docker-compose.yml` | Added IPFS Kubo v0.28.0 service (ports 5001/8080, healthcheck using `ipfs swarm peers`) |
| `requirements.txt` | Added `httpx==0.27.0` |
| `backend/app/config.py` | Added `ipfs_api_url`, `repin_interval_seconds`, `freelancer_private_key`, blockchain timeouts |
| `backend/app/models.py` | Added `rejection_reason` to `ContractMilestone`, added `AuditLog` model |
| `backend/app/schemas.py` | Added `IPFSUploadResponse`, `AuditLogResponse`, `DisputeResolveRequest`, `rejection_reason` in `MilestoneResponse` |
| `backend/app/blockchain_service.py` | Added `submit_milestone_on_chain`, `reject_milestone_on_chain`, `raise_dispute_on_chain`, `resolve_dispute_on_chain` |
| `backend/app/routers/contracts.py` | `submit_milestone` → on-chain call + audit log (was DB-only). `approve_milestone` → on-chain call + audit log + auto-complete with audit. `reject_milestone` → on-chain call + stores `rejection_reason` + audit log |
| `backend/app/routers/disputes.py` | `create_dispute` → on-chain call + audit log. New `POST /disputes/{id}/resolve` for admin with on-chain `resolveDispute()` |
| `backend/app/main.py` | Registered `admin` and `ipfs` routers; started `ipfs_monitor` and `repin_service` in lifespan |
| `frontend/src/pages/admin/AdminDisputes.js` | Replaced mock localStorage CRUD with real API fetch + resolve via `/admin/disputes` + `/disputes/{id}/resolve` |
| `frontend/src/pages/admin/AdminContracts.js` | (updated) Real API data |
| `frontend/src/pages/admin/AuditLogs.js` | New page |
| `frontend/src/services/ipfs.js` | `uploadFile(file)` and `getIPFSGatewayUrl(cid)` helpers |
| `frontend/src/config/index.js` | Added `ipfsGateway` field |
| `frontend/.env` | Added `REACT_APP_IPFS_GATEWAY=http://localhost:8080` |
| `frontend/src/components/admin/Navbar.js` | Added "Audit Logs" nav link |
| `frontend/src/App.js` | Added `/audit-logs` route + `AuditLogs` import |

### DB Migration Required (Live)

The `rejection_reason` column and `audit_logs` table were added to the SQLAlchemy models but PostgreSQL tables already existed. SQL applied manually:

```sql
ALTER TABLE freeledger.contract_milestones ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE TABLE IF NOT EXISTS freeledger.audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50) NOT NULL,
    from_status VARCHAR(50),
    to_status VARCHAR(50),
    action VARCHAR(50) NOT NULL,
    actor_id VARCHAR(50),
    actor_role VARCHAR(50),
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON freeledger.audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON freeledger.audit_logs(entity_id);
```

### Architecture: Updated Data Flow

```
                    ┌─────────────────────────────────────────┐
                    │              FRONTEND (React)            │
                    │  POST /upload (multipart)                │
                    │    → ipfs.js: uploadFile(file)           │
                    │    → Backend /api/ipfs/upload            │
                    │      → ipfs_service.py: upload_file()    │
                    │        → IPFS Kubo API (port 5001)       │
                    │      → Returns { cid, size, mime_type } │
                    │    → Use CID in submitMilestone          │
                    │                                         │
                    │  View deliverable:                       │
                    │    → http://localhost:8080/ipfs/{cid}    │
                    └─────────────────────────────────────────┘

                    ┌─────────────────────────────────────────┐
                    │         BACKEND (State Transitions)      │
                    │                                         │
                    │  State change (approve/reject/dispute): │
                    │    1. Call blockchain_service.on_chain() │
                    │    2. Update PostgreSQL row              │
                    │    3. audit_service.log_transition()     │
                    └─────────────────────────────────────────┘
```

### Updated Section 2.6 — Backend API Routers

| Router | File | Lines | Status |
|--------|------|-------|--------|
| Jobs | `routers/jobs.py` | 184 | Complete |
| Proposals | `routers/proposals.py` | 145 | Complete |
| Contracts | `routers/contracts.py` | ~510 | Complete |
| Disputes | `routers/disputes.py` | ~140 | Complete |
| Admin | `routers/admin.py` | ~100 | Complete |
| IPFS | `routers/ipfs.py` | ~80 | Complete |
| Uploads | `routers/uploads.py` | ~30 | Complete |
| Users | `routers/users.py` | ~60 | Complete |

### Updated Section 2.8 — Blockchain Service

**File:** `backend/app/services/blockchain_service.py`

Now has all 7 on-chain functions implemented:

| Function | Purpose |
|----------|---------|
| `create_contract_on_chain()` | Build → sign → send `createContract()` tx |
| `submit_milestone_on_chain()` | Submit deliverable CID on-chain |
| `approve_milestone_on_chain()` | Approve + release payment |
| `reject_milestone_on_chain()` | Reject milestone (resets to Funded) |
| `raise_dispute_on_chain()` | Set contract to Disputed state |
| `resolve_dispute_on_chain()` | Release or refund via admin |
| `fund_contract_on_chain()` | Fund contract (meta: client-side via MetaMask) |

---

## 15. Repair Log

| Date | Issue | Root Cause | Fix Applied | Files Changed |
|------|-------|------------|-------------|---------------|
| 2026-07-02 | Client job posting modal: Network Error | Backend FastAPI not running, PostgreSQL missing `on_chain_job_id` column, Hardhat on Node 18 | Added column, bumped Node to 20, started backend | `docker/postgres/init.sql`, `docker/docker-compose.yml` |
| 2026-07-04 | Client My Contracts page: Network Error | Added `rejection_reason` to `ContractMilestone` model + `AuditLog` model, but PostgreSQL tables already existed. `metadata.create_all` only creates new tables, doesn't ALTER existing ones. | `ALTER TABLE freeledger.contract_milestones ADD COLUMN rejection_reason TEXT` + `CREATE TABLE freeledger.audit_logs(...)` | — (SQL run directly against live DB) |

*Last updated: 2026-07-04*
*Session: IPFS integration + on-chain milestone/dispute operations + admin audit log viewer complete*

---

## 16. Profile → Backend API + Admin Pages → Real API (2026-07-04)

### Backend Changes

| File | Change |
|------|--------|
| `backend/app/schemas.py` | Added `UserUpdate` schema for profile updates |
| `backend/app/routers/users.py` | Added `GET /users/me` (current user profile) + `PUT /users/me` (update profile) |
| `backend/app/routers/admin.py` | Complete rewrite: added `GET /admin/dashboard` (aggregate stats), `GET /admin/users` (list/search/suspend), `PUT /admin/users/{id}` (update), `DELETE /admin/users/{id}` (soft-deactivate), `GET /admin/jobs` (list/search/close/reopen), `PUT /admin/jobs/{id}` (update), `DELETE /admin/jobs/{id}` (cancel), `GET /admin/proposals` (list/search), `PUT /admin/proposals/{id}` (update), `DELETE /admin/proposals/{id}` (withdraw), `GET /admin/contracts` (list/search), `PUT /admin/contracts/{id}` (update), `DELETE /admin/contracts/{id}` (cancel) |

### Frontend Changes

| File | Change |
|------|--------|
| `frontend/src/pages/client/Profile.js` | Rewritten: load from `GET /users/me` on mount, save to `PUT /users/me`, falls back to localStorage if server unavailable. Maps: `name→username`, `bio→bio`, `skills→skills`, `hourlyRate→hourly_rate` |
| `frontend/src/pages/freelancer/MyProfile.js` | Rewritten: same pattern. Maps: `fullName→username`, `title→headline`, `bio→bio`, `skills→skills`, `hourlyRate→hourly_rate`, `experience→experience_level`, `availability→is_available` |
| `frontend/src/pages/admin/Dashboard.js` | Rewritten: fetches live stats from `GET /admin/dashboard` (users, jobs, contracts, disputes counts, volume, fees, recent users) |
| `frontend/src/pages/admin/AdminUsers.js` | Rewritten: `GET /admin/users` with pagination + search + role filter, `PUT /admin/users/{id}` for suspend/activate, `DELETE /admin/users/{id}` for soft-deactivate. Uses `window.confirm` for destructive actions |
| `frontend/src/pages/admin/AdminJobs.js` | Rewritten: `GET /admin/jobs` with pagination + search + status filter, `PUT /admin/jobs/{id}` for close/reopen, `DELETE /admin/jobs/{id}` for cancel |
| `frontend/src/pages/admin/AdminProposals.js` | Rewritten: `GET /admin/proposals` with pagination + search + status filter, `PUT /admin/proposals/{id}` for reject, `DELETE /admin/proposals/{id}` for withdraw |
| `frontend/src/pages/admin/AdminContracts.js` | Rewritten: `GET /admin/contracts` with pagination + search + status filter, `PUT /admin/contracts/{id}` for complete/cancel, `DELETE /admin/contracts/{id}` for cancel |

### Key Decisions
- All destructive actions (suspend, deactivate, cancel, withdraw) use soft-deletes (status changes) instead of hard deletes, preserving referential integrity
- Profile pages fall back to localStorage if backend is unavailable, maintaining offline resilience
- All admin pages use the existing `api.js` axios interceptor which auto-attaches JWT + auto-refreshes on 401
- GitHub/LinkedIn/Portfolio URL fields kept in the UI but not persisted to backend (no columns in User model)
- AdminDisputes and AuditLogs pages were already using real API from the previous session and were not modified
