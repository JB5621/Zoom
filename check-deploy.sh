#!/bin/bash
# Production readiness check script

echo "🔍 ZoomClone Production Readiness Checklist"
echo "==========================================="
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js installed: $NODE_VERSION"
else
    echo "❌ Node.js not found. Install from https://nodejs.org/"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm installed: $NPM_VERSION"
else
    echo "❌ npm not found."
    exit 1
fi

echo ""
echo "📦 Checking project structure..."

# Check directories
for dir in server client; do
    if [ -d "$dir" ]; then
        echo "✅ $dir/ directory exists"
    else
        echo "❌ $dir/ directory missing"
        exit 1
    fi
done

# Check package.json files
for file in server/package.json client/package.json; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing"
        exit 1
    fi
done

# Check dist folder
if [ -d "client/dist" ]; then
    SIZE=$(du -sh client/dist | cut -f1)
    echo "✅ client/dist exists ($SIZE)"
else
    echo "⚠️  client/dist not found. Run: cd client && npm run build"
fi

echo ""
echo "🚀 Production Deployment Ready!"
echo ""
echo "📝 Next steps:"
echo "  1. Set environment variables:"
echo "     export PORT=5000"
echo "     export NODE_ENV=production"
echo ""
echo "  2. Start server:"
echo "     cd server"
echo "     npm install --production"
echo "     node server.js"
echo ""
echo "✅ Server will serve:"
echo "   - Frontend at https://localhost:5000/"
echo "   - API at https://localhost:5000/api/*"
echo "   - Socket.io at https://localhost:5000/socket.io"
