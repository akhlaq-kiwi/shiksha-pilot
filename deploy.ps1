# Native PowerShell script to deploy to Hostinger QA Server on Windows
$ErrorActionPreference = "Stop"

# Configuration
$SSH_USER = "u554613359"
$SSH_HOST = "92.249.46.170"
$SSH_PORT = "65002"
$REMOTE_PATH = "/home/u554613359/domains/qa.shikshapilot.com/public_html"

$phpDir = "$PSScriptRoot\.bin\php"
$nodeDir = "$PSScriptRoot\.bin\node"
$env:PATH = "$phpDir;$nodeDir;" + $env:PATH

$SMTP_HOST = "smtp.gmail.com"
$SMTP_PORT = "587"
$SMTP_USER = "bilalnashi6@gmail.com"
$SMTP_PASS = "umsvdjuknuilnvol"
$SMTP_FROM_NAME = "BN School ERP Control Panel"

Write-Host "Starting QA deployment..." -ForegroundColor Yellow

# Validate source files exist
if (-not (Test-Path "frontend/.qa.env")) {
    Write-Error "Error: frontend/.qa.env not found."
}
if (-not (Test-Path "backend/.qa.env")) {
    Write-Error "Error: backend/.qa.env not found."
}

# 1. Build frontend using frontend/.qa.env (via Vite --mode qa)
Write-Host "Building frontend..." -ForegroundColor Yellow
Copy-Item "frontend/.qa.env" "frontend/.env.qa" -Force
Push-Location frontend
npm install
$env:NODE_OPTIONS = "--max-old-space-size=1536"
npm run build -- --mode qa
Remove-Item env:NODE_OPTIONS -ErrorAction SilentlyContinue
Pop-Location
Remove-Item "frontend/.env.qa" -Force

# 2. Create temporary deployment structure
Write-Host "Creating deployment package..." -ForegroundColor Yellow
$BUILD_DIR = ".builds"
$TEMP_DIR = "$BUILD_DIR/deploy_temp"
$TAR_FILE = "$BUILD_DIR/deploy.tar.gz"

if (Test-Path $TEMP_DIR) {
    Remove-Item $TEMP_DIR -Recurse -Force
}
if (Test-Path $TAR_FILE) {
    Remove-Item $TAR_FILE -Force
}

New-Item -ItemType Directory -Force -Path $TEMP_DIR | Out-Null
New-Item -ItemType Directory -Force -Path "$TEMP_DIR/api" | Out-Null

Copy-Item "frontend/dist/*" $TEMP_DIR -Recurse -Force

Copy-Item "backend/src" "$TEMP_DIR/api" -Recurse -Force
Copy-Item "backend/public" "$TEMP_DIR/api" -Recurse -Force
Copy-Item "backend/composer.json" "$TEMP_DIR/api" -Force
Copy-Item "backend/composer.lock" "$TEMP_DIR/api" -Force

# Build backend .env
Copy-Item "backend/.qa.env" "$TEMP_DIR/api/.env" -Force
$env_secrets = @"

JWT_SECRET=super_secret_erp_key_2026
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
SMTP_FROM_NAME="$SMTP_FROM_NAME"
"@
Add-Content -Path "$TEMP_DIR/api/.env" -Value $env_secrets

# Create root .htaccess for frontend client-side routing
$htaccess_fe = @"
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /

    # If requested resource is a file or folder, serve it directly
    RewriteCond %{REQUEST_FILENAME} -f [OR]
    RewriteCond %{REQUEST_FILENAME} -d
    RewriteRule ^ - [L]

    # Otherwise, rewrite all requests to React frontend (index.html)
    RewriteRule ^ index.html [L]
</IfModule>
"@
Set-Content -Path "$TEMP_DIR/.htaccess" -Value $htaccess_fe

# Create api/.htaccess to route api sub-requests to public/index.php
$htaccess_api = @"
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^(.*)$ public/index.php [QSA,L]
</IfModule>
"@
Set-Content -Path "$TEMP_DIR/api/.htaccess" -Value $htaccess_api

# 4. Archive deployment package
Write-Host "Archiving deployment package..." -ForegroundColor Yellow
# Modern Windows tar utility
& tar.exe -czf $TAR_FILE -C $TEMP_DIR .

# Cleanup temp folder
Remove-Item $TEMP_DIR -Recurse -Force

# 5. Run Python deployment script to upload and extract
Write-Host "Uploading and deploying using deploy_qa.py..." -ForegroundColor Yellow
python deploy_qa.py
if ($LASTEXITCODE -ne 0) {
    Write-Error "Error: Python deployment script (deploy_qa.py) failed with exit code $LASTEXITCODE"
}

Write-Host "QA deployment completed successfully!" -ForegroundColor Green
