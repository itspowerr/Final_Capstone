# FreeLedger — Complete Code Map & Architecture Graph

> **Purpose:** Single reference for Sarun's responsibility: every auth path, blockchain call, backend router, service, model, and config connection.
> **Style:** Obsidian-style graph. Each section shows `File (lines)` → exact functions → call targets → return path.

---

## 1. Global Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React)                           │
│  Entry: frontend/src/App.js → AppProvider → Routes                │
│                                                                     │
│  Auth Pages      Client Pages           Freelancer Pages            │
│  Login.js        Dashboard.js           Dashboard.js               │
│                   ExploreJobs.js        FindJobs.js                │
│                   MyContracts.js        MyContracts.js             │
│                   Profile.js            MyProfile.js               │
│                                                                     │
│  Shared: PostProjectModal.js  (blockchain tx trigger)              │
│                                                                     │
│  Services: api.js, auth.js, web3.js, contractAbi.js                │
│  Context:  AppContext.js                                             │
│  Hook:     useAuth.js                                                │
│  Config:   config/index.js                                            │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTP / WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        BACKEND (FastAPI)                            │
│  Entry: backend/app/main.py → lifespan → routers included          │
│                                                                     │
│  Routers (all prefixed /api):                                      │
│   auth.py             login, register, refresh, /me                 │
│   wallet_auth.py      wallet/challenge, wallet/status, wallet/login │
│   jobs.py             CRUD + PUT /{id}/on-chain-id                  │
│   contracts.py        CRUD + milestone approve/reject               │
│   proposals.py        submit/list                                   │
│   users.py            profile/update                                 │
│   disputes.py         create/list                                    │
│   uploads.py          file upload                                    │
│                                                                     │
│  Services:                                                          │
│   blockchain_service.py  read-only Web3 helpers                     │
│   event_listener.py      polls ContractCreated events               │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ JSON-RPC / SQL
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE                                   │
│  Hardhat local chain  127.0.0.1:8545                               │
│  PostgreSQL           freeledger/freeledger                        │
│  Redis                nonces + event listener state                 │
│  Docker               docker/docker-compose.yml                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Sarun's Owned Files** (everything he built/modified)

| Layer | Files |
|---|---|
| Frontend | `Login.js`, `useAuth.js`, `auth.js`, `web3.js`, `contractAbi.js`, `PostProjectModal.js`, `client/Navbar.js`, `freelancer/Navbar.js`, `config/index.js`, `AppContext.js`, `api.js` |
| Backend | `wallet_auth.py`, `auth.py`, `jobs.py`, `contracts.py`, `event_listener.py`, `blockchain_service.py`, `main.py` |
| Data | `models.py`, `schemas.py`, `database.py`, `config.py` |
| Blockchain | `contracts/GigEscrow.sol`, `contracts/scripts/deploy.js` |
| Infra | `docker/docker-compose.yml`, `docker/postgres/init.sql`, `start.sh` |
| Docs | `Saruns_Capstone_Details.md`, this file |

---

## 2. Frontend Router → File Map

```
App.js
├── Landing
├── Login
├── /client/dashboard         → pages/client/Dashboard.js
├── /client/explore-jobs      → pages/client/ExploreJobs.js
├── /client/browse-freelancers→ pages/client/BrowseFreelancers.js
├── /client/my-contracts      → pages/client/MyContracts.js
├── /client/profile           → pages/client/Profile.js
├── /freelancer/dashboard     → pages/freelancer/Dashboard.js
├── /freelancer/jobs          → pages/freelancer/FindJobs.js
├── /freelancer/contracts     → pages/freelancer/MyContracts.js
└── /freelancer/my-profile    → pages/freelancer/MyProfile.js

All client/freelancer pages include:
  client/Navbar.js       — contains PostProjectModal trigger
  freelancer/Navbar.js   — logout + profile
```

---

## 3. MetaMask Authentication Flow (Complete Map)

### 3.1 Entry Points

| Trigger | File | Function |
|---|---|---|
| "Connect with MetaMask" button | `Login.js` | `handleMetaMask()` |
| Register tab "Sign up with MetaMask" | `Login.js` | `handleMetaMask()` |
| "Connect Wallet" in PostProjectModal | `PostProjectModal.js` | `connectWallet()` |

### 3.2 handleMetaMask() Call Graph

