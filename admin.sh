#!/bin/bash
# FreeLedger — Admin account manager
# Add or delete admin accounts from the database

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# DB connection
export PGPASSWORD="freeledger_dev"
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="freeledger"
DB_NAME="freeledger"

psql_cmd() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A "$@"
}

hash_password() {
    python3 -c "
import bcrypt, sys
password = sys.argv[1].encode('utf-8')
salt = bcrypt.gensalt()
print(bcrypt.hashpw(password, salt).decode('utf-8'))
" "$1"
}

echo ""
echo -e "${BOLD}FreeLedger Admin Manager${NC}"
echo "========================"
echo ""

# Check psql is available
if ! command -v psql &>/dev/null; then
    echo -e "${RED}Error: psql not found. Install PostgreSQL client first.${NC}"
    exit 1
fi

# Check DB connection
if ! psql_cmd -c "\q" 2>/dev/null; then
    echo -e "${RED}Error: Cannot connect to database.${NC}"
    echo "Make sure PostgreSQL is running (docker compose up -d)"
    exit 1
fi

echo "What would you like to do?"
echo ""
echo "  1) Add admin account"
echo "  2) Delete admin account"
echo ""
read -p "Choose [1/2]: " choice

case "$choice" in
    1)
        echo ""
        echo -e "${CYAN}--- Add Admin Account ---${NC}"
        echo ""

        read -p "Username: " username
        if [ -z "$username" ]; then
            echo -e "${RED}Username cannot be empty.${NC}"
            exit 1
        fi

        # Check if username already exists
        existing=$(psql_cmd -c "SELECT id FROM freeledger.users WHERE username = '$username';")
        if [ -n "$existing" ]; then
            echo -e "${RED}Error: Username '$username' already exists.${NC}"
            exit 1
        fi

        read -s -p "Password: " password
        echo ""
        if [ -z "$password" ]; then
            echo -e "${RED}Password cannot be empty.${NC}"
            exit 1
        fi

        read -s -p "Confirm password: " password_confirm
        echo ""
        if [ "$password" != "$password_confirm" ]; then
            echo -e "${RED}Passwords do not match.${NC}"
            exit 1
        fi

        echo ""
        echo -e "${YELLOW}Hashing password...${NC}"
        password_hash=$(hash_password "$password")

        user_id="usr_$(python3 -c "import uuid; print(uuid.uuid4().hex[:12])")"
        admin_id="$(python3 -c "import uuid; print(str(uuid.uuid4()))")"

        echo -e "${YELLOW}Inserting into database...${NC}"

        # Insert user
        psql_cmd -c "
            INSERT INTO freeledger.users (id, username, password_hash, auth_method, role, is_active)
            VALUES ('$user_id', '$username', '$password_hash', 'email', 'admin', true);
        " 2>/dev/null

        if [ $? -ne 0 ]; then
            echo -e "${RED}Error: Failed to insert user.${NC}"
            exit 1
        fi

        # Insert admin_accounts record
        psql_cmd -c "
            INSERT INTO freeledger.admin_accounts (id, user_id, role)
            VALUES ('$admin_id', '$user_id', 'admin');
        " 2>/dev/null

        if [ $? -ne 0 ]; then
            echo -e "${RED}Error: Failed to create admin account record.${NC}"
            exit 1
        fi

        echo ""
        echo -e "${GREEN}Admin account created successfully!${NC}"
        echo -e "  Username: ${BOLD}$username${NC}"
        echo -e "  User ID:  $user_id"
        echo ""
        ;;

    2)
        echo ""
        echo -e "${CYAN}--- Delete Admin Account ---${NC}"
        echo ""

        # Fetch all admin users
        admins=$(psql_cmd -c "
            SELECT u.id, u.username
            FROM freeledger.users u
            WHERE u.role = 'admin'
            ORDER BY u.created_at;
        ")

        if [ -z "$admins" ]; then
            echo -e "${YELLOW}No admin accounts found.${NC}"
            exit 0
        fi

        echo "Admin accounts:"
        echo ""
        i=1
        while IFS='|' read -r id username; do
            echo "  $i) $username ($id)"
            ids[$i]="$id"
            i=$((i + 1))
        done <<< "$admins"

        echo ""
        read -p "Choose account to delete [1-$((i-1))]: " selection

        if ! [[ "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -lt 1 ] || [ "$selection" -ge "$i" ]; then
            echo -e "${RED}Invalid selection.${NC}"
            exit 1
        fi

        chosen_id="${ids[$selection]}"
        chosen_username=$(psql_cmd -c "SELECT username FROM freeledger.users WHERE id = '$chosen_id';")

        echo ""
        read -p "Delete '$chosen_username'? This cannot be undone. [y/N]: " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            echo -e "${YELLOW}Cancelled.${NC}"
            exit 0
        fi

        # Delete admin_accounts record first (FK constraint)
        psql_cmd -c "DELETE FROM freeledger.admin_accounts WHERE user_id = '$chosen_id';" 2>/dev/null
        # Delete user
        psql_cmd -c "DELETE FROM freeledger.users WHERE id = '$chosen_id';" 2>/dev/null

        echo ""
        echo -e "${GREEN}Admin account '$chosen_username' deleted.${NC}"
        echo ""
        ;;

    *)
        echo -e "${RED}Invalid choice.${NC}"
        exit 1
        ;;
esac
