# FreeLedger

A decentralized freelance protocol with Web3 integration — combining IPFS for decentralized storage, Ethereum smart contracts for escrow payments, and a hybrid backend for speed and coordination.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, ethers.js, MetaMask |
| Backend | FastAPI, SQLAlchemy (async), PostgreSQL, Redis |
| Blockchain | Solidity 0.8.20, Hardhat (local chain), OpenZeppelin v5 |
| Messaging | WebSocket (real-time, threads + dispute chat) |
| Storage | IPFS (Kubo node, pinning, health monitoring) |

## Quick Start

```bash
./start.sh
```

Start Docker Desktop first, then run the script. This single command starts:

- Hardhat node (port 8545) via Docker
- IPFS Kubo node (ports 5001/8080) via Docker
- FastAPI backend (port 8000)
- React frontend (port 3001)

Logs are saved to `logs/` on each run.

## Project Structure

```
CapstoneV3-main/
├── start.sh                  # Cross-platform startup (macOS/Linux/Windows)
├── admin.sh                  # Admin account manager (add/delete/list)
├── fund.sh                   # Fund test wallets with ETH
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app, CORS, startup migrations
│   │   ├── models.py         # SQLAlchemy models (Users, Contracts, Milestones, Disputes)
│   │   ├── schemas.py        # Pydantic request/response schemas
│   │   ├── database.py       # Async DB session
│   │   ├── config.py         # Environment settings
│   │   ├── routers/
│   │   │   ├── auth.py       # Login, register, SIWE wallet auth, JWT
│   │   │   ├── jobs.py       # Create/browse jobs
│   │   │   ├── proposals.py  # Submit/accept proposals
│   │   │   ├── contracts.py  # Milestone management, IPFS terms upload
│   │   │   ├── messages.py   # WebSocket + REST messaging
│   │   │   ├── dispute_messages.py  # Dispute chat (admin ↔ client)
│   │   │   ├── notifications.py     # Notification CRUD + unread count
│   │   │   ├── disputes.py   # Dispute creation & resolution
│   │   │   ├── ipfs.py       # IPFS upload/download endpoints
│   │   │   ├── uploads.py    # Local file uploads
│   │   │   ├── admin.py      # Admin management endpoints + reports
│   │   │   └── users.py      # Profile management, search
│   │   └── services/
│   │       ├── blockchain_service.py  # Web3 contract interactions
│   │       ├── ipfs_service.py        # IPFS upload/download/pin
│   │       ├── ipfs_monitor.py        # IPFS health monitoring
│   │       ├── repin_service.py       # Background CID re-pinning
│   │       ├── event_listener.py      # Blockchain event sync (8 events)
│   │       ├── contract_service.py    # Contract business logic
│   │       ├── notification_service.py # Create notifications
│   │       ├── totp_service.py         # TOTP 2FA setup, verify, backup codes
│   │       └── audit_service.py       # Audit log transitions
│   └── requirements.txt
├── contracts/
│   ├── contracts/
│   │   └── GigEscrow.sol     # Solidity escrow contract (327 lines)
│   ├── scripts/
│   │   └── deploy.js         # Deployment script, updates .env files
│   └── hardhat.config.js
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── freelancer/   # FindJobs, MyContracts, MyProfile
│   │   │   ├── client/       # Dashboard, BrowseFreelancers, MyContracts, Profile
│   │   │   ├── shared/       # Messages (both roles)
│   │   │   └── admin/        # Dashboard, Reports, Users, UserSearch, Jobs, Proposals,
│   │   │                     # Contracts, Disputes, AuditLogs
│   │   ├── components/       # Navbar, PostProjectModal, TOTPSettings, layout
│   │   └── services/         # api.js, web3.js, contractAbi.js, ipfs.js
│   └── package.json
├── scripts/
│   └── fund-wallet.js        # Send test ETH from Hardhat accounts
└── docker/
    ├── docker-compose.yml    # Hardhat node + IPFS Kubo node
    └── ipfs/                 # IPFS config and persistent data
```

