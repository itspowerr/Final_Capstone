#!/bin/bash
# FreeLedger — One-command project start
# Starts: Docker (PostgreSQL + Redis + Hardhat + contract deploy) + Backend + Frontend
# Works on: macOS, Linux, Windows (Git Bash / WSL)

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ─── Cross-platform helpers ────────────────────────────────────────────────
OS="$(uname -s)"
PYTHON=""
PYTHON_BINARIES="python3 python"

for bin in $PYTHON_BINARIES; do
  if command -v "$bin" >/dev/null 2>&1; then
    PYTHON="$bin"
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo "ERROR: python3 (or python) not found in PATH"
  exit 1
fi

sed_inplace() {
  # Usage: sed_inplace 's/foo/bar/' file
  if [ "$OS" = "Darwin" ]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

# ─── Logging setup ─────────────────────────────────────────────────────────
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/start_$(date +%Y%m%d_%H%M%S).txt"
# Delete old log files, keep only the latest
ls -1t "$LOG_DIR"/start_*.txt 2>/dev/null | tail -n +2 | xargs rm -f 2>/dev/null || true

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()   { echo -e "$@" | tee -a "$LOG_FILE"; }
ok()    { echo -e "  ${GREEN}[OK]${NC} $1" | tee -a "$LOG_FILE"; }
fail()  { echo -e "  ${RED}[FAILED]${NC} $1" | tee -a "$LOG_FILE"; }
warn()  { echo -e "  ${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"; }
step()  { echo -e "  ${CYAN}[step]${NC} $1" | tee -a "$LOG_FILE"; }

stop_on_failure() {
  log ""
  log "${RED}ERROR:${NC} startup failed. Check the logs above."
  log "Full log saved to: $LOG_FILE"
  log "Common fixes:"
  log "  - Backend:  cd $ROOT_DIR/backend && source venv/bin/activate && uvicorn app.main:app --reload"
  log "  - Frontend: cd $ROOT_DIR/frontend && npm install && npm start"
  log "  - Hardhat:  cd $ROOT_DIR/docker && docker compose up -d --force-recreate hardhat"
  log ""
  log "  ╔══════════════════════════════════════╗"
  log "  ║            OOPS...                   ║"
  log "  ║     Something went wrong.            ║"
  log "  ╚══════════════════════════════════════╝"
  exit 1
}

log ""
log "  ╔══════════════════════════════════════════════════════╗"
log "  ║                                                      ║"
log "  ║  ████████ ███████ ███████ ████████                   ║"
log "  ║  ██       ██      ██         ██                      ║"
log "  ║  ██████   █████   █████      ██                      ║"
log "  ║  ██       ██      ██         ██                      ║"
log "  ║  ██       ███████ ███████    ██                      ║"
log "  ║                                                      ║"
log "  ║            ── L E D G E R ──                         ║"
log "  ║                                                      ║"
log "  ╚══════════════════════════════════════════════════════╝"
log ""
log "  Freelance · Escrow · Blockchain"
log ""
log "============================================"
log "  FreeLedger — Starting All Services"
log "============================================"
log ""

# ─── Kill stale processes on ports 8000 and 3000/3001 ──────────────────────
step "Cleaning stale processes..."
if [ "$OS" = "Darwin" ] || [ "$OS" = "Linux" ]; then
  for port in 8000 3000 3001; do
    STALE_PIDS=$(lsof -ti:"$port" 2>/dev/null || true)
    if [ -n "$STALE_PIDS" ]; then
      warn "Killing stale process(es) on port $port: $STALE_PIDS"
      echo "$STALE_PIDS" | xargs kill -9 2>/dev/null || true
      sleep 1
    fi
  done
fi
ok "Stale processes cleaned"

# ─── 1. Start Docker infrastructure ───────────────────────────────────────
log "[1/5] Starting Docker containers (PostgreSQL + Redis + Hardhat)..."
cd "$ROOT_DIR/docker"

if ! docker images node:20:latest --format "{{.Repository}}:{{.Tag}}" >/dev/null 2>&1; then
  step "Pulling node:20 image for Hardhat container..."
  docker pull node:20 | tee -a "$LOG_FILE"
fi

docker compose up -d 2>&1 | tee -a "$LOG_FILE"
ok "Docker containers starting"
log ""

# ─── 2. Wait for Hardhat + contract deployment ────────────────────────────
log "[2/5] Waiting for Hardhat node + contract deployment..."
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
        | $PYTHON -c "import sys,json; print(json.load(sys.stdin).get('result',''))" 2>/dev/null)
      if [ -n "$CONTRACT_CODE" ] && [ "$CONTRACT_CODE" != "0x" ]; then
        ok "Hardhat ready + GigEscrow deployed at $CONTRACT_ADDRESS"
        HARDHAT_READY=1
        break
      fi
    fi
  fi
  step "Waiting... ($i/60)"
  sleep 3
done

