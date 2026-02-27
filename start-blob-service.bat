@echo off
echo Starting Blob Service...
cd /d "%~dp0blob-service"
uvicorn main:app --port 18432
pause