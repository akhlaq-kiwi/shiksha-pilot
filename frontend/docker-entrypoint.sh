#!/bin/sh
set -e

echo "=== Shiksha Pilot — Frontend Entrypoint ==="
echo "Installing / syncing dependencies..."
npm install
echo "Starting Vite dev server..."
exec npm run dev
