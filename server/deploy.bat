@echo off
SETLOCAL EnableDelayedExpansion

:: Kill any existing Node.js processes
echo Cleaning up existing Node.js processes...
taskkill /F /IM node.exe /T >nul 2>&1

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)

echo Setting up project...

:: Create and activate virtual environment for any Python dependencies
if not exist .venv (
    echo Creating virtual environment...
    python -m venv .venv
    if !ERRORLEVEL! NEQ 0 (
        echo Error: Failed to create virtual environment
        exit /b 1
    )
)

:: Activate virtual environment
call .venv\Scripts\activate
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to activate virtual environment
    exit /b 1
)

:: Clean install frontend dependencies
echo Installing frontend dependencies...
cd ..
echo Cleaning node_modules and package-lock.json...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f package-lock.json
echo Installing dependencies with --legacy-peer-deps...
call npm install --legacy-peer-deps
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to install frontend dependencies
    exit /b 1
)

:: Build frontend
echo Building frontend...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to build frontend
    exit /b 1
)

:: Install backend dependencies
echo Installing backend dependencies...
cd server
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f package-lock.json
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to install backend dependencies
    exit /b 1
)

:: Check if port 3000 is in use
netstat -ano | findstr :3000
if %ERRORLEVEL% EQU 0 (
    echo Warning: Port 3000 is already in use
    echo Attempting to free the port...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
        taskkill /F /PID %%a
    )
    timeout /t 2 /nobreak >nul
)

:: Start the server
echo Starting server...
echo Server logs will appear below. Press Ctrl+C to stop the server.
echo.
node server.js

ENDLOCAL
