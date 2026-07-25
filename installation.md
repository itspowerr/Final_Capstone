# Installation Guide for Sarun Capstone

This repository contains the full stack application for FreeLedger, including a React frontend, a FastAPI backend, smart contracts, and Docker setup for services like IPFS, Redis, and PostgreSQL.

## Prerequisites

Ensure you have the following installed on your system:
- **Operating System**: Windows 10/11, macOS, or Linux
- **Python**: `>= 3.10`
- **Node.js**: `>= 18.x` (includes `npm`)
- **Git**
- **Docker & Docker Compose** (optional, but recommended for dependency services)

---

## 1. Setup the Database and Services (Docker)

To run PostgreSQL, Redis, and IPFS easily, a Docker Compose configuration is provided.

1. Navigate to the root directory where `docker-compose.yml` or similar setup is located.
2. Run the services using Docker:
   ```bash
   docker compose up -d
   ```
   *Note: If you run Docker, it will start PostgreSQL (on port 5432), Redis (on port 6379), and IPFS (on port 5001/8080).*

---

## 2. Backend Setup (FastAPI)

1. Open a terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   * **Windows (PowerShell)**:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   * **Windows (CMD)**:
     ```cmd
     .\venv\Scripts\activate.bat
     ```
   * **Linux/macOS**:
     ```bash
     source venv/bin/activate
     ```

4. Install the backend dependencies:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

5. Configure Environment Variables:
   - Create a `.env` file inside the `backend` directory (you can copy `.env.example` if it exists).
   - Example configuration settings:
     ```env
     DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/freeledger
     REDIS_URL=redis://localhost:6379
     JWT_SECRET=your-super-secret-key
     JWT_ALGORITHM=HS256
     CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
     ```

6. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```
   The backend will be running at `http://127.0.0.1:8000`. You can view the API documentation at `http://127.0.0.1:8000/docs`.

---

## 3. Frontend Setup (React)

1. Open a new terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install the frontend dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```
   This will run the React frontend app locally at `http://localhost:3000`.

---

## Troubleshooting CORS Issues

If you encounter CORS errors like:
`Access to XMLHttpRequest at ... has been blocked by CORS policy`

Make sure `backend/app/main.py` is configured with `CORSMiddleware` containing the frontend URLs in `allow_origins`:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```
Ensure that the origins matched in the browser requests exactly match the array configuration.
