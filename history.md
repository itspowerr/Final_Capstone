# FreeLedger Project - Development History

## Project Overview
FreeLedger is a decentralized freelance platform with Ethereum smart contract escrow, IPFS decentralized storage, and MetaMask wallet authentication. This document tracks the development history of the `Sarun_Capstone` directory.

**Team**: Sarun Mahrajan (PM/Backend/Blockchain), Bijee Dangol (Frontend), Pawan Poudel (Backend/Database), Anushree Pradhan (Backend/API), Runa Maphu (Workflow/Junior Backend)
**Supervisor**: Subit Timalsina
**Institution**: Taylors University, Malaysia

---

## Codebase Structure (as of discovery)

### Three Related Codebases Found

| Directory | Description |
|-----------|-------------|
| `/home/sarun/Desktop/Sarun_Capstone/` | **Current working directory** - Frontend + Docker, no backend yet |
| `/home/sarun/Desktop/Capstonev2_notworking/` | Complete full-stack project with backend, frontend, Docker, K8s |
| `/home/sarun/Desktop/anushree-fix/` | Older/partial snapshot of the project |

---

## Sarun_Capstone Project Structure

```
Sarun_Capstone/
├── docker/
│   ├── docker-compose.yml          # PostgreSQL 15 + Redis 7
│   └── postgres/
│       └── init.sql                # Full schema: 10 tables, 7 enums
└── frontend/                       # React 19 + CRA
    ├── src/
    │   ├── App.js                  # Routes with admin/client/freelancer modes
    │   ├── pages/
    │   │   ├── Login.js            # Main login/register page
    │   │   ├── Landing.js
    │   │   ├── admin/
    │   │   │   ├── Login.js        # Admin login
    │   │   │   ├── Dashboard.js
    │   │   │   ├── AdminUsers.js
    │   │   │   ├── AdminJobs.js
    │   │   │   ├── AdminProposals.js
    │   │   │   ├── AdminContracts.js
    │   │   │   └── AdminDisputes.js
    │   │   ├── client/
    │   │   │   ├── Dashboard.js
    │   │   │   ├── ExploreJobs.js
    │   │   │   ├── MyContracts.js
    │   │   │   └── Profile.js
    │   │   └── freelancer/
    │   │       ├── Dashboard.js
    │   │       ├── FindJobs.js
    │   │       ├── MyContracts.js
    │   │       └── MyProfile.js
    │   ├── components/
    │   │   └── admin/Navbar.js
    │   ├── services/
    │   │   └── api.js              # Axios wrapper (created this session)
    │   └── css/                    # Organized CSS per role
    ├── package.json                # start:admin on port 3001
    └── .env                        # REACT_APP_API_URL=http://localhost:8000/api
```

---

## Docker Infrastructure

### docker-compose.yml
```yaml
services:
  postgres:
    image: postgres:15
    ports: ["5432:5432"]
    volumes: [postgres_data, ./postgres/init.sql]
    healthcheck: pg_isready
    memory_limit: 512M
  redis:
    image: redis:7
    ports: ["6379:6379"]
    volumes: [redis_data]
    healthcheck: redis-cli ping
    memory_limit: 128M
```

### Database Schema (init.sql)
- **7 ENUM types**: user_role, auth_method, experience_level, contract_status, milestone_status, dispute_status, dispute_decision
- **10 tables**: users, jobs, proposals, contracts, contract_milestones, disputes, threads, messages, notifications, admin_accounts
- All tables in `freeledger` schema with proper FK constraints and indexes

---

## Work Done in This Session

### 1. Backend Creation (Sarun_Capstone/backend/)

Created a minimal FastAPI authentication backend from scratch:

#### Files Created
```
backend/
├── .env                          # DB URL, JWT secret, JWT_SECRET, token expiry
├── requirements.txt              # Python dependencies
└── app/
    ├── __init__.py
    ├── main.py                   # FastAPI app, CORS, lifespan
    ├── config.py                 # Settings from .env (pydantic-settings)
    ├── database.py               # Async engine + get_db() dependency
    ├── models.py                 # SQLAlchemy models matching init.sql
    ├── schemas.py                # Pydantic request/response models
    └── routers/
        ├── __init__.py
        └── auth.py               # 4 endpoints: register, login, admin/login, me
```

#### Key Features Implemented
- **POST /api/auth/register** - Email, password (≥8 chars), username, role → JWT tokens
- **POST /api/auth/login** - Email + password → JWT tokens  
- **POST /api/auth/admin/login** - Username + password → checks `admin_accounts` table
- **GET /api/auth/me** - Returns current user (JWT protected)
- **POST /api/auth/refresh** - Refresh token rotation
- JWT: 30min access, 7-day refresh, HS256
- Password hashing: bcrypt via passlib
- Structured error responses: `{code, message}`
- CORS: localhost:3000, 3001, 8000

---

### 2. Backend Bugs Fixed

| Bug | Root Cause | Fix |
|-----|------------|-----|
| `ModuleNotFoundError: jose` | `python-jose` not installed | `pip install python-jose[cryptography]` |
| `ModuleNotFoundError: email-validator` | `EmailStr` requires it | Removed `EmailStr`, used `str` with validation |
| `bcrypt 5.0.0 AttributeError` | Incompatible with passlib | Downgraded to `bcrypt==3.2.2` |
| `asyncpg.DatatypeMismatchError: auth_method` | Column is ENUM, sent varchar | `Column(Enum(AuthMethod, name="auth_method", schema="freeledger"))` |
| `asyncpg.DatatypeMismatchError: role` | Column is ENUM, sent varchar | `Column(Enum(UserRole, name="user_role", schema="freeledger"))` |
| `asyncpg.DatatypeMismatchError: experience_level` | Column is ENUM | Added `ExperienceLevel` enum + mapped column |
| `asyncpg.DatatypeMismatchError: skills/industries/portfolio_cids` | Columns are JSONB | Changed `Text` → `JSON` with `default=list` |

