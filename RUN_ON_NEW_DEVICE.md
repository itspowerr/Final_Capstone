# FreeLedger: Run on a New Device

This guide is for someone who cloned or downloaded the FreeLedger project and wants to run the full stack locally without deployment.

FreeLedger has four local parts:

1. Docker services: PostgreSQL, Redis, Hardhat blockchain, and IPFS
2. Backend: FastAPI on `http://localhost:8000`
3. User frontend: React on `http://localhost:3000`
4. Admin frontend: React admin mode on `http://localhost:3001`

## 1. Required software

Install these first:

- Git
- Docker Desktop
- Node.js LTS, recommended Node 20+
- Python 3.10, 3.11, or 3.12
- MetaMask browser extension, only for wallet/blockchain actions

Check them:

```powershell
git --version
docker --version
node --version
npm --version
python --version
```

Important: avoid Python 3.14 for this project. Some blockchain Python packages may fail to create or load correctly on Windows. If `python --version` shows Python 3.14, install Python 3.11 and run the project with Python 3.11.

Docker Desktop must be open before starting the project.

## 2. Clone the project

```powershell
git clone https://github.com/bisu617/cap.git
cd cap
```

If you downloaded a zip, extract it and open PowerShell inside the project root. The root folder should contain:

```text
backend/
frontend/
contracts/
docker/
start.ps1
start.sh
```

## 3. Easiest Windows start

From the project root, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

The script will:

- Check Docker, Python, Node, and npm
- Start PostgreSQL, Redis, Hardhat, and IPFS with Docker
- Wait for the local smart contract deployment
- Create `backend/.env` and `frontend/.env` if missing
- Sync the deployed contract address into the env files
- Create the backend virtual environment
- Install backend and frontend dependencies
- Start backend, user frontend, and admin frontend

Open:

```text
User frontend: http://localhost:3000
Admin frontend: http://localhost:3001
Backend docs:  http://localhost:8000/docs
Backend health: http://localhost:8000/api/health
Hardhat RPC:   http://localhost:8545
IPFS gateway:  http://localhost:8080
```

## 4. Manual setup if the script fails

### Step 1: Start Docker services

```powershell
cd docker
docker compose up -d
```

### Step 2: Create backend env

```powershell
cd ..\backend
Copy-Item .env.example .env
```

Check `backend/.env` includes:

```env
DATABASE_URL=postgresql+asyncpg://freeledger:freeledger_dev@localhost:5432/freeledger
REDIS_URL=redis://localhost:6379/0
CORS_ORIGINS=["http://localhost:3000","http://localhost:3001","http://localhost:8000","http://127.0.0.1:3000","http://127.0.0.1:3001"]
RPC_URL=http://127.0.0.1:8545
```

### Step 3: Start backend

Use Python 3.11 if available:

```powershell
py -3.11 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

If `py -3.11` is not available, use `python -m venv venv` only when `python --version` is 3.10, 3.11, or 3.12.

### Step 4: Create frontend env

Open a new terminal:

```powershell
cd frontend
Copy-Item .env.example .env
```

Check `frontend/.env` includes:

```env
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_BLOCKCHAIN_RPC=http://localhost:8545
REACT_APP_CHAIN_ID=31337
REACT_APP_IPFS_GATEWAY=http://localhost:8080
```

### Step 5: Start user frontend

```powershell
npm install
npm start
```

### Step 6: Start admin frontend

Open another terminal:

```powershell
cd frontend
npm run start:admin
```

## 5. Google login setup

Google login needs a Google OAuth Client ID. For local development, add these authorized JavaScript origins in Google Cloud Console:

```text
http://localhost:3000
http://localhost:3001
```

Then put the same client ID in both local env files:

```env
# frontend/.env
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id

# backend/.env
GOOGLE_CLIENT_ID=your-google-client-id
```

Restart frontend and backend after changing env files.

## 6. Fix common errors

### Login shows Network Error

This usually means the backend is not running or the frontend API URL is wrong.

Check this URL in the browser:

```text
http://localhost:8000/api/health
```

Check `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:8000/api
```

Then restart the frontend.

### `OPTIONS /api/auth/register 400 Bad Request`

This is usually a CORS origin mismatch. Make sure `backend/.env` has:

```env
CORS_ORIGINS=["http://localhost:3000","http://localhost:3001","http://localhost:8000","http://127.0.0.1:3000","http://127.0.0.1:3001"]
```

Restart the backend after changing it.

### `python -m venv venv` fails on Windows

Use Python 3.11:

```powershell
py -3.11 -m venv venv
```

If a broken `venv` folder already exists, delete only the backend virtual environment folder and recreate it:

```powershell
cd backend
Remove-Item -LiteralPath .\venv -Recurse -Force
py -3.11 -m venv venv
```

### `ImportError: DLL load failed while importing ckzg`

This can happen when Windows Application Control blocks a native Python dependency used by blockchain libraries. The safer fix is to use Python 3.11 in a clean virtual environment and reinstall dependencies:

```powershell
cd backend
Remove-Item -LiteralPath .\venv -Recurse -Force
py -3.11 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If the organization/device policy still blocks it, run on a personal machine without that App Control restriction or ask the device administrator to allow the package in the project virtual environment.

### Port already in use

FreeLedger uses these local ports:

```text
3000 user frontend
3001 admin frontend
8000 backend
8545 Hardhat
5432 PostgreSQL
6379 Redis
5001 IPFS API
8080 IPFS gateway
```

Close the app using the port, then restart FreeLedger.

## 7. Stop the project

If using `start.ps1`, press `Ctrl + C` in the script terminal.

To stop Docker services manually:

```powershell
cd docker
docker compose down
```

Only use this when you want to delete local database/IPFS/Redis data too:

```powershell
docker compose down -v
```