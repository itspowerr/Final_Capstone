#!/bin/bash
# FreeLedger — Data Migration Script
# Migrates PostgreSQL + IPFS from old dev server to new Dokploy production server.
#
# Usage:
#   export OLD_PASS="1234"
#   export NEW_PASS="1q2w3e4r5t"
#   ./migrate_data.sh
#
# Requires: sshpass

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
OLD_HOST="100.89.59.6"
OLD_USER="capstone"
OLD_CODE="/home/capstone/capstone"

NEW_HOST="147.93.168.28"
NEW_USER="power"
NEW_CODE="/etc/dokploy/compose/freeledger-infra-b9maly/code"
NEW_IPFS_TARGET="$NEW_CODE/docker/ipfs/data"

BACKEND_SERVICE="freeledger-backend-em9tim"

OLD_PASS="${OLD_PASS:-}"
NEW_PASS="${NEW_PASS:-}"

DUMP_FILE="/tmp/freeledger_migrate_$(date +%Y%m%d_%H%M%S).sql"
IPFS_TAR="/tmp/freeledger_ipfs_$(date +%Y%m%d_%H%M%S).tar.gz"

# ─── Helpers ─────────────────────────────────────────────────────────────────
red()    { echo -e "\033[0;31m$1\033[0m"; }
green()  { echo -e "\033[0;32m$1\033[0m"; }
yellow() { echo -e "\033[0;33m$1\033[0m"; }
step()   { echo -e "\n  \033[0;36m[-- $1 --]\033[0m"; }
ok()     { echo -e "  $(green '[OK]') $1"; }
fail()   { echo -e "  $(red '[FAIL]') $1"; exit 1; }

# Run a command with sudo on the remote server (correctly pipes password via SSH)
remote_sudo() {
  local cmd_str
  printf -v cmd_str '%q ' "$@"
  sshpass -p "$NEW_PASS" ssh -o StrictHostKeyChecking=no "$NEW_USER@$NEW_HOST" \
    "echo '$NEW_PASS' | sudo -S $cmd_str"
}

# Run a command on the old server (no sudo)
old_run() {
  sshpass -p "$OLD_PASS" ssh -o StrictHostKeyChecking=no "$OLD_USER@$OLD_HOST" "$@"
}

# ─── Pre-flight ──────────────────────────────────────────────────────────────
if [ -z "$OLD_PASS" ] || [ -z "$NEW_PASS" ]; then
  echo "ERROR: Set OLD_PASS and NEW_PASS environment variables."
  echo "  export OLD_PASS='1234'"
  echo "  export NEW_PASS='1q2w3e4r5t'"
  exit 1
fi
if ! command -v sshpass &>/dev/null; then
  fail "sshpass is required. Install: brew install sshpass"
fi

echo ""
echo "  +----------------------------------------+"
echo "  |     FreeLedger Data Migration Script   |"
echo "  +----------------------------------------+"
echo ""
echo "  Old: $OLD_USER@$OLD_HOST"
echo "  New: $NEW_USER@$NEW_HOST"
echo ""

# ─── Verify connectivity ─────────────────────────────────────────────────────
step "Verifying SSH connectivity..."
old_run "echo OK" || fail "Cannot SSH to old server"
sshpass -p "$NEW_PASS" ssh -o StrictHostKeyChecking=no "$NEW_USER@$NEW_HOST" \
  "echo OK" || fail "Cannot SSH to new server"

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 1 — PostgreSQL
# ═════════════════════════════════════════════════════════════════════════════

step "Scaling down backend (prevents writes during restore)..."
remote_sudo docker service scale "$BACKEND_SERVICE"=0 || true
sleep 3

step "Dumping PostgreSQL from old server..."
old_run "docker exec freeledger-db pg_dump -U freeledger --schema=freeledger --no-owner --no-privileges freeledger" > "$DUMP_FILE"
ok "Dump created ($(wc -c < "$DUMP_FILE") bytes)"

step "Copying dump to new server (no sudo needed)..."
sshpass -p "$NEW_PASS" ssh -o StrictHostKeyChecking=no "$NEW_USER@$NEW_HOST" \
  "cat > /tmp/freeleder_dump.sql" < "$DUMP_FILE"
ok "Copied to /tmp/freeleder_dump.sql"

step "Restoring PostgreSQL..."
echo "  Dropping old schema..."
remote_sudo docker exec freeledger-db psql -U freeledger -d freeledger \
  -c "DROP SCHEMA IF EXISTS freeledger CASCADE;" || fail "DROP SCHEMA failed"

echo "  Copying dump into container..."
remote_sudo docker cp /tmp/freeleder_dump.sql freeledger-db:/tmp/freeleder_dump.sql
echo "  Restoring from inside container..."
remote_sudo docker exec freeledger-db psql -U freeledger -d freeledger \
  -f /tmp/freeleder_dump.sql || fail "Restore failed"