```
Login.js (handleMetaMask)
│
├─ [register tab]
│  ├─ connectAndCheck(role, email, password, username)   [useAuth]
│  └─ handleWalletRoleConfirm(selectedRole)               [Login.js]
│
└─ [login tab]
   └─ connectAndCheck()                                   [useAuth]
```

### 3.3 useAuth.js — connectAndCheck()

```
useAuth.js (connectAndCheck)
│  inputs: [role?, email?, password?, username?]
│
├─ 1. connectWalletService()                               [auth.js]
│     └─ returns { address, provider }
│
├─ 2. connectWallet(address)                               [AppContext.js]
│     └─ setWalletAddress(address)
│
├─ 3. checkWalletStatus(address)                           [auth.js]
│     └─ GET /api/auth/wallet/status?address=0x...
│
├─ [branch] if !exists && !role → return { status: 'needs_role' }
│
├─ 4. getChallenge(address)                                [auth.js]
│     └─ GET /api/auth/wallet/challenge?address=0x...
│
├─ 5. signMessage(provider, nonce)                         [auth.js]
│     └─ MetaMask popup: "Sign this message"
│
├─ 6. walletLogin(payload)                                 [auth.js]
│     └─ POST /api/auth/wallet/login
│
└─ 7. Store tokens + user in localStorage + setUser()      [AppContext.js]
```

### 3.4 auth.js Service Functions

```
auth.js
├─ connectWallet()
│  ├─ guard: window.ethereum required
│  ├─ getProvider()                                       [web3.js]
│  ├─ provider.send('eth_requestAccounts', [])            ← MetaMask popup #1
│  ├─ provider.getSigner()
│  └─ signer.getAddress()
│
├─ getChallenge(address)
│  └─ api.get('/auth/wallet/challenge', { params: { address } })
│
├─ signMessage(provider, message)
│  ├─ provider.getSigner()
│  └─ signer.signMessage(message)                         ← MetaMask popup #2
│
├─ walletLogin(payload)
│  └─ api.post('/auth/wallet/login', payload)
│     └─ body: { address, signature, role?, email?, password?, username? }
│
└─ checkWalletStatus(address)
   └─ api.get('/auth/wallet/status', { params: { address } })
```

### 3.5 web3.js — Blockchain Primitives

```
web3.js
├─ getProvider()
│  └─ new BrowserProvider(window.ethereum)
│
├─ getSigner()
│  ├─ getProvider()
│  └─ provider.getSigner()
│
├─ getAccount()
│  └─ provider.listAccounts()[0]
│
├─ getBalance(address)
│  ├─ provider.getBalance(address)
│  └─ ethers.formatEther(balance)
│
├─ ensureCorrectNetwork()
│  ├─ window.ethereum.request({ wallet_switchEthereumChain, chainId: 0x7a69 })
│  └─ [if 4902] wallet_addEthereumChain
│
└─ getContract(address, abi)
   ├─ getSigner()
   └─ new Contract(address, abi, signer)
```

### 3.6 PostProjectModal.js — Blockchain Connection Flow

```
PostProjectModal.js (handleSubmit)
│
├─ [guard] window.ethereum check
├─ [guard] walletStatus === 'connected' check
│
├─ 1. api.post('/jobs', { title, category, description, budget, skills, duration_days })
│  └─ returns jobId
│
├─ 2. ensureCorrectNetwork()                               [web3.js]
│     └─ MetaMask popup (if on wrong chain): "Switch network?"
│
├─ 3. getSigner()                                          [web3.js]
│     └─ MetaMask popup: "Connect this site?" (if not connected)
│
├─ 4. getContract(config.contractAddress, GIG_ESCROW_ABI)  [web3.js]
│     └─ new Contract(address, abi, signer)
│
├─ 5. contract.createContract(
│       freelancerAddress,
│       title,
│       termsCID,
│       totalAmountWei,
│       deadlineUnix,
│       milestoneDescriptions[],
│       milestoneAmountsWei[]
│     )
│     └─ MetaMask popup #3: "Confirm transaction"
│
├─ 6. tx.wait()                                            ← waits for block
│
├─ 7. Parse receipt.logs for ContractCreated event
│     ├─ contract.interface.parseLog(log)
│     └─ if name === 'ContractCreated' → onChainJobId = Number(args.contractId)
│
└─ 8. api.put(`/jobs/${jobId}/on-chain-id`, { on_chain_job_id })
```

