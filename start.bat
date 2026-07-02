@echo off
cd /d "%~dp0"
title Skynet Nexus News - Dev Server

echo.
echo  =======================================================
echo   SKYNET NEXUS NEWS  -  local development server
echo  =======================================================
echo.

REM --- Check Node ---
where node >nul 2>&1
if errorlevel 1 (
  echo [!] Node.js is not installed or not in PATH.
  echo     Download Node 22 or newer from: https://nodejs.org
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do set "NODEV=%%v"
echo  Node version: %NODEV%
echo.

REM --- Install deps if missing ---
if not exist "node_modules" (
  echo  [1/3] Installing dependencies ^(first run only^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo [!] npm install failed. Aborting.
    pause
    exit /b 1
  )
  echo.
) else (
  echo  [1/3] Dependencies present.
  echo.
)

REM --- Ensure .env exists (Node does the heavy lifting) ---
if not exist ".env" (
  echo  [2/3] Creating .env with a fresh SESSION_SECRET...
  node scripts\bootstrap-env.js
  if errorlevel 1 (
    echo [!] Could not create .env.
    pause
    exit /b 1
  )
  echo.
) else (
  echo  [2/3] .env present.
  echo.
)

REM --- Start ---
echo  [3/3] Starting server on http://localhost:4180
echo.
echo       Press Ctrl+C to stop the server.
echo  -------------------------------------------------------
echo.

REM Open browser after 2 seconds (fire-and-forget)
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:4180"

node server\index.js

echo.
echo  Server stopped.
pause