---

### 3. Frontend Integration (Sarun_Capstone/frontend/)

#### Files Modified

| File | Changes |
|------|---------|
| `src/services/api.js` | **Created** - Axios wrapper with JWT interceptor, auto-refresh |
| `src/pages/Login.js` | Replaced `localStorage` mock with real API calls (`POST /auth/login`, `POST /auth/register`) |
| `src/pages/admin/Login.js` | Replaced `localStorage` mock with `POST /auth/admin/login` |
| `src/components/admin/Navbar.js` | Fixed anchor accessibility (`<a>` → `<Link>`), logout clears JWT tokens |
| `src/App.js` | Fixed admin route (`/` → `/login`), updated `ProtectedRoute` to use JWT auth |

#### Key Changes
- **Login.js**: Added `loading`/`error` states, disabled buttons during async calls, role values converted to lowercase (`client`/`freelancer`)
- **AdminLogin.js**: Same async pattern, redirects to `/admin/dashboard` on success
- **Navbar.js**: Logout now clears `access_token`, `refresh_token`, `user` from localStorage
- **ESLint fixes**: Moved imports to top, removed unused variables warnings

---

### 4. Frontend Build Verification

```bash
cd frontend && CI=true npm run build
# Result: Compiled successfully
# File sizes: 120.74 kB (JS), 9.01 kB (CSS)
```

---

## Verification Results

### Backend API Tests
```bash
# Register - SUCCESS
curl -X POST http://localhost:8000/api/auth/register \
  -d '{"email":"test@example.com","password":"password123","username":"Test User","role":"client"}'
# Returns: {access_token, refresh_token, user}

# Login - SUCCESS  
curl -X POST http://localhost:8000/api/auth/login \
  -d '{"email":"test@example.com","password":"password123"}'
# Returns: {access_token, refresh_token, user}

# Database verification
docker exec freeledger-db psql -U freeledger -d freeledger -c "SELECT * FROM freeledger.users;"
# Returns: usr_c79026f9a3ed | Test User | test@example.com | client | email | t
```

### Frontend Routes
| Mode | URL | Route |
|------|-----|-------|
| Main | `http://localhost:3000` | Landing |
| Main | `http://localhost:3000/login` | Login/Register |
| Main | `http://localhost:3000/client/*` | Client pages |
| Main | `http://localhost:3000/freelancer/*` | Freelancer pages |
| Admin | `http://localhost:3001/login` | AdminLogin |
| Admin | `http://localhost:3001/dashboard` | AdminDashboard (protected) |

---

## Current Project State

### ✅ Working
- PostgreSQL + Redis via Docker
- Backend auth API (register, login, admin login, me, refresh)
- JWT token management with auto-refresh
- Frontend login/register calling real API
- Admin login with username/password
- Frontend builds without errors

### 🔄 Ready for Next Phase
The following routers need implementation to match frontend pages:

| Router | Frontend Pages Needing It |
|--------|--------------------------|
| `/api/jobs` | ExploreJobs, CreateContract |
| `/api/proposals` | FindJobs, MyContracts |
| `/api/contracts` | MyContracts, ContractDetail |
| `/api/messages` | Messages |
| `/api/notifications` | NotificationBell |
| `/api/admin` | AdminUsers, AdminJobs, AdminProposals, AdminContracts, AdminDisputes |

---

## How to Run

```bash
# Start infrastructure
cd docker && docker-compose up -d

# Start backend
cd ../backend
./venv/bin/python -m uvicorn app.main:app --reload --port 8000

# Start frontend (main)
cd ../frontend
npm start                    # Port 3000

# Start frontend (admin)
cd ../frontend
npm run start:admin          # Port 3001 (REACT_APP_ADMIN_MODE=true)
```

---

## Key Technical Decisions

1. **No Alembic yet** - Used `Base.metadata.create_all()` on startup; existing `init.sql` handles schema
2. **Email + Password auth primary** - Wallet/MetaMask auth left as stub for future
3. **Admin separate from users** - Checks `admin_accounts` table + `role=admin`
4. **Structured errors** - All API errors return `{code, message}` for frontend handling
5. **Frontend on separate ports** - 3000 (main) and 3001 (admin) via `REACT_APP_ADMIN_MODE`
6. **JWT in localStorage** - Access + refresh tokens, auto-attached via Axios interceptor

---

## Next Session Priorities

1. **Jobs Router** - CRUD for job postings (client creates, freelancer views)
2. **Proposals Router** - Submit/list/accept proposals
3. **Contracts Router** - Create, sign, fund, milestone management
4. **Messages Router** - Threads + real-time chat
5. **Admin Router** - Full CRUD matching the 6 admin pages
6. **WebSocket** - Real-time messages/notifications (optional)

---

*Last updated: $(date)*
*Session: Backend auth + Frontend integration complete*


Schema = Pydantic model that defines the shape of data going in/out of the API. It's the contract between frontend and backend — FastAPI validates incoming JSON against the request schema, and serializes DB rows into the response schema format.