## Features

### Core
- **Job Posting & Bidding** — clients post gigs, freelancers submit proposals with bids
- **Dynamic Job Listings** — completed/hired jobs auto-hidden, real-time applicant count shown on each job
- **Smart Contract Escrow** — funds locked on-chain until milestones approved
- **Milestone-based Payments** — submit deliverables, client approves, ETH released automatically
- **Real-time Messaging** — WebSocket-powered thread-based inbox with read receipts, profile pictures
- **Chat Deletion** — freelancers and clients can delete conversations (with contract/dispute guards)
- **Auto-chat on Hire** — message auto-sent when client accepts a proposal
- **Auto-chat on Invitation** — thread created when client invites a freelancer to a job
- **Wallet Management** — MetaMask connect, max 2 accounts per wallet (1 client + 1 freelancer)
- **Notifications** — real-time bell for milestone updates, contract status changes, dispute activity
- **Profile Pictures** — upload to IPFS, shown in messages, navbars, and user search

### Dispute System
- **Dispute Initiation** — client or freelancer raises dispute, contract paused on-chain
- **Dispute Chat** — admin initiates real-time chat with both parties, either party replies after admin
- **Freelancer Disputes** — freelancers can raise disputes and chat with admin (e.g. client not accepting delivered work)
- **Dispute Resolution** — admin reviews deliverables, resolves with on-chain refund or release
- **Anonymous Disputes** — admin sees user IDs only, can search usernames separately
- **Chat Deletion Rules** — chat can only be deleted when:
  - Contract is `completed` or `cancelled`
  - Contract is `disputed` and dispute is `resolved`
  - No contract exists (pure messaging)
- **Dynamic Job Listings** — completed/hired jobs auto-hidden, real-time applicant count per job
- **Notification Bell** — real-time unread badge, mark read/all read, server-authoritative state

### IPFS Integration
- **Deliverable Upload** — freelancers upload work to IPFS, CID stored in DB and on-chain
- **Contract Terms** — contract details uploaded to IPFS as JSON, real CID stored on-chain
- **Pin Management** — background repin service every 6 hours for data persistence
- **Health Monitoring** — IPFS node health checked every 30 seconds

### Admin Dashboard
- **User Management** — list, add, suspend, delete users
- **User Search** — search by userId, username, email, or bio across all roles
- **Contract Overview** — view all contracts with status and milestone details
- **Dispute Management** — expandable cards with milestones, IPFS links, chat, resolution
- **Audit Logs** — track all system transitions with actor info, filterable by entity/action/actor
- **System Reports** — stats cards, bar charts, financial summary, recent activity feed
- **Admin Profile** — account settings, email notifications, TOTP 2FA management

### Auth & Roles
- **RBAC** — role assigned at registration, enforced on all endpoints
- **Role Required at Signup** — both email/password and MetaMask registration require explicit role selection
- **Wallet Limit** — one wallet can connect to max 2 accounts (1 client + 1 freelancer)
- **SIWE Authentication** — Sign-In with Ethereum for wallet-based login
- **TOTP 2FA** — optional two-factor authentication for all users (freelancer, client, admin)
  - Setup: scan QR code or enter secret manually, verify with 6-digit code
  - Login flow: tabs hidden, dedicated "Don't have your authenticator?" link toggles between authenticator code (6-digit) and backup code (XXXX-XXXX) input modes
  - Backup codes: 8 single-use codes generated at setup, SHA-256 hashed, consumed on use; downloadable as .txt file
  - Backup code recovery: after logging in with a backup code, profile shows a warning banner to reset 2FA and set up a new device
  - 2FA reset: `POST /auth/totp/reset` disables 2FA without requiring a TOTP code (only works with backup-code login token)
  - Rate limiting: 5 attempts per 60 seconds, cooldown persisted in localStorage across page refreshes
  - Works completely offline — no internet needed after scanning QR code

