@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul || (
  echo [Personal Radar] Node.js 24 was not found in PATH.
  echo Install Node.js 24, reopen this window, and run setup-windows.cmd again.
  exit /b 1
)

node -e "process.exit(Number(process.versions.node.split('.')[0]) === 24 ? 0 : 1)" || (
  echo [Personal Radar] Node.js 24 is required. Current version:
  node --version
  exit /b 1
)

where npm.cmd >nul 2>nul || (
  echo [Personal Radar] npm 11 was not found in PATH.
  exit /b 1
)

for /f "tokens=1 delims=." %%V in ('npm.cmd --version') do set "NPM_MAJOR=%%V"
if %NPM_MAJOR% LSS 11 (
  echo [Personal Radar] npm 11 or newer is required. Current version:
  call npm.cmd --version
  exit /b 1
)

if not exist "package-lock.json" (
  echo [Personal Radar] package-lock.json is missing. Download a complete project copy.
  exit /b 1
)

set "NEXT_TELEMETRY_DISABLED=1"

echo [Personal Radar] Installing the locked dependencies...
call npm.cmd ci || exit /b 1

echo [Personal Radar] Migrating the local SQLite database...
call npm.cmd run db:migrate || exit /b 1

echo [Personal Radar] Creating the production build...
call npm.cmd run build || exit /b 1

echo [Personal Radar] Setup complete.
echo Run start-personal-radar.cmd, then open http://127.0.0.1:3210
endlocal
