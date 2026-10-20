@echo off
setlocal
chcp 65001 >nul
title Lead Scraper
cd /d "%~dp0app"

rem Settings for this PC only. 127.0.0.1 = reachable from this PC alone, never from the network.
set NODE_ENV=production
set PORT=3210
set HOSTNAME=127.0.0.1
set NEXT_TELEMETRY_DISABLED=1

if not exist "..\.env" (
  echo The .env file is missing next to start.bat.
  echo Ask your admin for the complete package.
  echo.
  pause
  exit /b 1
)

echo.
echo   Lead Scraper is starting on http://localhost:%PORT%
echo   Your browser will open in a few seconds.
echo.
echo   KEEP THIS WINDOW OPEN while you work - scrapes run inside it.
echo   Close it to stop the app.
echo.

rem Open the browser once the server has had a moment to start.
start "" /min cmd /c "ping -n 6 127.0.0.1 >nul & start http://localhost:%PORT%"

"..\node\node.exe" --env-file=..\.env server.js

echo.
echo   The app stopped. If that was not on purpose, the message above says why.
echo.
pause
