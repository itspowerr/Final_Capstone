# FreeLedger

A blockchain-powered freelance platform using Ethereum smart contracts for secure gig escrow payments.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, ethers.js |
| Backend | FastAPI, SQLAlchemy (async), PostgreSQL, Redis |
| Blockchain | Solidity, Hardhat (local chain) |
| Messaging | WebSocket (real-time) |
| Storage | IPFS |

## Quick Start

```bash
./start.sh
```

This single command starts everything:

- start the Docker desktop first then run the script
- Smart contract deployment
- FastAPI backend (port 8000)
- React frontend (port 3001)

Logs are saved to `logs/` on each run.

## Project Structure

```
CapstoneV3-main/
├── start.sh                  # One-command startup (macOS/Linux/Windows)
├── admin.sh                  # Admin account manager (add/delete/list)
├── fund.sh                   # Fund test wallets with ETH
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app, CORS, startup migrations
│   │   ├── models.py         # SQLAlchemy models
│   │   ├── schemas.py        # Pydantic request/response schemas
│   │   ├── database.py       # Async DB session
│   │   ├── config.py         # Environment settings
│   │   ├── routers/          # API endpoints
│   │   │   ├── auth.py       # Login, register, JWT
│   │   │   ├── jobs.py       # Create/browse jobs
│   │   │   ├── proposals.py  # Submit/accept proposals
│   │   │   ├── contracts.py  # Milestone management
│   │   │   ├── messages.py   # WebSocket + REST messaging
│   │   │   ├── disputes.py   # Dispute resolution
│   │   │   └── users.py      # Profile management
│   │   └── services/         # Background workers
│   │       ├── event_listener.py  # Blockchain event sync
│   │       └── ...
│   └── requirements.txt
├── contracts/
│   └── contracts/
│       └── GigEscrow.sol     # Solidity escrow contract
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── freelancer/   # Job browse, contracts, profile
│   │   │   ├── client/       # Post jobs, browse freelancers
│   │   │   └── shared/       # Messages (both roles)
│   │   ├── components/       # Navbar, layout
│   │   └── services/api.js   # Axios instance
│   └── package.json
├── scripts/
│   └── fund-wallet.js        # Send test ETH from Hardhat accounts
└── docker/                   # Container configs
```

## Features

- **Job Posting & Bidding** — clients post gigs, freelancers submit proposals
- **Smart Contract Escrow** — funds locked on-chain until milestones approved
- **Real-time Messaging** — WebSocket-powered thread-based inbox
- **Wallet Management** — MetaMask connect, max 2 accounts per wallet
- **Dispute Resolution** — on-chain dispute system with admin decisions
- **IPFS Storage** — decentralized file storage for deliverables

## Environment

Backend configuration lives in `backend/.env`:

```
DATABASE_URL=postgresql+asyncpg://freeledger:freeledger_dev@localhost:5432/freeledger
REDIS_URL=redis://localhost:6379
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
JWT_SECRET=your-secret-here
```

Frontend configuration lives in `frontend/.env`:

```
REACT_APP_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
REACT_APP_API_URL=http://localhost:8000/api
```

## Fund Test Wallets

```bash
./fund.sh
```

Interactive script to send test ETH to any wallet:

- Enter your MetaMask wallet address
- Choose amount (100, 500, 1000 ETH or custom)
- ETH sent from Hardhat pre-funded accounts

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

## API Docs

Once running, visit `http://localhost:8000/docs` for the auto-generated Swagger UI.

## License

Academic project — not for production use.
