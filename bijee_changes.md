# FreeLedger backend / runtime changes

This file summarizes the backend, API, database, contract, and runtime fixes made while getting FreeLedger working end-to-end.

## Backend API and server fixes

- Added the Messages API router and mounted it under `/api/messages`.
  - Added endpoints for conversation threads, loading messages, sending messages, and unread counts.
  - Fixed the earlier `404` problem for `/api/messages/threads` by registering the router in the FastAPI app.
  - Added recipient validation so messages are only allowed between clients and freelancers, not same-role users or admins.
  - Added unread-count support so nav badges can show real message state.

- Added backend models for messaging.
  - Added `Thread` model for one conversation between a client/freelancer, optionally linked to a job.
  - Added `Message` model with sender, receiver, content, read state, and timestamps.
  - Added relationships so threads can load their messages and related users/jobs.

- Added backend schemas for messages.
  - Added request schema for sending messages.
  - Added response schema for returning message data safely to the frontend.

- Improved backend startup/database compatibility.
  - Added startup checks/migrations for missing profile-related columns.
  - Added database initialization changes for message/thread tables and profile fields.
  - Kept startup resilient so existing local databases can be upgraded without manually rebuilding everything.

- Improved `/api/health` checks.
  - Health now reports database, Redis, IPFS, blockchain, and event-listener status.
  - Used this to verify the backend stack was alive during final checks.

## Blockchain/backend transaction fixes

- Fixed Web3.py v7 compatibility.
  - Replaced old `signed.rawTransaction` usage with `signed.raw_transaction`.
  - Updated backend blockchain transaction sending so milestone/contract blockchain calls work with the installed Web3 version.

- Hardened transaction handling.
  - Added gas estimation fallback/buffer handling.
  - Added transaction receipt timeout configuration.
  - Added safer transaction hash/receipt handling.

- Added blockchain timeout settings.
  - Added backend config values for blockchain provider timeout and transaction receipt timeout.

- Fixed blockchain-service logging/encoding issues.
  - Removed mojibake/corrupted dash text from logs so output stays readable.

## Contracts and tests

- Fixed contract test gas accounting.
  - Updated edge-case tests so expected balances account for gas costs correctly.

- Added/updated async blockchain backend test coverage.
  - Added backend test coverage for async blockchain service behavior.
  - Updated tests to use Web3.py v7 `raw_transaction` naming.

- Verified smart contracts.
  - Hardhat compile passed.
  - Contract tests passed with 43 passing tests.

## Dependencies and test tooling

- Added `pytest==9.1.1` to backend requirements so backend tests can run from a fresh setup.

- Verified backend tests.
  - Backend pytest suite passed with 9 passing tests.

## Docker/runtime support

- Updated Docker/runtime helper files used by the local stack.
  - Docker/IPFS/Postgres related config files were adjusted while making the local stack boot cleanly.
  - Contract address/runtime files were updated after local contract deployment/testing.

## Final backend verification performed

- Backend Python compile/import checks passed.
- Backend pytest tests passed: 9 passed.
- Contract compile passed.
- Contract tests passed: 43 passing.
- Live `/api/health` returned OK for the running stack, including database, Redis, IPFS, blockchain, and event listener.
- Mojibake scan was cleaned for the known corrupted UI/API text issues.

## Main backend files changed

- `backend/app/main.py`
- `backend/app/models.py`
- `backend/app/schemas.py`
- `backend/app/routers/messages.py`
- `backend/app/services/blockchain_service.py`
- `backend/app/config.py`
- `backend/requirements.txt`
- `docker/postgres/init.sql`
- `tests/backend/test_p01_async_blockchain.py`
- `contracts/test/*`