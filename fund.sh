#!/usr/bin/env bash
# FreeLedger — Fund test wallets
# Send test ETH from Hardhat accounts to any address.
# Run: ./fund.sh

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Check node is available
if ! command -v node &>/dev/null; then
    echo -e "${RED}Error: Node.js not found. Install it first.${NC}"
    exit 1
fi

# Check Hardhat is running
if ! curl -s http://127.0.0.1:8545 -X POST -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' &>/dev/null; then
    echo -e "${RED}Error: Hardhat node not running on port 8545.${NC}"
    echo -e "Start Docker first: ${YELLOW}docker compose up -d${NC}"
    exit 1
fi

echo ""
echo -e "${BOLD}FreeLedger Test Wallet Funder${NC}"
echo "=============================="
echo ""

# Ask for wallet address
read -p "MetaMask wallet address (0x...): " wallet

if [[ ! "$wallet" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
    echo -e "${RED}Invalid address. Must be 0x followed by 40 hex characters.${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}How much ETH?${NC}"
echo "  1) 100 ETH"
echo "  2) 500 ETH"
echo "  3) 1000 ETH (default)"
echo "  4) Custom amount"
echo ""
read -p "Choose [1-4, press Enter for 1000]: " amount_choice

case "$amount_choice" in
    1) amount="100" ;;
    2) amount="500" ;;
    3|"") amount="1000" ;;
    4)
        read -p "Enter amount in ETH: " amount
        if ! [[ "$amount" =~ ^[0-9]+(\.[0-9]+)?$ ]] || [ "$(echo "$amount <= 0" | bc)" -eq 1 ] 2>/dev/null; then
            echo -e "${RED}Invalid amount.${NC}"
            exit 1
        fi
        ;;
    *)
        echo -e "${RED}Invalid choice.${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${YELLOW}Sending ${amount} ETH to ${wallet}...${NC}"
echo ""

node "$ROOT_DIR/scripts/fund-wallet.js" "$wallet" "$amount"