### 3.7 AppContext.js — Global Wallet State

```
AppContext.js
├─ walletAddress       ← set by connectWallet(address)
├─ user                ← set by setUser(user)
├─ isConnected         ← !!walletAddress
├─ connectWallet()     ← updates walletAddress only
├─ setUser()           ← updates user + walletAddress
├─ disconnectWallet()  ← clears both + localStorage
└─ mount: reads localStorage 'user' → rehydrates state
```

### 3.8 config/index.js — Blockchain Config Injection

```
config/index.js
│  reads REACT_APP_* env vars at BUILD TIME
│
├─ contractAddress  ← REACT_APP_CONTRACT_ADDRESS
├─ rpcUrl           ← REACT_APP_BLOCKCHAIN_RPC || http://127.0.0.1:8545
├─ chainId          ← REACT_APP_CHAIN_ID || 31337
└─ apiUrl           ← REACT_APP_API_URL || http://127.0.0.1:8000/api
```

**Important:** CRA bakes these into the JS bundle at startup. Changing `.env` requires dev server restart.

---

## 4. Backend Authentication Path

### 4.0 Login Flow

The login flow is the main user entry point for both email/password and MetaMask wallet authentication.

- Email/password login: `frontend/src/pages/Login.js` → `handleLogin()` → `frontend/src/services/api.js` → backend `backend/app/routers/auth.py.login()`
- Email/password sign-up: `frontend/src/pages/Login.js` → `handleRegister()` → `frontend/src/services/api.js` → backend `backend/app/routers/auth.py.register()`
- Wallet/MetaMask connect: `frontend/src/pages/Login.js` → `handleMetaMask()` → `frontend/src/hooks/useAuth.js.connectAndCheck()` → `frontend/src/services/auth.js.connectWallet()` (MetaMask popup only)
- Wallet/MetaMask auth backend calls: `frontend/src/hooks/useAuth.js.connectAndCheck()` → `frontend/src/services/auth.js.checkWalletStatus()` / `getChallenge()` / `walletLogin()` → backend `backend/app/routers/wallet_auth.py`

Important details:
- `connectWallet()` in `frontend/src/services/auth.js` is the MetaMask-only step: it opens MetaMask, requests account access, and returns `{ address, provider }`.
- That `connectWallet()` call does not contact the backend.
- The backend is called immediately afterward from `useAuth.js` via `checkWalletStatus()`, `getChallenge()`, and `walletLogin()`.
- `wallet_auth.py` implements `/auth/wallet/status`, `/auth/wallet/challenge`, and `/auth/wallet/login`.
- `access_token` and `refresh_token` are JWTs returned by the backend and stored in `localStorage` for authenticated API access.
- `access_token` is used by `frontend/src/services/api.js` to set `Authorization: Bearer <token>` on protected requests.

- Shared outcome: JWT tokens are stored in `localStorage`, AppContext user state is updated, and the user is redirected to the appropriate dashboard.

### 4.1 Email/Password Flow

```
Login.js handleLogin()
│
├─ POST /api/auth/login
│  Body: { email, password, loginRole }
│
├─ auth.py login()
│  ├─ SELECT user WHERE email= AND role=
│  ├─ verify_password(password, password_hash)
│  ├─ create_access_token(user.id)
│  └─ create_refresh_token(user.id)
│     payload: { sub: user.id, type: access/refresh, exp, iat, jti }
│
└─ Response: TokenResponse { access_token, refresh_token, user }
```

### 4.2 Wallet/MetaMask Flow (SIWE)

```
Login.js handleMetaMask()
│
└─ useAuth.js connectAndCheck()
   │
   ├─ POST /api/auth/wallet/challenge?address=0x...
   │  wallet_auth.py wallet_challenge()
   │  └─ nonce = secrets.token_hex(32)
   │     Redis SETEX nonce:{address} nonce 300
   │
   ├─ MetaMask signMessage(nonce)                            ← popup #2
   │
   ├─ POST /api/auth/wallet/login
   │  wallet_auth.py wallet_login()
   │  Body: { address, signature, role?, email?, password?, username? }
   │
   │  ├─ Redis GET nonce:{address}
   │  ├─ Redis DELETE nonce:{address}  [single-use]
   │  ├─ encode_defunct(text=nonce)
   │  ├─ Account.recover_message(message, signature)
   │  ├─ if recovered != address → 401 SIGNATURE_MISMATCH
   │  │
   │  ├─ [Flow A] no email → create user
   │  ├─ [Flow B] email+password → create/link user
   │  ├─ [Flow C] email+password existing → link wallet
   │  │
   │  ├─ create_access_token(user.id)
   │  └─ create_refresh_token(user.id)
   │
   └─ Response: same TokenResponse as email login
```