### Backend
- **Async Processing** — `asyncio.to_thread()` for blockchain/IPFS calls, non-blocking
- **Event Listener** — syncs 8 blockchain events back to PostgreSQL automatically
- **SIWE Authentication** — Sign-In with Ethereum for wallet-based login
- **Graceful On-chain Failures** — Hardhat restarts don't break the app, warnings logged instead

## Environment

Backend configuration in `backend/.env`:

```
DATABASE_URL=postgresql+asyncpg://freeledger:freeledger_dev@localhost:5432/freeledger
REDIS_URL=redis://localhost:6379
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
RPC_URL=http://127.0.0.1:8545
CLIENT_PRIVATE_KEY=0xac0974bec39c16e59c4d768b2e999bf8d01740335f01215ce953baeef316c3de
FREELANCER_PRIVATE_KEY=0x59c6995e611969122921531cecaed9f73164a9c8ea81f084b45000c7cb488698
JWT_SECRET=your-secret-here
```

Frontend configuration in `frontend/.env`:

```
REACT_APP_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_BLOCKCHAIN_RPC=http://127.0.0.1:8545
REACT_APP_CHAIN_ID=31337
REACT_APP_IPFS_GATEWAY=http://localhost:8080
```

## Fund Test Wallets

```bash
./fund.sh
```

Interactive script to send test ETH to any wallet:

- Enter your MetaMask wallet address
- Choose amount (100, 500, 1000 ETH or custom)
- ETH sent from Hardhat pre-funded accounts (10,000 ETH each)

## Management Scripts

### Admin Manager

```bash
./admin.sh
```

Interactive menu to manage admin accounts:

- **List** — shows all admins with username, email, status, and ID
- **Add** — create a new admin with username and password (bcrypt hashed)
- **Delete** — select an admin from the list to remove
- **Back** — exit the script (option 0)

## Smart Contract

`GigEscrow.sol` — Solidity 0.8.20 with OpenZeppelin v5:

- `createContract()` — deploy escrow with milestones
- `fundContract()` — client deposits ETH
- `submitMilestone()` — freelancer submits deliverable CID
- `approveMilestone()` — client approves, triggers payout (2.5% platform fee)
- `rejectMilestone()` — client rejects, resets to funded
- `raiseDispute()` — either party can dispute
- `resolveDispute()` — admin resolves with refund or release
- `cancelContract()` — client cancels before funding

## API Docs

Once running, visit `http://localhost:8000/docs` for the auto-generated Swagger UI.

### Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register with email/password |
| POST | `/api/auth/login` | Login with email/password (returns `requires_totp` if 2FA enabled) |
| POST | `/api/auth/admin/login` | Admin login (returns `requires_totp` if 2FA enabled) |
| POST | `/api/auth/totp/status` | Check if 2FA is enabled |
| POST | `/api/auth/totp/setup` | Generate TOTP secret + QR code + backup codes |
| POST | `/api/auth/totp/verify` | Confirm TOTP setup with code |
| POST | `/api/auth/totp/validate` | Complete login with TOTP code (rate-limited, returns `backup_login` flag) |
| POST | `/api/auth/totp/disable` | Disable 2FA (requires current TOTP code) |
| POST | `/api/auth/totp/reset` | Reset 2FA after backup code login (no TOTP code required) |

### Messaging Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/messages/send` | Send a message |
| GET | `/api/messages/inbox` | Get all messages |
| POST | `/api/messages/{id}/read` | Mark message as read |
| GET | `/api/messages/unread-count` | Count unread messages |
| DELETE | `/api/messages/thread/{partner_id}` | Delete entire conversation (contract/dispute guards) |
| WS | `/api/messages/ws/{user_id}` | Real-time WebSocket connection |

## License

Academic project — not for production use.
