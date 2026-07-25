# FreeLedger - one-command project start for Windows
# Starts Docker services, backend, user frontend, and admin frontend.

$ROOT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ROOT_DIR

function Write-Step { param([string]$m) Write-Host "`n============================================" -ForegroundColor Cyan; Write-Host "  $m" -ForegroundColor Cyan; Write-Host "============================================" -ForegroundColor Cyan }
function Write-OK { param([string]$m) Write-Host "  $m" -ForegroundColor Green }
function Write-Warn { param([string]$m) Write-Host "  $m" -ForegroundColor Yellow }
function Write-Err { param([string]$m) Write-Host "  $m" -ForegroundColor Red }
function Upsert-EnvValue {
    param([string]$Path, [string]$Name, [string]$Value)
    $content = if (Test-Path $Path) { Get-Content -LiteralPath $Path -Raw } else { "" }
    if ($content -match "(?m)^$Name=.*") {
        $content = $content -replace "(?m)^$Name=.*", "$Name=$Value"
    } elseif ($content.Trim()) {
        $content = $content.TrimEnd() + "`r`n$Name=$Value"
    } else {
        $content = "$Name=$Value"
    }
    Set-Content -LiteralPath $Path -Value $content -NoNewline
}

Write-Step "Step 1/8: Checking project folder"
if (-not (Test-Path "$ROOT_DIR\docker\docker-compose.yml")) {
    Write-Err "Cannot find docker/docker-compose.yml. Run this script from the FreeLedger project root."
    exit 1
}
Write-OK "Project root detected: $ROOT_DIR"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Warn "Not running as Administrator. Installs may fail; re-run as Admin if needed." }

Write-Step "Step 2/8: Checking prerequisites"
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Err "Docker not found. Install Docker Desktop, open it, then re-run this script."
    exit 1
}
Write-OK "Docker: $(docker --version)"

docker info *>$null
if ($LASTEXITCODE -ne 0) {
    Write-Err "Docker daemon is not running. Start Docker Desktop and re-run this script."
    exit 1
}
Write-OK "Docker daemon is running"

$pythonCmd = $null
$pythonVersionText = $null
$candidateCommands = @(
    @("py", "-3.11"),
    @("py", "-3.12"),
    @("py", "-3.10"),
    @("python", ""),
    @("python3", "")
)
foreach ($candidate in $candidateCommands) {
    $cmd = $candidate[0]
    $arg = $candidate[1]
    try {
        if ($arg) { $v = & $cmd $arg --version 2>&1 } else { $v = & $cmd --version 2>&1 }
        if ($LASTEXITCODE -eq 0 -and $v -match "Python 3\.(10|11|12)") {
            $pythonCmd = if ($arg) { "$cmd $arg" } else { $cmd }
            $pythonVersionText = $v
            break
        }
    } catch {}
}
if (-not $pythonCmd) {
    Write-Warn "Python 3.10, 3.11, or 3.12 not found. Installing Python 3.11 via winget..."
    winget install --id Python.Python.3.11 --silent --accept-package-agreements
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
    if (Get-Command py -ErrorAction SilentlyContinue) {
        $pythonCmd = "py -3.11"
        $pythonVersionText = & py -3.11 --version
    } elseif (Get-Command python -ErrorAction SilentlyContinue) {
        $pythonCmd = "python"
        $pythonVersionText = & python --version
    } else {
        Write-Err "Python install finished but Python is not in PATH. Re-open PowerShell and re-run this script."
        exit 1
    }
}
Write-OK "Python: $pythonVersionText"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Warn "Node.js not found. Installing Node.js LTS via winget..."
    winget install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Err "Node.js not found after install. Re-open PowerShell and re-run."; exit 1 }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Write-Err "npm not found. Reinstall Node.js LTS."; exit 1 }
Write-OK "Node.js: $(node --version)"
Write-OK "npm: $(npm --version)"

Write-Step "Step 3/8: Starting Docker containers"
Set-Location "$ROOT_DIR\docker"
docker compose up -d
if ($LASTEXITCODE -ne 0) { Write-Err "docker compose up failed."; exit 1 }
Write-OK "Docker containers are starting"

Write-Step "Step 4/8: Waiting for Hardhat and contract deployment"
$HARDHAT_READY = $false
$DEPLOYED_ADDRESS_FILE = "$ROOT_DIR\contracts\.contract-address"
$CONTRACT_ADDRESS = ""

