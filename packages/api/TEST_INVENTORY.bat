@echo off
REM Inventory Alert System - TEST RUNNER for Windows

setlocal enabledelayedexpansion

echo.
echo =========================================
echo  INVENTORY ALERT SYSTEM - TEST RUNNER
echo =========================================
echo.

REM Check if server is running
echo Checking if API server is running on localhost:3001...
powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3001/health' -TimeoutSec 2; Write-Host '✅ API server is running' -ForegroundColor Green } catch { Write-Host '❌ API server is NOT running on port 3001' -ForegroundColor Red; exit 1 }"

if %ERRORLEVEL% neq 0 (
    echo.
    echo ❌ ERROR: API server not running!
    echo.
    echo To start the server, run in another terminal:
    echo   cd c:\Users\SM\Desktop\eBalangay Project
    echo   pnpm dev
    echo.
    pause
    exit /b 1
)

echo.
echo Running tests...
echo.

REM Run PowerShell script
powershell -ExecutionPolicy Bypass -File "%~dp0TEST_INVENTORY.ps1"

if %ERRORLEVEL% neq 0 (
    echo.
    echo ❌ Tests failed!
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ All tests completed successfully!
echo.
pause
