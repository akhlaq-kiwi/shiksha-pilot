#!/bin/bash

# Exit immediately if any command fails
set -e

# Configuration
SSH_USER="u554613359"
SSH_HOST="92.249.46.170"
SSH_PORT="65002"
SSH_PASS='Ga@1219!'
REMOTE_PATH="/home/u554613359/domains/qa.shikshapilot.com/public_html"

DB_HOST="127.0.0.1"
DB_NAME="u554613359_qa_sp_db"
DB_USER="u554613359_qa_sp_user"
DB_PASS='/Q5GYsafK5Vs'

# Free Gmail SMTP Configuration
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

echo -e "${YELLOW}Starting deployment preparation...${NC}"

# Check prerequisites
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed. Please install Node.js/npm.${NC}"
    exit 1
fi

HAS_COMPOSER=true
if ! command -v composer &> /dev/null; then
    echo -e "${YELLOW}Warning: composer is not installed locally. Will use the existing backend/vendor directory if present.${NC}"
    HAS_COMPOSER=false
    if [ ! -d "backend/vendor" ]; then
        echo -e "${RED}Error: backend/vendor directory does not exist and composer is not available to install it.${NC}"
        exit 1
    fi
fi

# Check for sshpass
SSHPASS_CMD=""
if command -v sshpass &> /dev/null; then
    SSHPASS_CMD="sshpass -p '$SSH_PASS'"
    echo -e "${GREEN}Found sshpass. Remote copy and execution will be automated.${NC}"
else
    echo -e "${YELLOW}Warning: sshpass is not installed. You will be prompted to enter the SSH password twice during deployment.${NC}"
fi

# 1. Build frontend
echo -e "${YELLOW}Building frontend...${NC}"
cd frontend
npm install
npm run build
cd ..

# 2. Install backend dependencies locally
if [ "$HAS_COMPOSER" = true ]; then
    echo -e "${YELLOW}Installing production backend dependencies...${NC}"
    cd backend
    composer install --no-dev --optimize-autoloader
    cd ..
else
    echo -e "${YELLOW}Skipping composer install (using existing backend/vendor)...${NC}"
fi

# 3. Create temporary deployment structure
echo -e "${YELLOW}Creating deployment package...${NC}"
TEMP_DIR="deploy_temp"
rm -rf "$TEMP_DIR" deploy.tar.gz
mkdir -p "$TEMP_DIR"

# Copy frontend build
cp -r frontend/dist/* "$TEMP_DIR/"

# Copy backend files into api/ directory
mkdir -p "$TEMP_DIR/api"
cp -r backend/src "$TEMP_DIR/api/"
cp -r backend/vendor "$TEMP_DIR/api/"
cp -r backend/public "$TEMP_DIR/api/"

# Copy and update backend production .env
cat <<EOT > "$TEMP_DIR/api/.env"
DB_HOST=$DB_HOST
DB_USER=$DB_USER
DB_PASS=$DB_PASS
DB_NAME=$DB_NAME
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
tar -czf deploy.tar.gz -C "$TEMP_DIR" .
rm -rf "$TEMP_DIR"

# 5. Upload to shared hosting
echo -e "${YELLOW}Uploading package to remote server...${NC}"
if [ -n "$SSHPASS_CMD" ]; then
    eval $SSHPASS_CMD scp -P $SSH_PORT deploy.tar.gz $SSH_USER@$SSH_HOST:$REMOTE_PATH/
else
    scp -P $SSH_PORT deploy.tar.gz $SSH_USER@$SSH_HOST:$REMOTE_PATH/
fi

# 6. Extract package on remote server
echo -e "${YELLOW}Extracting package on remote server and running database migrations...${NC}"
EXTRACT_CMD="cd $REMOTE_PATH && rm -rf assets api index.html && tar -xzf deploy.tar.gz && rm deploy.tar.gz && php api/src/Database/migrate.php"
if [ -n "$SSHPASS_CMD" ]; then
    eval $SSHPASS_CMD ssh -p $SSH_PORT $SSH_USER@$SSH_HOST "$EXTRACT_CMD"
else
    ssh -p $SSH_PORT $SSH_USER@$SSH_HOST "$EXTRACT_CMD"
fi

# Clean up local archive
rm -f deploy.tar.gz

echo -e "${GREEN}Deployment completed successfully!${NC}"
