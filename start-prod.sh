#!/bin/bash
# Quick production server startup script

# This script starts the production server
# Prerequisites: npm run build must be executed in client/ first

PORT=${PORT:-5000}
NODE_ENV=production

echo "🚀 Starting ZoomClone production server..."
echo "   Port: $PORT"
echo "   Environment: $NODE_ENV"
echo ""

cd "$(dirname "$0")/server" || exit 1

# Install production dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --production
fi

# Start server
PORT=$PORT NODE_ENV=$NODE_ENV node server.js
