#!/bin/bash
# Production build and startup script

set -e

echo "🔨 Building client..."
cd client
npm install
npm run build
cd ..

echo "📦 Installing server dependencies..."
cd server
npm install --production
cd ..

echo "✅ Build complete!"
echo ""
echo "📝 To start the production server, run:"
echo "   cd server && PORT=5000 node server.js"
echo ""
echo "📝 Or with a custom port:"
echo "   cd server && PORT=3000 node server.js"
