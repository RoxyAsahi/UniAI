@echo off
setlocal enabledelayedexpansion

echo ===============================================
echo   CoAI.Dev One-Click Dev Environment
echo ===============================================

:: 1. Check and Start Docker Containers
echo [1/4] Checking Docker containers (MySQL & Redis)...
docker start coai-dev-mysql 2>nul
docker start coai-dev-redis 2>nul

:: 2. Start Blob Service
if exist "%~dp0blob-service" (
    echo [2/4] Starting Blob Service...
    start "CoAI - Blob Service" cmd /k "cd /d %~dp0blob-service && venv\Scripts\python.exe run.py"
) else (
    echo [2/4] Blob Service directory not found, skipping.
)

:: 3. Start Backend (Hot Reload)
echo [3/4] Starting Backend (air)...
start "CoAI - Backend" cmd /k "cd /d %~dp0 && air"

:: 4. Start Frontend (Hot Reload)
echo [4/4] Starting Frontend (Vite)...
start "CoAI - Frontend" cmd /k "cd /d %~dp0app && pnpm dev"

echo.
echo -----------------------------------------------
echo All services are starting in separate windows!
echo - Frontend: http://localhost:5173
echo - Backend:  http://localhost:8094
echo -----------------------------------------------
echo.
pause