for ($i = 1; $i -le 60; $i++) {
    try {
        $r = Invoke-WebRequest -Uri http://localhost:8545 -Method POST -ContentType "application/json" -Body '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' -UseBasicParsing -TimeoutSec 3
        if ($r.StatusCode -eq 200) {
            if (Test-Path $DEPLOYED_ADDRESS_FILE) { $CONTRACT_ADDRESS = (Get-Content -LiteralPath $DEPLOYED_ADDRESS_FILE -Raw).Trim() }
            if ($CONTRACT_ADDRESS) {
                $body = @{ jsonrpc = "2.0"; method = "eth_getCode"; params = @($CONTRACT_ADDRESS, "latest"); id = 1 } | ConvertTo-Json
                $cr = Invoke-WebRequest -Uri http://localhost:8545 -Method POST -ContentType "application/json" -Body $body -UseBasicParsing -TimeoutSec 3
                $code = ($cr.Content | ConvertFrom-Json).result
                if ($code -and $code -ne "0x") {
                    Write-OK "Hardhat ready and GigEscrow deployed at $CONTRACT_ADDRESS"
                    $HARDHAT_READY = $true
                    break
                }
            }
        }
    } catch {}
    Write-Host "  Waiting... ($i/60)"
    Start-Sleep -Seconds 3
}
if (-not $HARDHAT_READY) {
    Write-Warn "Hardhat did not confirm contract deployment in time; continuing with known local default if needed."
    if (Test-Path $DEPLOYED_ADDRESS_FILE) { $CONTRACT_ADDRESS = (Get-Content -LiteralPath $DEPLOYED_ADDRESS_FILE -Raw).Trim() }
    if (-not $CONTRACT_ADDRESS) { $CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3" }
}

Write-Host "  Creating local .env files if missing..."
$backendEnv = "$ROOT_DIR\backend\.env"
$frontendEnv = "$ROOT_DIR\frontend\.env"
if (-not (Test-Path $backendEnv)) { Copy-Item "$ROOT_DIR\backend\.env.example" $backendEnv }
if (-not (Test-Path $frontendEnv)) { Copy-Item "$ROOT_DIR\frontend\.env.example" $frontendEnv }
Upsert-EnvValue -Path $backendEnv -Name "CONTRACT_ADDRESS" -Value $CONTRACT_ADDRESS
Upsert-EnvValue -Path $frontendEnv -Name "REACT_APP_CONTRACT_ADDRESS" -Value $CONTRACT_ADDRESS
Write-OK ".env files ready"

Write-Step "Step 5/8: Setting up Python virtual environment"
Set-Location "$ROOT_DIR\backend"
if (-not (Test-Path "venv\Scripts\python.exe")) {
    Write-Host "  Creating backend virtual environment..."
    Invoke-Expression "$pythonCmd -m venv venv"
    if ($LASTEXITCODE -ne 0) { Write-Err "Virtual environment creation failed. Install Python 3.11 and try again."; exit 1 }
}
Write-Host "  Installing backend dependencies..."
& "$ROOT_DIR\backend\venv\Scripts\python.exe" -m pip install --upgrade pip
& "$ROOT_DIR\backend\venv\Scripts\python.exe" -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { Write-Err "Backend dependency installation failed."; exit 1 }
Write-OK "Backend dependencies installed"

Write-Step "Step 6/8: Starting backend"
$backendJob = Start-Job -Name "FreeLedger-Backend" -ScriptBlock {
    param($dir)
    Set-Location $dir
    $env:PYTHONPATH = $dir
    & "$dir\venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
} -ArgumentList "$ROOT_DIR\backend"

$BACKEND_HEALTHY = $false
for ($i = 1; $i -le 45; $i++) {
    try {
        $hr = Invoke-WebRequest -Uri http://localhost:8000/api/health -UseBasicParsing -TimeoutSec 2
        if ($hr.StatusCode -eq 200) { Write-OK "Backend ready on http://localhost:8000"; $BACKEND_HEALTHY = $true; break }
    } catch {}
    Start-Sleep -Seconds 1
}
if (-not $BACKEND_HEALTHY) { Write-Warn "Backend has not reported healthy yet. Check logs with: Receive-Job -Name FreeLedger-Backend" }

Write-Step "Step 7/8: Starting frontends"
Set-Location "$ROOT_DIR\frontend"
Write-Host "  Installing frontend dependencies..."
npm install
if ($LASTEXITCODE -ne 0) { Write-Err "Frontend dependency installation failed."; exit 1 }

$frontendJob = Start-Job -Name "FreeLedger-Frontend" -ScriptBlock {
    param($dir)
    Set-Location $dir
    $env:PORT = "3000"
    npm start
} -ArgumentList "$ROOT_DIR\frontend"
Write-OK "User frontend starting on http://localhost:3000"

$adminJob = Start-Job -Name "FreeLedger-Admin" -ScriptBlock {
    param($dir)
    Set-Location $dir
    $env:PORT = "3001"
    $env:REACT_APP_ADMIN_MODE = "true"
    npm start
} -ArgumentList "$ROOT_DIR\frontend"
Write-OK "Admin frontend starting on http://localhost:3001"

Write-Step "Step 8/8: URLs"
Write-Host "  User frontend: http://localhost:3000" -ForegroundColor Yellow
Write-Host "  Admin frontend: http://localhost:3001" -ForegroundColor Yellow
Write-Host "  Backend docs:  http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "  Backend health:http://localhost:8000/api/health" -ForegroundColor Yellow
Write-Host "  Hardhat RPC:   http://localhost:8545" -ForegroundColor Yellow
Write-Host "  IPFS gateway:  http://localhost:8080" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop backend/frontend jobs. Docker containers keep running until docker compose down." -ForegroundColor Gray
Write-Host "View logs with: Receive-Job -Name FreeLedger-*" -ForegroundColor Gray

try {
    while ($true) { Start-Sleep -Seconds 1 }
} finally {
    Write-Host "`nStopping backend/frontend jobs..."
    Get-Job -Name "FreeLedger-*" -ErrorAction SilentlyContinue | Stop-Job -ErrorAction SilentlyContinue
    Get-Job -Name "FreeLedger-*" -ErrorAction SilentlyContinue | Remove-Job -ErrorAction SilentlyContinue
    Write-OK "Stopped backend/frontend jobs."
}