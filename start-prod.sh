#!/bin/bash
# Quick production server startup script

# This script starts the production server
# Prerequisites: npm run build must be executed in client/ first

PORT=${PORT:-5000}
NODE_ENV=production
HTTPS=${HTTPS:-true}
SSL_KEY_PATH=${SSL_KEY_PATH:-certs/localhost-key.pem}
SSL_CERT_PATH=${SSL_CERT_PATH:-certs/localhost.pem}

echo "🚀 Starting Oguz Meeting production server..."
echo "   Port: $PORT"
echo "   Environment: $NODE_ENV"
echo "   HTTPS: $HTTPS"
echo ""

cd "$(dirname "$0")/server" || exit 1

# Install production dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --production
fi

# Start server
PORT=$PORT NODE_ENV=$NODE_ENV HTTPS=$HTTPS SSL_KEY_PATH=$SSL_KEY_PATH SSL_CERT_PATH=$SSL_CERT_PATH node server.js