remote_sudo docker exec freeledger-db rm /tmp/freeleder_dump.sql
ok "PostgreSQL restored"

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 2 — IPFS
# ═════════════════════════════════════════════════════════════════════════════

step "Stopping IPFS container on new server..."
remote_sudo docker stop freeledger-ipfs || true
remote_sudo docker rm freeledger-ipfs 2>/dev/null || true

step "Transferring IPFS data from old server..."

echo "  Creating tar archive from old server..."
old_run "tar czf - -C $OLD_CODE/docker/ipfs data" > "$IPFS_TAR"
ok "IPFS tar created ($(wc -c < "$IPFS_TAR") bytes)"

echo "  Copying to new server..."
sshpass -p "$NEW_PASS" ssh -o StrictHostKeyChecking=no "$NEW_USER@$NEW_HOST" \
  "cat > /tmp/freeleder_ipfs.tar.gz" < "$IPFS_TAR"
ok "IPFS tar copied to new server"

echo "  Extracting to $NEW_IPFS_TARGET..."
remote_sudo mkdir -p "$NEW_IPFS_TARGET"
remote_sudo tar xzf /tmp/freeleder_ipfs.tar.gz -C "$NEW_CODE/docker/ipfs"
remote_sudo rm -f /tmp/freeleder_ipfs.tar.gz
ok "IPFS data extracted"

# Configure IPFS CORS
echo "  Setting up IPFS CORS config..."
CONFIG_EXISTS=$(old_run "test -f $OLD_CODE/docker/ipfs/config.sh && echo 1 || echo 0")
if [ "$CONFIG_EXISTS" = "1" ]; then
  old_run "cat $OLD_CODE/docker/ipfs/config.sh" > /tmp/ipfs_config.sh
else
  cat > /tmp/ipfs_config.sh << 'EOF'
#!/bin/sh
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "POST", "GET"]'
EOF
fi

# Write to /tmp on new server (no sudo), then sudo-mv into place
sshpass -p "$NEW_PASS" ssh -o StrictHostKeyChecking=no "$NEW_USER@$NEW_HOST" \
  "cat > /tmp/ipfs_config.sh" < /tmp/ipfs_config.sh
remote_sudo mkdir -p "$NEW_CODE/docker/ipfs"
remote_sudo mv /tmp/ipfs_config.sh "$NEW_CODE/docker/ipfs/config.sh"
remote_sudo chmod +x "$NEW_CODE/docker/ipfs/config.sh"
ok "config.sh ready"

# Ensure config.sh is mounted in docker-compose.yml
echo "  Updating docker-compose.yml..."
MOUNT_EXISTS=$(sshpass -p "$NEW_PASS" ssh -o StrictHostKeyChecking=no "$NEW_USER@$NEW_HOST" \
  "grep -c 'config.sh' $NEW_CODE/docker/docker-compose.yml" || echo "0")
if [ "$MOUNT_EXISTS" -eq 0 ]; then
  remote_sudo sed -i '/- \.\/ipfs\/data:\/data\/ipfs/a\
      - \.\/ipfs\/config.sh:\/container-init.d\/config.sh' \
    "$NEW_CODE/docker/docker-compose.yml"
  ok "docker-compose.yml updated"
else
  ok "config.sh mount already present"
fi

step "Starting IPFS container..."
remote_sudo docker compose -f "$NEW_CODE/docker/docker-compose.yml" up -d ipfs || fail "IPFS start failed"
sleep 5
ok "IPFS container started"

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 3 — Restart backend
# ═════════════════════════════════════════════════════════════════════════════

step "Scaling backend back up..."
remote_sudo docker service scale "$BACKEND_SERVICE"=1 || true
ok "Backend scaled up"

# ═════════════════════════════════════════════════════════════════════════════
#  PHASE 4 — Verify
# ═════════════════════════════════════════════════════════════════════════════

step "Verification..."

echo "  Database users:"
remote_sudo docker exec freeledger-db psql -U freeledger -d freeledger \
  -c "SELECT count(*) AS user_count FROM freeledger.users;" || yellow "  DB check failed"

echo "  IPFS status:"
remote_sudo docker inspect freeledger-ipfs --format='{{.State.Status}}' || yellow "  IPFS check failed"

echo "  Backend service:"
sleep 5
remote_sudo docker service ps "$BACKEND_SERVICE" --format='{{.Name}} {{.CurrentState}}' || true

echo ""
echo "  +----------------------------------------+"
echo "  |  Migration complete!                   |"
echo "  +----------------------------------------+"
echo ""
echo "  Local files retained:"
echo "    PostgreSQL dump:  $DUMP_FILE"
echo "    IPFS archive:     $IPFS_TAR"
echo ""
echo "  On new server:  /tmp/freeleder_dump.sql (dump backup)"
echo ""

rm -f /tmp/ipfs_config.sh
