#!/bin/bash
set -e

echo "=== Shiksha Pilot — Entrypoint ==="

# Wait for MySQL to be ready
echo "Waiting for database to be ready..."
until php -r "
    \$dsn = 'mysql:host=' . getenv('DB_HOST') . ';charset=utf8mb4';
    try {
        new PDO(\$dsn, getenv('DB_USER'), getenv('DB_PASS'), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        exit(0);
    } catch (Exception \$e) {
        exit(1);
    }
" 2>/dev/null; do
  echo "  Database not ready, retrying in 2s..."
  sleep 2
done
echo "  Database is ready."

# Run migrations
echo ""
php /var/www/html/src/Database/migrate.php

echo ""
echo "Starting Apache..."
exec apache2-foreground
