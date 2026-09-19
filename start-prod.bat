@echo off
REM Quick production server startup script for Windows

setlocal enabledelayedexpansion

REM Set port (default 5000)
if "%PORT%"=="" set PORT=5000

set NODE_ENV=production
if "%HTTPS%"=="" set HTTPS=true
if "%SSL_KEY_PATH%"=="" set SSL_KEY_PATH=certs\localhost-key.pem
if "%SSL_CERT_PATH%"=="" set SSL_CERT_PATH=certs\localhost.pem

echo.
echo 🚀 Starting Oguz Meeting production server...
echo    Port: %PORT%
echo    Environment: %NODE_ENV%
echo    HTTPS: %HTTPS%
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
set HTTPS=%HTTPS%
set SSL_KEY_PATH=%SSL_KEY_PATH%
set SSL_CERT_PATH=%SSL_CERT_PATH%
node server.js