### 4.3 Token Refresh Flow

```
api.js interceptor
│  on 401 response with original request
│
├─ POST /api/auth/refresh
│  Body: { refresh_token }
│  auth.py refresh()
│  ├─ decode_token(refresh_token)
│  ├─ SELECT user
│  ├─ create_access_token(user.id)
│  └─ create_refresh_token(user.id)
│
├─ update localStorage + Authorization header
└─ retry original request

[if refresh fails]
└─ clear localStorage → window.location.href = "/login"
```

---

## 5. Job Creation Flow (Full Path)

### 5.1 Frontend Trigger

```
Client Navbar.js (+ Post New Project button)
│
└─ setModalOpen(true)
   └─ PostProjectModal.js renders

PostProjectModal.js handleSubmit()
│  input: form { title, category, description, budget, skills, milestones[] }
│
│  step 1: POST /jobs    (Synchronous API)
│  step 2: blockchain    (Async, manual MetaMask flow)
│  step 3: POST /contracts
```

### 5.2 Step 1: Create Job in PostgreSQL

```
api.post('/jobs', { title, category, description, budget, skills, duration_days })
│
└─ jobs.py create_job()
   ├─ Depends(get_current_user) [JWT from api.js interceptor]
   ├─ verify user.role == "client"
   ├─ Job(...) SQLAlchemy insert
   ├─ db.commit()
   └─ Response: JobResponse { id, ... }
```

### 5.3 Step 2: On-Chain Contract Creation

```
ensureCorrectNetwork()
  └─ MetaMask window.ethereum.request wallet_switchEthereumChain

getSigner()
  └─ MetaMask provider.getSigner()
  └─ signer.getAddress()

contract.createContract(
  freelancerAddress,    ← currently '0x000...000' (no freelancer linked)
  title,
  termsCID,             ← currently ''
  totalAmountWei,
  deadlineUnix,
  milestoneDescriptions[],
  milestoneAmountsWei[]
)
  └─ MetaMask popup: "Confirm transaction"
  └─ tx.wait()
  └─ parse receipt.logs for ContractCreated
```

### 5.4 Step 3: Link Contracts in PostgreSQL

```
POST /contracts
  Body: {
    job_id,
    freelancer_id?,
    title,
    description,
    total_amount,
    deadline?,
    milestones: [{ description, amount, due_date }]
  }

└─ contracts.py create_contract()
   ├─ verify user.role == "client"
   ├─ verify milestone amounts sum == total_amount
   ├─ Contract INSERT
   ├─ ContractMilestone INSERT for each milestone
   └─ Response: ContractResponse
```

---

## 6. Backend Router → Service/Model Map

### 6.1 auth.py

```
auth.py
├─ hash_password(password)
├─ verify_password(plain, hashed)
├─ create_access_token(user_id)
├─ create_refresh_token(user_id)
├─ decode_token(token)
├─ get_current_user(Authorization header)
│  └─ SELECT user FROM users WHERE id == payload.sub
│
├─ POST /register
│  └─ User INSERT, TokenResponse
├─ POST /login
│  └─ SELECT + verify_password, TokenResponse
├─ POST /admin/login
│  └─ SELECT AdminAccount, TokenResponse
├─ POST /refresh
│  └─ verify refresh token, issue new pair
└─ GET /me
   └─ UserResponse
```

### 6.2 wallet_auth.py

```
wallet_auth.py
├─ _get_redis(request)
│
├─ GET /auth/wallet/challenge?address
│  └─ Redis SETEX nonce:{address} nonce 300
│
├─ GET /auth/wallet/status?address
│  └─ SELECT user WHERE wallet_address == address
│
└─ POST /auth/wallet/login
   Body: { address, signature, role?, email?, password?, username? }
   │
   ├─ Redis GET/DELETE nonce
   ├─ encode_defunct + Account.recover_message
   ├─ [Flow A] CREATE user with wallet_address
   ├─ [Flow B] CREATE user with email+wallet_address
   ├─ [Flow C] UPDATE existing user wallet_address
   └─ create_access_token + create_refresh_token
```