if [ "$HARDHAT_READY" -ne 1 ]; then
  warn "Hardhat worker did not confirm contract deployment in time"
  warn "Continuing anyway — you may need to run:"
  warn "  cd $ROOT_DIR/docker && docker compose up -d --force-recreate hardhat"
  if [ -f "$DEPLOYED_ADDRESS_FILE" ]; then
    CONTRACT_ADDRESS=$(cat "$DEPLOYED_ADDRESS_FILE")
  else
    CONTRACT_ADDRESS="0x5FbDB2315678afecb367f032d93F642f64180aa3"
  fi
fi

# Update .env files with the actual deployed contract address
if [ -n "$CONTRACT_ADDRESS" ]; then
  step "Syncing contract address to .env files..."
  if grep -q "^REACT_APP_CONTRACT_ADDRESS=" "$ROOT_DIR/frontend/.env" 2>/dev/null; then
    sed_inplace "s|^REACT_APP_CONTRACT_ADDRESS=.*|REACT_APP_CONTRACT_ADDRESS=$CONTRACT_ADDRESS|" "$ROOT_DIR/frontend/.env"
  else
    echo "REACT_APP_CONTRACT_ADDRESS=$CONTRACT_ADDRESS" >> "$ROOT_DIR/frontend/.env"
  fi
  if grep -q "^CONTRACT_ADDRESS=" "$ROOT_DIR/backend/.env" 2>/dev/null; then
    sed_inplace "s|^CONTRACT_ADDRESS=.*|CONTRACT_ADDRESS=$CONTRACT_ADDRESS|" "$ROOT_DIR/backend/.env"
  else
    echo "CONTRACT_ADDRESS=$CONTRACT_ADDRESS" >> "$ROOT_DIR/backend/.env"
  fi
  ok ".env files updated to $CONTRACT_ADDRESS"
fi
log ""

# ─── 3. Start Backend (FastAPI) ───────────────────────────────────────────
log "[3/5] Starting backend (uvicorn)..."
cd "$ROOT_DIR/backend"
if [ ! -d "venv" ]; then
  step "Creating Python venv..."
  $PYTHON -m venv venv 2>&1 | tee -a "$LOG_FILE"
  ok "venv created"
fi

# Activate venv (Unix-only path; Windows Git Bash not supported for this)
if [ -f "$ROOT_DIR/backend/venv/bin/activate" ]; then
  source "$ROOT_DIR/backend/venv/bin/activate"
fi

if [ -f requirements.txt ]; then
  step "Installing Python dependencies..."
  pip install -r requirements.txt 2>&1 | tee -a "$LOG_FILE"
  if [ ${PIPESTATUS[0]} -ne 0 ]; then
    fail "pip install failed"
    stop_on_failure
  fi
  ok "Python dependencies installed"
fi

# Kill any lingering uvicorn on port 8000
if [ "$OS" = "Darwin" ] || [ "$OS" = "Linux" ]; then
  STALE=$(lsof -ti:8000 2>/dev/null || true)
  if [ -n "$STALE" ]; then
    step "Killing stale uvicorn on port 8000..."
    echo "$STALE" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
fi

step "Starting uvicorn..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > >(tee -a "$LOG_FILE") 2>&1 &
BACKEND_PID=$!

# Wait for backend to become healthy
step "Waiting for backend to become healthy..."
BACKEND_HEALTHY=0
for i in $(seq 1 30); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    ok "Backend ready (PID: $BACKEND_PID) on http://localhost:8000"
    BACKEND_HEALTHY=1
    break
  fi
  step "Waiting... ($i/30)"
  sleep 1
done
if [ "$BACKEND_HEALTHY" != "1" ]; then
  fail "Backend did not become healthy on http://localhost:8000/health"
  stop_on_failure
fi
log ""

# ─── 4. Start Frontend (CRA) ──────────────────────────────────────────────
log "[4/5] Starting frontend (React)..."
cd "$ROOT_DIR/frontend"
npm install --silent 2>/dev/null || true
PORT=3000 npm start > >(tee -a "$LOG_FILE") 2>&1 &
FRONTEND_PID=$!
ok "Frontend starting (PID: $FRONTEND_PID) on http://localhost:3000"
log ""

# ─── 5. Start Admin Frontend ──────────────────────────────────────────────
log "[5/5] Starting admin frontend..."
REACT_APP_ADMIN_MODE=true PORT=3001 npm start > >(tee -a "$LOG_FILE") 2>&1 &
ADMIN_PID=$!
ok "Admin frontend starting (PID: $ADMIN_PID) on http://localhost:3001"
log ""

log "============================================"
log ""
log "  ╔══════════════════════════════════════════╗"
log "  ║          🎉  GOOD TO GO  🎉              ║"
log "  ╚══════════════════════════════════════════╝"
log ""
log "  Frontend:    http://localhost:3000"
log "  Admin:       http://localhost:3001"
log "  Backend API: http://localhost:8000/docs"
log "  Hardhat RPC: http://localhost:8545"
log ""
log "  Full log saved to: $LOG_FILE"
log ""
log "  Press Ctrl+C to stop all services"
log ""

trap "kill $BACKEND_PID $FRONTEND_PID $ADMIN_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait
