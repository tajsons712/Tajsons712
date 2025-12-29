@echo off
title Taj Sons Server Control Panel
@echo off
cls
color 0f

echo ===============================================
echo               Taj Sons - SERVER STORE
echo ========================================================
echo.
echo [1] Starting Local Server...
start "Taj Backend" cmd /k "node server.js"
echo    - Backend started on Port 3000
echo.

timeout /t 5 /nobreak >nul

echo [2] Connecting to Internet (Public Link)...
echo    - Generating secure link...
echo.
echo ========================================================
echo    YOUR PUBLIC LINK WILL APPEAR IN THE NEW WINDOW
echo    Use that link to access your store from anywhere!
echo ========================================================
echo.
:: Attempt to get a custom subdomain, falling back to random if taken
start "Taj Public Link" cmd /k "npx localtunnel --port 3000 --subdomain taj-studio-store"

pause
