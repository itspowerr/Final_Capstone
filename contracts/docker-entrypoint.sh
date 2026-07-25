#!/bin/sh
# FreeLedger Hardhat entrypoint
# 1. Wait for Hardhat node to be ready
# 2. Deploy GigEscrow contract
# 3. Keep container alive

set -e

echo "=== Installing npm dependencies ==="
npm install

echo "=== Starting Hardhat node in background ==="
npx hardhat node --hostname 0.0.0.0 &
HARDHAT_PID=$!

echo "=== Waiting for Hardhat node to be ready ==="
for i in $(seq 1 30); do
  if curl -s -o /dev/null http://localhost:8545; then
    echo "=== Hardhat node is ready ==="
    break
  fi
  echo "Waiting for Hardhat... ($i/30)"
  sleep 2
done

echo "=== Deploying GigEscrow contract ==="
npx hardhat run scripts/deploy.js --network localhost || \
  echo "WARNING: deploy script returned non-zero; Hardhat node continues running"
echo "=== Hardhat node running (PID: $HARDHAT_PID) ==="
wait $HARDHAT_PID