### 6.3 jobs.py

```
jobs.py
├─ GET /jobs
│  └─ SELECT Job WHERE ... optional filters
│
├─ POST /jobs
│  └─ Job INSERT (client_id from JWT user)
│
├─ PUT /{job_id}/on-chain-id
│  └─ Job UPDATE on_chain_job_id
│     ← triggered by PostProjectModal.js after ContractCreated event
│
├─ GET /{job_id}
│  └─ Job + latest Contract + ContractMilestones
│
├─ PUT /{job_id}
│  └─ Job UPDATE
│
└─ DELETE /{job_id}
   └─ Job DELETE
```

### 6.4 contracts.py

```
contracts.py
├─ POST /contracts
│  Body: { job_id, freelancer_id?, title, description, total_amount, deadline?, milestones[] }
│  └─ Contract INSERT + ContractMilestone INSERT per milestone
│
├─ GET /contracts
│  └─ Contract + ContractMilestone WHERE client_id OR freelancer_id == current_user
│
├─ GET /{contract_id}
│  └─ Contract + ContractMilestone + Dispute + Proposals
│
├─ POST /{contract_id}/milestones/{index}/approve
│  └─ Milestone UPDATE status=approved
│     if all approved → Contract status=completed
│
└─ POST /{contract_id}/milestones/{index}/reject
   └─ Milestone UPDATE back to pending, clear deliverable
```

### 6.5 blockchain_service.py (Backend Read-Only)

```
backend blockchain_service.py
│  NOTE: Frontend does the actual tx. Backend only reads.
│
├─ get_web3()
│  └─ Web3.HTTPProvider(settings.rpc_url)
│
├─ get_contract()
│  └─ w3.eth.contract(address=settings.contract_address, abi=abi)
│     ← reads from backend/app/contracts/GigEscrow.json
│
├─ get_contract_state(on_chain_id)
│  └─ contract.functions.getContractDetails(on_chain_id).call()
│
├─ get_eth_balance(address)
│  └─ w3.eth.get_balance(address)
│
├─ to_wei(eth)
└─ from_wei(wei)
```

### 6.6 event_listener.py — Background Sync

```
event_listener.py (background polling every 5s)
│
├─ start_event_listener()
│  └─ asyncio.create_task(poll_events())
│
└─ poll_events()
   ├─ Redis GET last_processed_block
   ├─ w3.eth.block_number
   ├─ if current_block > last_block:
   │  └─ contract.events.ContractCreated.get_logs(from_block, to_block)
   │     ├─ for each event:
   │     │  └─ process_contract_created(contractId, client, db)
   │     │     └─ SELECT first Job with on_chain_job_id IS NULL
   │     │        → UPDATE Job SET on_chain_job_id = contractId
   │     └─ Redis SET last_processed_block = current_block
   └─ heartbeat update
```

---

## 7. Configuration & Secrets Map

| Variable | Where Used | Purpose |
|---|---|---|
| `REACT_APP_CONTRACT_ADDRESS` | `config/index.js`, `PostProjectModal.js` | Frontend contract instance address |
| `REACT_APP_BLOCKCHAIN_RPC` | `config/index.js`, `web3.js` | Default RPC URL |
| `REACT_APP_CHAIN_ID` | `config/index.js`, `web3.js` | Chain ID for network switch |
| `REACT_APP_API_URL` | `config/index.js`, `api.js` | Backend base URL |
| `DATABASE_URL` | `backend/app/config.py` → `database.py` | Postgres connection |
| `JWT_SECRET` | `backend/app/config.py` → `auth.py`, `wallet_auth.py` | Token signing |
| `REDIS_URL` | `backend/app/config.py` → `redis_client.py` | Nonce + event state |
| `CONTRACT_ADDRESS` | `backend/app/config.py` → `blockchain_service.py` | Backend contract instance |

**Frontend env loading:** CRA reads `frontend/.env` at server startup. Changes require `npm start` restart.

---

## 8. Smart Contract API Surface

**File:** `contracts/contracts/GigEscrow.sol`  
**Address:** `0x5FbDB2315678afecb367f032d93F642f64180aa3`

### State Machine

```
ContractStatus:
  0 Created
  1 InProgress
  2 Completed
  3 Cancelled
  4 Disputed

MilestoneStatus:
  0 Pending
  1 Funded
  2 Submitted
  3 Approved
  4 Rejected
```

