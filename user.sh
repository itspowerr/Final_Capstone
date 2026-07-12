#!/usr/bin/env bash
# FreeLedger — User account manager
# Add, delete, or list freelancer/client accounts.
# Run: ./user.sh

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

find_python() {
    for candidate in \
        "$ROOT_DIR/backend/venv/bin/python3" \
        "$ROOT_DIR/backend/venv/bin/python" \
        "$ROOT_DIR/backend/.venv/bin/python3" \
        "$ROOT_DIR/backend/.venv/bin/python" \
        "$ROOT_DIR/backend/venv/Scripts/python.exe" \
        "$ROOT_DIR/backend/.venv/Scripts/python.exe"; do
        if [ -x "$candidate" ]; then
            echo "$candidate"
            return
        fi
    done
    if command -v python3 &>/dev/null; then
        echo "python3"
    elif command -v python &>/dev/null; then
        echo "python"
    else
        echo ""
    fi
}

PYTHON_BIN=$(find_python)
if [ -z "$PYTHON_BIN" ]; then
    echo "Error: No Python found. Install Python 3.10+ first."
    exit 1
fi

exec "$PYTHON_BIN" "$ROOT_DIR/user.py" "$@"
