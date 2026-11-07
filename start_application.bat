@echo off
title Hierarchy Project - Private Network Launcher
cls
echo =====================================================================
echo       Hierarchy Task Management System - Private Network Host
echo =====================================================================
echo.

:: Detect primary IPv4 address on private network
for /f "tokens=*" %%a in ('powershell -NoProfile -Command "@((Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp,Manual).IPAddress) -match '^(192\.168|10\.|172\.)' | Select-Object -First 1"') do (
    set HOST_IP=%%a
)

if "%HOST_IP%"=="" (
    set HOST_IP=localhost
)

echo [INFO] Host Local IP Address: %HOST_IP%
echo.
echo =====================================================================
echo  ACCESS URLS FOR DEVICES ON YOUR PRIVATE NETWORK:
echo    - Main Application:   http://%HOST_IP%:3000
echo    - Backend API Docs:   http://%HOST_IP%:8000/docs
echo.
echo  ACCESS URLS FOR THIS HOST COMPUTER:
echo    - Main Application:   http://localhost:3000
echo    - Backend API Docs:   http://localhost:8000/docs
echo =====================================================================
echo.
echo Starting Backend (FastAPI on 0.0.0.0:8000)...
start "Hierarchy Backend (0.0.0.0:8000)" cmd /k "cd /d %~dp0backend && venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo Starting Frontend (Next.js on 0.0.0.0:3000)...
start "Hierarchy Frontend (0.0.0.0:3000)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Both servers are launching in dedicated console windows.
echo To stop them, simply close the respective windows or press Ctrl+C in them.
echo.
pause