### Functions Called by FreeLedger

| Frontend Call | Contract Function | Payload | MetaMask Popup |
|---|---|---|---|
| `createContract()` | `createContract(_freelancer,_title,_termsCID,_totalAmount,_deadline,_msDesc[],_msAmt[])` | from PostProjectModal.js | ✅ Confirm tx |
| *(future)* | `fundContract(_contractId)` | ETH amount | ✅ Confirm tx |
| *(future)* | `submitMilestone(_contractId, _index, _cid)` | IPFS hash | ✅ Confirm tx |
| *(future)* | `approveMilestone(_contractId, _index)` | - | ✅ Confirm tx |
| *(future)* | `rejectMilestone(_contractId, _index)` | - | ✅ Confirm tx |

### Events Listened by Backend

| Event | Fields | Listener Action |
|---|---|---|
| `ContractCreated(uint256 indexed contractId, address indexed client, address indexed freelancer, uint256 totalAmount)` | contractId, client, freelancer, totalAmount | Updates `Job.on_chain_job_id` |

**Frontend ABI source:** `frontend/src/services/contractAbi.js`  
**Backend ABI source:** `backend/app/contracts/GigEscrow.json`

---

## 9. Deployment Script Connections

```
contracts/scripts/deploy.js
│
├─ hre.ethers.getContractFactory("GigEscrow")
├─ escrow.deploy()
├─ escrow.waitForDeployment()
├─ address = escrow.getAddress()
│
├─ fs.appendFileSync(backend/.env, `CONTRACT_ADDRESS=${address}`)
├─ fs.appendFileSync(frontend/.env, `REACT_APP_CONTRACT_ADDRESS=${address}`)
│
├─ fs.copyFileSync(artifacts file, backend/app/contracts/GigEscrow.json)
└─ fs.writeFileSync(scripts/contract-address.txt, deployment info)

Trigger: node scripts/deploy.js inside contracts/ directory
```

---

## 10. Data Models & Relationships

```
User
├─ id (pseudonymous: usr_<12hex>)
├─ email, password_hash, auth_method, wallet_address
├─ role: client / freelancer / admin
└─ relationships:
   ├─ jobs (as client)
   ├─ proposals (as freelancer)
   └─ contracts (as client or freelancer)

Job
├─ id (job_<12hex>)
├─ client_id → User.id
├─ title, description, budget, category, skills
├─ status: open / in_progress / filled
├─ on_chain_job_id (nullable → set by event listener)
└─ relationships:
   ├─ proposals
   └─ contract (latest)

Contract
├─ id (ct_<12hex>)
├─ job_id → Job.id
├─ client_id → User.id
├─ freelancer_id → User.id (nullable until assigned)
├─ total_amount, deadline, terms_cid
├─ on_chain_id (nullable)
├─ contract_address (nullable)
├─ status: pending_signatures → active → completed / cancelled / disputed
└─ milestones_rel

ContractMilestone
├─ id (ms_<12hex>)
├─ contract_id → Contract.id
├─ index
├─ description, amount, due_date
├─ status: pending → submitted → approved / rejected → paid
└─ deliverable_cid, submission_notes, submitted_at, approved_at

Proposal
├─ id (prop_<12hex>)
├─ job_id → Job.id
├─ freelancer_id → User.id
├─ cover_letter, bid_amount, estimated_days
└─ status: pending / accepted / rejected
```

---

## 11. localStorage Keys

| Key | Written By | Read By | Purpose |
|---|---|---|---|
| `access_token` | `Login.js`, `useAuth.js` | `AppContext.js`, `api.js` interceptor | JWT issued by backend after login/signup, used as `Bearer` auth for protected API calls |
| `refresh_token` | `Login.js`, `useAuth.js` | `api.js` interceptor | JWT used to request a new `access_token` when the old one expires |
| `user` | `Login.js`, `useAuth.js` | `AppContext.js`, navbar components | Cache current user object for UI and session rehydration |

**Note:**
- `access_token` is created by `create_access_token(user.id)` in the backend and returned in `TokenResponse`.
- `refresh_token` is created by `create_refresh_token(user.id)` and also returned in `TokenResponse`.
- Both are stored in browser `localStorage` after login/signup.
- `frontend/src/services/api.js` reads `access_token` and sets `Authorization: Bearer <token>` on outgoing requests.
- Protected backend routes authenticate requests using that token via `Depends(get_current_user)`.

