# Plan: Admin CRUD + Dispute Management

## Goal
Add missing admin CRUD endpoints (CREATE for users/jobs/proposals/contracts), hard DELETE support, and seed one admin user. Admin resolves disputes (end + send ether to freelancer or client), but does NOT create disputes.

---

## Step 1: Seed Admin User

Create admin user + AdminAccount record using the backend's `hash_password()`:

```python
# Run via backend Python shell or seed script
from passlib.context import CryptContext
pwd = CryptContext(schemes=["bcrypt"])
hash = pwd.hash("admin123")
# Then insert into DB
```

SQL:
```sql
INSERT INTO freeledger.users (id, username, email, password_hash, role, is_active, created_at)
VALUES ('usr_admin_seed', 'admin', 'admin@freeledger.com', '<hash>', 'admin', true, NOW());

INSERT INTO freeledger.admin_accounts (id, user_id, role, created_at)
VALUES (gen_random_uuid()::text, 'usr_admin_seed', 'admin', NOW());
```

---

## Step 2: Backend Schema Changes

### File: `backend/app/schemas.py`
Add these schemas:

| Schema | Fields |
|--------|--------|
| `AdminUserCreate` | `email`, `password`, `username`, `role`, `headline`, `hourly_rate`, `experience_level`, `industries`, `is_available`, `portfolio_cids` |
| `AdminJobCreate` | `client_id`, `title`, `description`, `budget`, `category`, `skills`, `duration_days`, `status` |
| `AdminProposalCreate` | `job_id`, `freelancer_id`, `cover_letter`, `bid_amount`, `estimated_days` |
| `AdminContractCreate` | `job_id`, `client_id`, `freelancer_id`, `title`, `description`, `total_amount`, `deadline`, `status`, `milestones` |

---

## Step 3: Backend Router Changes

### File: `backend/app/routers/auth.py`
Export `hash_password` so `admin.py` can import it.

### File: `backend/app/routers/admin.py`

**A. Import `hash_password`** — add import

**B. Add `POST /admin/users`** — Create user (any role). Hash password. Create AdminAccount if role="admin".

**C. Add `POST /admin/jobs`** — Create job for a client. Validate client_id exists + is a client.

**D. Add `POST /admin/proposals`** — Create proposal for a job/freelancer.

**E. Add `POST /admin/contracts`** — Create contract with optional milestones. Validate parties exist.

**F. Convert existing DELETE to hard delete:**
  - `DELETE /admin/users/{id}` — `await db.delete(user)` instead of `is_active=False`
  - `DELETE /admin/jobs/{id}` — `await db.delete(job)` instead of `status=cancelled`
  - `DELETE /admin/proposals/{id}` — `await db.delete(proposal)` instead of `status=withdrawn`
  - `DELETE /admin/contracts/{id}` — `await db.delete(contract)` instead of `status=cancelled`

---

## Step 4: Frontend Changes

### File: `frontend/src/components/admin/UserSearchSelect.js` (NEW)
Reusable autocomplete component:
- Debounced search input → `GET /admin/users?search=...`
- Dropdown showing username, email, role badge
- `onSelect(user)` callback, accepts optional `role` filter prop

### File: `frontend/src/pages/admin/AdminUsers.js`
- Add "Add User" button → modal with: email, password, username, role (select), headline, hourly_rate, experience_level
- Submit: `POST /admin/users` → refresh list

### File: `frontend/src/pages/admin/AdminJobs.js`
- Add "Add Job" button → modal with: UserSearchSelect (client, role=client), title, description, budget, category, skills, duration_days, status
- Submit: `POST /admin/jobs` → refresh list

### File: `frontend/src/pages/admin/AdminProposals.js`
- Add "Add Proposal" button → modal with: job_id (text), UserSearchSelect (freelancer, role=freelancer), cover_letter, bid_amount, estimated_days
- Submit: `POST /admin/proposals` → refresh list

### File: `frontend/src/pages/admin/AdminContracts.js`
- Add "Add Contract" button → modal with: UserSearchSelect (client), UserSearchSelect (freelancer), title, description, total_amount, deadline, status
- Submit: `POST /admin/contracts` → refresh list

### File: `frontend/src/pages/admin/AdminDisputes.js`
- NO "Create Dispute" button (admin does not create disputes)
- Keep existing resolution flow: "Release to Freelancer" / "Refund Client" buttons (already implemented)
- Add "Edit" button → modal with reason, status, decision fields → `PUT /admin/disputes/{id}`
- Add "Delete" button with confirmation → `DELETE /admin/disputes/{id}` → refresh list

---

## Step 5: Dispute Resolution Flow (already implemented, no changes needed)

```
Admin clicks "Release to Freelancer" → POST /disputes/{id}/resolve { release_to_freelancer: true }
  → on-chain: resolveDispute(contract_id, release=true) → sends ether to freelancer
  → contract.status = "completed"
  → audit log entry

Admin clicks "Refund Client" → POST /disputes/{id}/resolve { release_to_freelancer: false }
  → on-chain: resolveDispute(contract_id, release=false) → sends ether to client
  → contract.status = "cancelled"
  → audit log entry
```

Resolution notes optional input already exists in the UI.

---

## Order of Implementation
1. Add admin CREATE schemas to `schemas.py`
2. Export `hash_password` from `auth.py`
3. Add CREATE endpoints + hard DELETE to `admin.py`
4. Create `UserSearchSelect.js` component
5. Add "+ Add" modals to Users/Jobs/Proposals/Contracts pages
6. Add Edit + Delete to AdminDisputes page
7. Seed admin user via Python script
