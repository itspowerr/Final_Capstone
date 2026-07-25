#!/bin/bash
# FreeLedger — One-command project start
# Starts: Docker (PostgreSQL + Redis + Hardhat + contract deploy) + Backend + Frontend + Admin

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "============================================"
echo "  FreeLedger — Starting All Services"
echo "============================================"
echo ""

stop_on_failure() {
  echo ""
  echo "ERROR: startup failed. Check the logs above."
  echo "Common fixes:"
  echo "  - Backend: cd $ROOT_DIR/backend && source venv/bin/activate && uvicorn app.main:app --reload"
  echo "  - Frontend: cd $ROOT_DIR/frontend && npm install && npm start"
  echo "  - Hardhat: cd $ROOT_DIR/docker && docker compose up -d --force-recreate hardhat"
  echo "  - DB: ensure postgres container is running and 'on_chain_job_id' column exists in jobs table"
  exit 1
}

# ─── 1. Start Docker infrastructure ───────────────────────────────────────
echo "[1/5] Starting Docker containers (PostgreSQL + Redis + Hardhat)..."
cd "$ROOT_DIR/docker"

# Ensure hardhat is using node:20 image (matches installed Hardhat engine reqs)
if ! docker images node:20:latest --format "{{.Repository}}:{{.Tag}}" >/dev/null 2>&1; then
  echo "  Pulling node:20 image for Hardhat container..."
  docker pull node:20
fi

docker compose up -d
echo "  ✓ Docker containers starting"
echo ""

# ─── 2. Wait for Hardhat to be ready (deploy happens inside container) ────
echo "[2/5] Waiting for Hardhat node + contract deployment..."
HARDHAT_READY=0
DEPLOYED_ADDRESS_FILE="$ROOT_DIR/contracts/.contract-address"
CONTRACT_ADDRESS=""
for i in $(seq 1 60); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8545 2>/dev/null || echo "000")
  if [ "$CODE" != "000" ]; then
    if [ -f "$DEPLOYED_ADDRESS_FILE" ]; then
      CONTRACT_ADDRESS=$(cat "$DEPLOYED_ADDRESS_FILE")
    fi
    if [ -n "$CONTRACT_ADDRESS" ]; then
      CONTRACT_CODE=$(curl -s -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getCode\",\"params\":[\"$CONTRACT_ADDRESS\",\"latest\"],\"id\":1}" \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',''))" 2>/dev/null)
      if [ -n "$CONTRACT_CODE" ] && [ "$CONTRACT_CODE" != "0x" ]; then
        echo "  ✓ Hardhat ready + GigEscrow deployed at $CONTRACT_ADDRESS"
        HARDHAT_READY=1
        break
      fi
    fi
  fi
  echo "  Waiting... ($i/60)"
  sleep 3
done

if [ "$HARDHAT_READY" -ne 1 ]; then
  echo "  WARNING: Hardhat worker did not confirm contract deployment in time"
  echo "           Continuing anyway — you may need to run:"
  echo "           cd $ROOT_DIR/docker && docker compose up -d --force-recreate hardhat"
  # Fallback: try reading the .contract-address file anyway
  if [ -f "$DEPLOYED_ADDRESS_FILE" ]; then
    CONTRACT_ADDRESS=$(cat "$DEPLOYED_ADDRESS_FILE")
  else
    CONTRACT_ADDRESS="0x5FbDB2315678afecb367f032d93F642f64180aa3"
  fi
fi

# Update .env files with the actual deployed contract address
if [ -n "$CONTRACT_ADDRESS" ]; then
  echo "  Syncing contract address to .env files..."
  if grep -q "^REACT_APP_CONTRACT_ADDRESS=" "$ROOT_DIR/frontend/.env" 2>/dev/null; then
    sed -i "s|^REACT_APP_CONTRACT_ADDRESS=.*|REACT_APP_CONTRACT_ADDRESS=$CONTRACT_ADDRESS|" "$ROOT_DIR/frontend/.env"
  else
    echo "REACT_APP_CONTRACT_ADDRESS=$CONTRACT_ADDRESS" >> "$ROOT_DIR/frontend/.env"
  fi
  if grep -q "^CONTRACT_ADDRESS=" "$ROOT_DIR/backend/.env" 2>/dev/null; then
    sed -i "s|^CONTRACT_ADDRESS=.*|CONTRACT_ADDRESS=$CONTRACT_ADDRESS|" "$ROOT_DIR/backend/.env"
  else
    echo "CONTRACT_ADDRESS=$CONTRACT_ADDRESS" >> "$ROOT_DIR/backend/.env"
  fi
  echo "  ✓ .env files updated to $CONTRACT_ADDRESS"
fi
echo ""

# ─── 3. Start Backend (FastAPI) ───────────────────────────────────────────
echo "[3/5] Starting backend (uvicorn)..."
cd "$ROOT_DIR/backend"
if [ ! -d "venv" ]; then
  echo "  Creating Python venv..."
  python3 -m venv venv
fi
source venv/bin/activate
if [ -f requirements.txt ]; then
  pip install -r requirements.txt >/dev/null 2>&1 || true
fi
echo "  Starting uvicorn..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to become healthy (retry loop — reloader adds startup delay)
echo "  Waiting for backend to become healthy..."
BACKEND_HEALTHY=0
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health | grep -q "200"; then
    echo "  ✓ Backend ready (PID: $BACKEND_PID) on http://localhost:8000"
    BACKEND_HEALTHY=1
    break
  fi
  sleep 1
done
if [ "$BACKEND_HEALTHY" != "1" ]; then
  echo "  ✗ Backend did not become healthy on http://localhost:8000/health"
  stop_on_failure
fi
echo ""

# ─── 4. Start Frontend (CRA) ──────────────────────────────────────────────
echo "[4/5] Starting frontend (React)..."
cd "$ROOT_DIR/frontend"
npm install --silent 2>/dev/null || true
PORT=3000 npm start &
FRONTEND_PID=$!
echo "  ✓ Frontend starting (PID: $FRONTEND_PID) on http://localhost:3000"
echo ""

# ─── 5. Start Admin Frontend ──────────────────────────────────────────────
echo "[5/5] Starting admin frontend..."
REACT_APP_ADMIN_MODE=true PORT=3001 npm start &
ADMIN_PID=$!
echo "  ✓ Admin frontend starting (PID: $ADMIN_PID) on http://localhost:3001"
echo ""

echo "============================================"
echo "  All services starting!"
echo "============================================"
echo ""
echo "  Frontend:    http://localhost:3000"
echo "  Admin:       http://localhost:3001"
echo "  Backend API: http://localhost:8000/docs"
echo "  Hardhat RPC: http://localhost:8545"
echo ""
echo "  NOTE: if Hardhat RPC shows issues, restart it with:"
echo "  cd $ROOT_DIR/docker && docker compose up -d --force-recreate hardhat"
echo "  NOTE: if database schema drifts, run the repair SQL from Saruns_Capstone_Details.md"
echo ""
echo "  Press Ctrl+C to stop all services"
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID $ADMIN_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait
