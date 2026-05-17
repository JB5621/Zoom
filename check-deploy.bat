@echo off
REM Production readiness check script for Windows

echo.
echo 🔍 ZoomClone Production Readiness Checklist
echo ===========================================
echo.

REM Check Node.js
where node >nul 2>nul
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✅ Node.js installed: %NODE_VERSION%
) else (
    echo ❌ Node.js not found. Install from https://nodejs.org/
    exit /b 1
)

REM Check npm
where npm >nul 2>nul
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo ✅ npm installed: %NPM_VERSION%
) else (
    echo ❌ npm not found.
    exit /b 1
)

echo.
echo 📦 Checking project structure...

REM Check directories
if exist "server\" (
    echo ✅ server\ directory exists
) else (
    echo ❌ server\ directory missing
    exit /b 1
)

if exist "client\" (
    echo ✅ client\ directory exists
) else (
    echo ❌ client\ directory missing
    exit /b 1
)

REM Check package.json files
if exist "server\package.json" (
    echo ✅ server\package.json exists
) else (
    echo ❌ server\package.json missing
    exit /b 1
)

if exist "client\package.json" (
    echo ✅ client\package.json exists
) else (
    echo ❌ client\package.json missing
    exit /b 1
)

REM Check dist folder
if exist "client\dist\" (
    echo ✅ client\dist exists
) else (
    echo ⚠️  client\dist not found. Run: cd client ^&^& npm run build
)

echo.
echo 🚀 Production Deployment Ready!
echo.
echo 📝 Next steps:
echo   1. Set environment variables:
echo      set PORT=5000
echo      set NODE_ENV=production
echo.
echo   2. Start server:
echo      cd server
echo      npm install --production
echo      node server.js
echo.
echo ✅ Server will serve:
echo    - Frontend at http://localhost:5000/
echo    - API at http://localhost:5000/api/*
echo    - Socket.io at http://localhost:5000/socket.io
echo.
