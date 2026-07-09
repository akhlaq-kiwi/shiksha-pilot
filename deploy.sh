#!/bin/bash

# Exit immediately if any command fails
set -e

# Configuration
SSH_USER="u554613359"
SSH_HOST="92.249.46.170"
SSH_PORT="65002"
SSH_PASS='Billu@9012'
REMOTE_PATH="/home/u554613359/domains/qa.shikshapilot.com/public_html"

# SMTP Configuration (not stored in .qa.env)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="bilalnashi6@gmail.com"
SMTP_PASS="umsvdjuknuilnvol"
SMTP_FROM_NAME="BN School ERP Control Panel"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting QA deployment...${NC}"

# Validate .qa.env files exist
if [ ! -f "frontend/.qa.env" ]; then
    echo -e "${RED}Error: frontend/.qa.env not found.${NC}"
    exit 1
fi
if [ ! -f "backend/.qa.env" ]; then
    echo -e "${RED}Error: backend/.qa.env not found.${NC}"
    exit 1
fi

# Check prerequisites
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed. Please install Node.js/npm.${NC}"
    exit 1
fi


# Check for sshpass
SSHPASS_CMD=""
if command -v sshpass &> /dev/null; then
    SSHPASS_CMD="sshpass -p '$SSH_PASS'"
    echo -e "${GREEN}Found sshpass. Remote copy and execution will be automated.${NC}"
else
    echo -e "${YELLOW}Warning: sshpass is not installed. You will be prompted to enter the SSH password twice during deployment.${NC}"
fi

# 1. Build frontend using frontend/.qa.env (via Vite --mode qa)
echo -e "${YELLOW}Building frontend with frontend/.qa.env...${NC}"
cp frontend/.qa.env frontend/.env.qa
cd frontend
npm install
npm run build -- --mode qa
cd ..
rm -f frontend/.env.qa

# 2. Create temporary deployment structure
echo -e "${YELLOW}Creating deployment package...${NC}"
BUILD_DIR=".builds"
TEMP_DIR="$BUILD_DIR/deploy_temp"
TAR_FILE="$BUILD_DIR/deploy.tar.gz"
mkdir -p "$BUILD_DIR"
rm -rf "$TEMP_DIR" "$TAR_FILE"
mkdir -p "$TEMP_DIR"

# Copy frontend build
cp -r frontend/dist/* "$TEMP_DIR/"

# Copy backend files into api/ directory
mkdir -p "$TEMP_DIR/api"
cp -r backend/src "$TEMP_DIR/api/"
cp -r backend/public "$TEMP_DIR/api/"
cp backend/composer.json "$TEMP_DIR/api/"
cp backend/composer.lock "$TEMP_DIR/api/"

# Build backend .env from backend/.qa.env + append secrets not in .qa.env
cp backend/.qa.env "$TEMP_DIR/api/.env"
echo "" >> "$TEMP_DIR/api/.env"
cat <<EOT >> "$TEMP_DIR/api/.env"
JWT_SECRET=super_secret_erp_key_2026
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
SMTP_FROM_NAME="$SMTP_FROM_NAME"
EOT

# Create root .htaccess for frontend client-side routing
cat <<EOT > "$TEMP_DIR/.htaccess"
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
EOT

# Create api/.htaccess to route api sub-requests to public/index.php
cat <<EOT > "$TEMP_DIR/api/.htaccess"
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^(.*)$ public/index.php [QSA,L]
</IfModule>
EOT

# 4. Archive deployment package
echo -e "${YELLOW}Archiving deployment package...${NC}"
COPYFILE_DISABLE=1 tar -czf "$TAR_FILE" -C "$TEMP_DIR" .
rm -rf "$TEMP_DIR"

# 5. Upload to shared hosting
echo -e "${YELLOW}Uploading package to remote server...${NC}"
if [ -n "$SSHPASS_CMD" ]; then
    eval $SSHPASS_CMD scp -P $SSH_PORT "$TAR_FILE" $SSH_USER@$SSH_HOST:$REMOTE_PATH/
else
    scp -P $SSH_PORT "$TAR_FILE" $SSH_USER@$SSH_HOST:$REMOTE_PATH/
fi

# 6. Extract package on remote server and run migrations
echo -e "${YELLOW}Extracting package on remote server and running database migrations...${NC}"
EXTRACT_CMD="cd $REMOTE_PATH && rm -rf assets api index.html && tar --warning=no-unknown-keyword -xzf deploy.tar.gz && rm deploy.tar.gz && echo 'Running composer install...' && composer install --no-dev --optimize-autoloader --working-dir=$REMOTE_PATH/api && echo 'Running migrations...' && php api/src/Database/migrate.php"
if [ -n "$SSHPASS_CMD" ]; then
    eval $SSHPASS_CMD ssh -p $SSH_PORT $SSH_USER@$SSH_HOST "$EXTRACT_CMD"
else
    ssh -p $SSH_PORT $SSH_USER@$SSH_HOST "$EXTRACT_CMD"
fi

# Local build artifacts are kept in .builds/ (gitignored)

echo -e "${GREEN}QA deployment completed successfully!${NC}"
