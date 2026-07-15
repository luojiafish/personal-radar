@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul || (
  echo [Personal Radar] Node.js was not found. Run setup-windows.cmd after installing Node.js 24.
  exit /b 1
)

node -e "process.exit(Number(process.versions.node.split('.')[0]) === 24 ? 0 : 1)" || (
  echo [Personal Radar] Node.js 24 is required. Run setup-windows.cmd with the supported version.
  exit /b 1
)

where npm.cmd >nul 2>nul || (
  echo [Personal Radar] npm was not found. Run setup-windows.cmd first.
  exit /b 1
)

if not exist "node_modules\.bin\next.cmd" (
  echo [Personal Radar] Dependencies are missing. Run setup-windows.cmd first.
  exit /b 1
)

if not exist ".next\BUILD_ID" (
  echo [Personal Radar] Production build is missing. Run setup-windows.cmd first.
  exit /b 1
)

set "NEXT_TELEMETRY_DISABLED=1"

echo [Personal Radar] Applying any pending local database migrations...
call npm.cmd run db:migrate || exit /b 1

echo [Personal Radar] Starting at http://127.0.0.1:3210
call npm.cmd start
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /b %EXIT_CODE%
