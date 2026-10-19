@echo off
title Tat:vm Content Manager
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed on this computer.
  echo Install the LTS version from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
echo Starting the Tat:vm Content Manager...
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:4600/admin/"
node cms\server.js
echo.
echo The Content Manager has stopped.
pause
