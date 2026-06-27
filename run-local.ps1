# run-local.ps1
# Automatically launches MariaDB Database, Slim PHP Backend, and Vite React Frontend locally.

# 1. Environment Paths Setup
$phpDir = "C:\Users\bilal\AppData\Local\Microsoft\WinGet\Packages\PHP.PHP.8.3_Microsoft.Winget.Source_8wekyb3d8bbwe"
$nodeDir = "C:\Program Files\nodejs"
$env:PATH = "$phpDir;$nodeDir;" + $env:PATH

Clear-Host
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   Starting Shiksha Pilot Local Environment       " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# 2. Start MariaDB Database Server
$dbRunning = Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue
if ($dbRunning) {
    Write-Host "[OK] Database (MariaDB) is already running on port 3306." -ForegroundColor Green
} else {
    Write-Host "[...] Starting Database (MariaDB) on port 3306..." -ForegroundColor Yellow
    Start-Process -FilePath "C:\Program Files\MariaDB 12.3\bin\mysqld.exe" -ArgumentList "--console" -WindowStyle Minimized
    Start-Sleep -Seconds 5
}

# 3. Run Database Migrations
Write-Host "[...] Running local database migrations..." -ForegroundColor Yellow
php backend/src/Database/migrate.php

# 4. Start Backend API Server
$backendRunning = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($backendRunning) {
    Write-Host "[OK] Slim PHP Backend is already running on port 8000." -ForegroundColor Green
} else {
    Write-Host "[...] Starting Slim PHP Backend on port 8000..." -ForegroundColor Yellow
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "`$env:PATH = 'C:\Users\bilal\AppData\Local\Microsoft\WinGet\Packages\PHP.PHP.8.3_Microsoft.Winget.Source_8wekyb3d8bbwe;' + `$env:PATH; cd backend; php -S localhost:8000 -t public" -WindowStyle Minimized
    Start-Sleep -Seconds 2
}

# 5. Start Frontend Dev Server
$frontendRunning = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($frontendRunning) {
    Write-Host "[OK] React Frontend is already running on port 3000." -ForegroundColor Green
} else {
    Write-Host "[...] Starting React Frontend on port 3000..." -ForegroundColor Yellow
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "`$env:PATH = 'C:\Program Files\nodejs;' + `$env:PATH; cd frontend; npm run dev" -WindowStyle Minimized
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host "       Local Environment Started Successfully!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "  - Frontend:    http://localhost:3000" -ForegroundColor Cyan
Write-Host "  - Backend API: http://localhost:8000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Please keep the minimized terminal windows open." -ForegroundColor Gray
Write-Host "To shut down the servers, simply close the minimized windows." -ForegroundColor Gray
