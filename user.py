"""
FreeLedger — User account manager
Add, delete, or list freelancer/client accounts.
Run: ./user.sh
"""

import asyncio
import getpass
import os
import sys
import uuid

try:
    import asyncpg
except ImportError:
    sys.exit("asyncpg not found. Run: pip install asyncpg")

try:
    import bcrypt
except ImportError:
    sys.exit("bcrypt not found. Run: pip install bcrypt")


DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://freeledger:freeledger_dev@localhost:5432/freeledger",
)
if DB_URL.startswith("postgresql+asyncpg://"):
    DB_URL = DB_URL.replace("postgresql+asyncpg://", "postgresql://", 1)

GREEN  = "\033[0;32m"
RED    = "\033[0;31m"
YELLOW = "\033[0;33m"
CYAN   = "\033[0;36m"
BOLD   = "\033[1m"
DIM    = "\033[2m"
NC     = "\033[0m"

if sys.platform == "win32":
    os.system("")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def clear():
    os.system("cls" if sys.platform == "win32" else "clear")


async def list_users():
    conn = await asyncpg.connect(DB_URL)
    try:
        rows = await conn.fetch(
            """SELECT u.id, u.username, u.email, u.role, u.wallet_address,
                      u.is_active, u.created_at
               FROM freeledger.users u
               WHERE u.role IN ('freelancer', 'client')
               ORDER BY u.role, u.created_at"""
        )

        if not rows:
            print(f"\n{YELLOW}No user accounts found.{NC}\n")
            return

        freelancers = [r for r in rows if r["role"] == "freelancer"]
        clients = [r for r in rows if r["role"] == "client"]

        for label, group in [("Freelancers", freelancers), ("Clients", clients)]:
            print(f"\n{BOLD}{label} ({len(group)}):{NC}")
            print(f"  {'Username':<20} {'Email':<30} {'Wallet':<44} {'Status':<10}")
            print(f"  {'-'*20} {'-'*30} {'-'*44} {'-'*10}")
            for r in group:
                username = r["username"] or "-"
                email = r["email"] or "-"
                wallet = r["wallet_address"] or "-"
                status = f"{GREEN}active{NC}" if r["is_active"] else f"{RED}inactive{NC}"
                print(f"  {username:<20} {email:<30} {wallet:<44} {status}")
        print()
    finally:
        await conn.close()


async def add_user():
    print(f"\n{CYAN}--- Add User Account ---{NC}\n")
    print("  1) Freelancer")
    print("  2) Client\n")

    role_choice = input("Choose role [1/2]: ").strip()
    if role_choice == "1":
        role = "freelancer"
    elif role_choice == "2":
        role = "client"
    else:
        print(f"{RED}Invalid choice.{NC}")
        return

    print()
    username = input("Username: ").strip()
    if not username:
        print(f"{RED}Username cannot be empty.{NC}")
        return

    email = input("Email (optional, press Enter to skip): ").strip() or None

    password = getpass.getpass("Password: ")
    if not password:
        print(f"{RED}Password cannot be empty.{NC}")
        return

    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        print(f"{RED}Passwords do not match.{NC}")
        return

    wallet = input("MetaMask wallet address (optional, press Enter to skip): ").strip() or None

    conn = await asyncpg.connect(DB_URL)
    try:
        existing = await conn.fetchval(
            "SELECT id FROM freeledger.users WHERE username = $1", username
        )
        if existing:
            print(f"{RED}Error: Username '{username}' already exists.{NC}")
            return

        if wallet:
            wallet_owner = await conn.fetchval(
                "SELECT id FROM freeledger.users WHERE wallet_address = $1", wallet
            )
            if wallet_owner:
                print(f"{RED}Error: Wallet address already linked to another account.{NC}")
                return

        print(f"\n{YELLOW}Hashing password...{NC}")
        pw_hash = hash_password(password)

        user_id = f"usr_{uuid.uuid4().hex[:12]}"

        print(f"{YELLOW}Inserting into database...{NC}")

        await conn.execute(
            """INSERT INTO freeledger.users
               (id, username, email, password_hash, auth_method, role, wallet_address, is_active)
               VALUES ($1, $2, $3, $4, 'email', $5, $6, true)""",
            user_id, username, email, pw_hash, role, wallet,
        )

        print(f"\n{GREEN}{role.capitalize()} account created successfully!{NC}")
        print(f"  Username: {BOLD}{username}{NC}")
        print(f"  User ID:  {user_id}")
        if email:
            print(f"  Email:    {email}")
        if wallet:
            print(f"  Wallet:   {wallet}")
        print()

    except Exception as e:
        print(f"{RED}Error: {e}{NC}")
    finally:
        await conn.close()


async def delete_user():
    print(f"\n{CYAN}--- Delete User Account ---{NC}\n")

    conn = await asyncpg.connect(DB_URL)
    try:
        rows = await conn.fetch(
            """SELECT id, username, email, role, wallet_address
               FROM freeledger.users
               WHERE role IN ('freelancer', 'client')
               ORDER BY role, created_at"""
        )

        if not rows:
            print(f"{YELLOW}No user accounts found.{NC}")
            return

        print(f"  {'#':<4} {'Username':<20} {'Role':<14} {'Wallet':<44}")
        print(f"  {'-'*4} {'-'*20} {'-'*14} {'-'*44}")
        for i, r in enumerate(rows, 1):
            username = r["username"] or "-"
            wallet = r["wallet_address"] or "-"
            print(f"  {i:<4} {username:<20} {r['role']:<14} {wallet:<44}")

        print()
        choice = input(f"Choose account to delete [1-{len(rows)}]: ").strip()

        if not choice.isdigit() or int(choice) < 1 or int(choice) > len(rows):
            print(f"{RED}Invalid selection.{NC}")
            return

        chosen = rows[int(choice) - 1]
        print()
        confirm = input(
            f"Delete '{chosen['username']}' ({chosen['role']})? This cannot be undone. [y/N]: "
        ).strip()

        if confirm.lower() != "y":
            print(f"{YELLOW}Cancelled.{NC}")
            return

        await conn.execute(
            "DELETE FROM freeledger.users WHERE id = $1", chosen["id"]
        )

        print(f"\n{GREEN}User '{chosen['username']}' deleted.{NC}\n")

    except Exception as e:
        print(f"{RED}Error: {e}{NC}")
    finally:
        await conn.close()


async def main():
    while True:
        print(f"\n{BOLD}FreeLedger User Manager{NC}")
        print("=" * 30)
        print(f"\nWhat would you like to do?\n")
        print("  1) List all users")
        print("  2) Add user")
        print("  3) Delete user")
        print(f"\n  {DIM}0) Back / Quit{NC}\n")

        choice = input("Choose [0-3]: ").strip()

        if choice == "0":
            print()
            break
        elif choice == "1":
            await list_users()
        elif choice == "2":
            await add_user()
        elif choice == "3":
            await delete_user()
        else:
            print(f"{RED}Invalid choice.{NC}")


if __name__ == "__main__":
    asyncio.run(main())
