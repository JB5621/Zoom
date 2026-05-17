@echo off
REM Quick production server startup script for Windows

setlocal enabledelayedexpansion

REM Set port (default 5000)
if "%PORT%"=="" set PORT=5000

set NODE_ENV=production

echo.
echo 🚀 Starting ZoomClone production server...
echo    Port: %PORT%
echo    Environment: %NODE_ENV%
echo.

cd /d "%~dp0\server" || exit /b 1

REM Install production dependencies if needed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install --production
)

REM Start server
set PORT=%PORT%
set NODE_ENV=%NODE_ENV%
node server.js
