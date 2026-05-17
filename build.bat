@echo off
REM Production build and startup script for Windows

echo.
echo Building client...
cd client
call npm install
call npm run build
cd ..

echo.
echo Installing server dependencies...
cd server
call npm install --production
cd ..

echo.
echo Build complete!
echo.
echo To start the production server, run:
echo    cd server ^&^& node server.js
echo.
echo Or with a custom port:
echo    cd server ^&^& set PORT=3000 ^&^& node server.js
echo.
