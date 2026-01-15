@echo off
echo Starting IN-FLIGHT Kiosk Mode...

SET PORT=8080
SET URL=http://localhost:%PORT%

echo Starting local web server...
start "InFlight Server" /MIN npx http-server . -p %PORT% -c-1 -s

echo Waiting for server...
timeout /t 2 /nobreak >nul

echo Launching Chrome...
start chrome --kiosk "%URL%" --new-window --no-first-run --no-default-browser-check

echo.
echo Process started. Close the server window to stop the web server.
pause
