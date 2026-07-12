"""
FreeLedger — Admin account manager
Add, delete, or list admin accounts from the database.
Run: ./admin.sh
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


async def list_admins():
    conn = await asyncpg.connect(DB_URL)
    try:
        rows = await conn.fetch(
            """SELECT u.id, u.username, u.email, u.is_active, u.created_at
               FROM freeledger.users u
               WHERE u.role = 'admin'
               ORDER BY u.created_at"""
        )

        if not rows:
            print(f"\n{YELLOW}No admin accounts found.{NC}\n")
            return

        print(f"\n  {'Username':<20} {'Email':<30} {'Status':<10} {'ID'}")
        print(f"  {'-'*20} {'-'*30} {'-'*10} {'-'*26}")
        for r in rows:
            username = r["username"] or "-"
            email = r["email"] or "-"
            status = f"{GREEN}active{NC}" if r["is_active"] else f"{RED}inactive{NC}"
            print(f"  {username:<20} {email:<30} {status:<20} {r['id']}")
        print()
    finally:
        await conn.close()


async def add_admin():
    print(f"\n{CYAN}--- Add Admin Account ---{NC}\n")

    username = input("Username: ").strip()
    if not username:
        print(f"{RED}Username cannot be empty.{NC}")
        return

    password = getpass.getpass("Password: ")
    if not password:
        print(f"{RED}Password cannot be empty.{NC}")
        return

    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        print(f"{RED}Passwords do not match.{NC}")
        return

    conn = await asyncpg.connect(DB_URL)
    try:
        existing = await conn.fetchval(
            "SELECT id FROM freeledger.users WHERE username = $1", username
        )
        if existing:
            print(f"{RED}Error: Username '{username}' already exists.{NC}")
            return

        print(f"\n{YELLOW}Hashing password...{NC}")
        pw_hash = hash_password(password)

        user_id = f"usr_{uuid.uuid4().hex[:12]}"
        admin_id = str(uuid.uuid4())

        print(f"{YELLOW}Inserting into database...{NC}")

        await conn.execute(
            """INSERT INTO freeledger.users
               (id, username, password_hash, auth_method, role, is_active)
               VALUES ($1, $2, $3, 'email', 'admin', true)""",
            user_id, username, pw_hash,
        )

        await conn.execute(
            """INSERT INTO freeledger.admin_accounts (id, user_id, role)
               VALUES ($1, $2, 'admin')""",
            admin_id, user_id,
        )

        print(f"\n{GREEN}Admin account created successfully!{NC}")
        print(f"  Username: {BOLD}{username}{NC}")
        print(f"  User ID:  {user_id}\n")

    except Exception as e:
        print(f"{RED}Error: {e}{NC}")
    finally:
        await conn.close()


async def delete_admin():
    print(f"\n{CYAN}--- Delete Admin Account ---{NC}\n")

    conn = await asyncpg.connect(DB_URL)
    try:
        rows = await conn.fetch(
            """SELECT u.id, u.username
               FROM freeledger.users u
               WHERE u.role = 'admin'
               ORDER BY u.created_at"""
        )

        if not rows:
            print(f"{YELLOW}No admin accounts found.{NC}")
            return

        print("Admin accounts:\n")
        for i, row in enumerate(rows, 1):
            print(f"  {i}) {row['username']} ({row['id']})")

        print()
        choice = input(f"Choose account to delete [1-{len(rows)}]: ").strip()

        if not choice.isdigit() or int(choice) < 1 or int(choice) > len(rows):
            print(f"{RED}Invalid selection.{NC}")
            return

        chosen = rows[int(choice) - 1]
        print()
        confirm = input(
            f"Delete '{chosen['username']}'? This cannot be undone. [y/N]: "
        ).strip()

        if confirm.lower() != "y":
            print(f"{YELLOW}Cancelled.{NC}")
            return

        await conn.execute(
            "DELETE FROM freeledger.admin_accounts WHERE user_id = $1",
            chosen["id"],
        )
        await conn.execute(
            "DELETE FROM freeledger.users WHERE id = $1",
            chosen["id"],
        )

        print(f"\n{GREEN}Admin account '{chosen['username']}' deleted.{NC}\n")

    except Exception as e:
        print(f"{RED}Error: {e}{NC}")
    finally:
        await conn.close()


async def main():
    while True:
        print(f"\n{BOLD}FreeLedger Admin Manager{NC}")
        print("=" * 30)
        print(f"\nWhat would you like to do?\n")
        print("  1) List admin accounts")
        print("  2) Add admin account")
        print("  3) Delete admin account")
        print(f"\n  {DIM}0) Back / Quit{NC}\n")

        choice = input("Choose [0-3]: ").strip()

        if choice == "0":
            print()
            break
        elif choice == "1":
            await list_admins()
        elif choice == "2":
            await add_admin()
        elif choice == "3":
            await delete_admin()
        else:
            print(f"{RED}Invalid choice.{NC}")


if __name__ == "__main__":
    asyncio.run(main())
