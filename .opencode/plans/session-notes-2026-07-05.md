# Session Notes — Jul 5, 2026

## Work Done: Fixed PostProjectModal budget/milestone validation + ETH unit migration

Fixed the error: `"Blockchain deployment failed: Contract was deployed but no ContractCreated event was found in the receipt."`

### Root Cause
Budget field was labeled `"Budget ($)"` but sent to the smart contract as `parseEther(budget)` — treating **dollars as ETH** (e.g., 2000 ETH). Milestone amounts were in actual ETH (e.g., 2 ETH total). The Solidity contract enforces `sum(milestone amounts) == totalAmount`, so `2 != 2000` caused a **silent revert**. The code never checked `receipt.status`, so it fell through to a misleading event-not-found error.

### Files Changed (9 frontend files)

#### 1. `frontend/src/components/shared/PostProjectModal.js`
- Budget label: `"Budget ($)"` → `"Budget (ETH)"`, placeholder `"e.g. 2000"` → `"e.g. 10"`
- Milestone amount placeholder: `"e.g. 500"` → `"e.g. 5"`
- **Added validation**: milestone amounts must sum to budget (within 0.001 tolerance) — blocked before any MetaMask call
- **Added receipt.status check**: after `tx.wait()`, if status is 0, throws `"Transaction reverted on-chain"`
- `total_amount` payload: now always uses `budget` (ETH), aligned with `job.budget`

#### 2. `frontend/src/pages/freelancer/FindJobs.js`
- `formatCurrency()`: output `' ETH'` instead of `'$'`
- Budget filters: `"Under $500"` → `"Under 5 ETH"`, etc.
- `parseBudgetRange()`: updated ranges to match ETH values

#### 3. `frontend/src/pages/freelancer/Dashboard.js`
- `fmtCurrency()`: output `' ETH'` instead of `'$'`

#### 4. `frontend/src/pages/freelancer/MyContracts.js`
- 3 amount displays changed from `'$'` prefix to `' ETH'` suffix

#### 5. `frontend/src/pages/freelancer/MyProfile.js`
- Earned display: `'$'` → `' ETH'`

#### 6. `frontend/src/pages/client/ExploreJobs.js`
- `budgetDisplay`: now appends `' ETH'`
- Budget filters: `"Under $500"` → `"Under 5 ETH"`, etc.
- Milestone amounts: `'$'` → `' ETH'`
- `checkBudget()`: updated ranges to ETH values

#### 7. `frontend/src/pages/client/Dashboard.js`
- Total Budget Locked display: `'$'` → `' ETH'`
- Bid amounts display: `'$'` → `' ETH'`

#### 8. `frontend/src/pages/client/MyContracts.js`
- 8 amount displays changed from `'$'` prefix to `' ETH'` suffix

#### 9. `frontend/src/pages/client/Profile.js`
- Spent display: `'$'` → `' ETH'`

### Files NOT changed (no changes needed)
- **Backend** (`backend/app/`): All amount columns are unit-agnostic `Float` — stores raw numbers, no dollar/ETH assumptions
- **Smart contract** (`contracts/contracts/GigEscrow.sol`): Already uses wei and enforces `sum(milestones) == totalAmount`
- **Admin pages**: Already used `ETH` labels (were already correct)
- `frontend/src/pages/client/BrowseFreelancers.js`: `hourly_rate` is a separate concept, left as `$`

### How to Restart the Full System

```bash
# Terminal 1 — Infrastructure (PostgreSQL, Hardhat, Redis, IPFS)
cd ~/Desktop/Sarun_Capstone/docker && docker compose up -d

# Terminal 2 — Backend API
cd ~/Desktop/Sarun_Capstone/backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000

# Terminal 3 — Frontend (client)
cd ~/Desktop/Sarun_Capstone/frontend && npm start

# Terminal 4 — Frontend (admin)
cd ~/Desktop/Sarun_Capstone/frontend && npm run start:admin
```

### Verification After Restart
1. Open frontend at `http://localhost:3000`
2. Post a new project with budget in ETH (e.g., `2`) and milestones summing to same (e.g., `0.5`, `1.0`, `0.5`)
3. Submit — validation should pass, MetaMask should deploy, `ContractCreated` event found, backend saves
4. No more `"Blockchain deployment failed"` error
