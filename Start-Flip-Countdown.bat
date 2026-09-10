@echo off
title FLIP Countdown
cd /d "%~dp0"
if "%PORT%"=="" set PORT=8000
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo.
  echo  Node.js was not found. Install it from https://nodejs.org/
  echo  then double-click this file again.
  echo.
  pause
  exit /b 1
)
echo Starting FLIP Countdown at http://localhost:%PORT%/ ...
start "" "http://localhost:%PORT%/"
node server.js
pause