---

## 12. Full Error Propagation Map

### MetaMask / Blockchain Errors

```
MetaMask popup cancelled
├─ auth.js: connectWallet() throws { message: 'MetaMask connection cancelled or failed.' }
│  └─ useAuth.js catch → setError(msg)
│     └─ Login.js → setError(result.message)
│
├─ web3.js: ensureCorrectNetwork() throws (not 4902)
│  └─ PostProjectModal.js catch → chainErr.message
│     └─ setPostError(...) → UI warning + backend still saved
│
└─ ethers.js transaction failure
   └─ PostProjectModal.js catch → chainErr.message
      └─ setPostError(...) → UI warning + backend still saved

Frontend API Errors
└─ axios interceptor response.use catch
   ├─ 401 → refresh flow
   └─ else → return Promise.reject(error)
      └─ component catch → err.response?.data?.detail
         └─ setError(msg)
```

---

## 13. File Dependency Graph (Imports)

```
frontend
├── App.js
│   ├── AppContext.js
│   └── Login.js, *Dashboard.js, *Navbar.js, etc.
│
├── pages/Login.js
│   ├── services/api.js
│   └── hooks/useAuth.js
│       └── services/auth.js
│           ├── services/api.js
│           └── services/web3.js
│               └── config/index.js
│               └── ethers (BrowserProvider, Contract, parseEther)
│
├── components/shared/PostProjectModal.js
│   ├── services/api.js
│   ├── services/web3.js
│   ├── services/contractAbi.js
│   └── config/index.js
│
├── context/AppContext.js
│
├── services/api.js
│   └── axios
│
├── services/web3.js
│   ├── config/index.js
│   └── ethers
│
└── config/index.js
    └── process.env.REACT_APP_*

backend
├── app/main.py
│   ├── config.py
│   ├── database.py
│   ├── redis_client.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── wallet_auth.py
│   │   ├── jobs.py
│   │   ├── contracts.py
│   │   ├── proposals.py
│   │   ├── users.py
│   │   ├── disputes.py
│   │   └── uploads.py
│   └── services/
│       ├── event_listener.py
│       │   ├── database.py
│       │   ├── blockchain_service.py
│       │   └── redis_client.py
│       └── blockchain_service.py
│           ├── config.py
│           └── app/contracts/GigEscrow.json
```

---

## 14. What Sarun Is Responsible For

**Nothing in this file is placeholder or commented-out.** Every file listed above is wired, reachable, and loaded in production.

### Auth
- Email/password login/register with JWT + auto-refresh
- MetaMask wallet sign-in (SIWE) with nonce protection
- Frontend state + localStorage session persistence

### Job Posting
- Client posts job → PostgreSQL
- Optional immediate on-chain escrow creation via MetaMask
- Links on-chain `contractId` back to job record

### Contract Management
- View contracts + milestones
- Approve/reject milestones (client)

### Blockchain
- Frontend ethers.js contract interaction (`PostProjectModal.js`)
- Backend event listener polling `ContractCreated` events
- Redis-backed nonce + checkpoint persistence

### Infrastructure
- Docker Compose: Postgres + Redis + Hardhat
- `start.sh` with health checks and auto-pull for Node 20 image
- Dev server port management

---

## 15. Quick Reference — Cheat Sheet

| Action | Where | Trigger | Result |
|---|---|---|---|
| Email login | `Login.js → handleLogin()` | form submit | JWT in localStorage |
| Wallet login | `Login.js → handleMetaMask()` | MetaMask button | JWT in localStorage |
| Connect wallet only | `PostProjectModal.js → connectWallet()` | Connect Wallet button | MetaMask accounts |
| Post project | `PostProjectModal.js → handleSubmit()` | Post Project button | Job + optional Contract |
| On-chain tx | `contract.createContract()` | MetaMask confirm | ContractCreated event |
| Link on-chain ID | `api.put('/jobs/{id}/on-chain-id')` | PostProjectModal.js | Job.on_chain_job_id |
| Backend sync | `event_listener.py poll_events()` | 5s cron | Job.on_chain_job_id updated |
| Refresh token | `api.js interceptor` | on 401 | new access_token |
| Check network | `web3.js ensureCorrectNetwork()` | before tx | chain switch prompt |

---
**End of FreeLedger Code Map**
