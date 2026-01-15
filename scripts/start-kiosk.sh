#!/bin/bash

# Configuration
PORT=8080
URL="http://localhost:$PORT"
TMP_PROFILE_DIR=$(mktemp -d -t inflight-kiosk-profile)

echo "Starting IN-FLIGHT Kiosk Mode..."
echo "Using temporary profile: $TMP_PROFILE_DIR"

# Check if http-server is installed in node_modules
if [ -f "./node_modules/.bin/http-server" ]; then
    HTTP_SERVER="./node_modules/.bin/http-server"
else
    # Fallback to npx
    HTTP_SERVER="npx http-server"
fi

echo "Starting local web server on port $PORT..."
$HTTP_SERVER . -p $PORT -c-1 -s &
SERVER_PID=$!

# Wait for server to be responsive
echo "Waiting for server to start..."
count=0
max_retries=10
while ! nc -z localhost $PORT > /dev/null 2>&1; do
    sleep 1
    count=$((count+1))
    if [ $count -ge $max_retries ]; then
        echo "Error: Server failed to start on port $PORT."
        kill $SERVER_PID
        exit 1
    fi
done
echo "Server is up!"

echo "Launching Chrome in Kiosk Mode..."

if [[ "$OSTYPE" == "darwin"* ]]; then

    # MacOS
    CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if [ -f "$CHROME_PATH" ]; then
        # Force fullscreen via AppleScript after a delay as a fallback
        (
            sleep 3
            osascript -e 'tell application "Google Chrome" to activate' \
                      -e 'tell application "System Events" to keystroke "f" using {command down, control down}'
        ) &
        
        # Use --user-data-dir to ensure a fresh, blocking instance
        # Removing --app as it can conflict with kiosk on some versions
        "$CHROME_PATH" --kiosk "$URL" --user-data-dir="$TMP_PROFILE_DIR" --no-first-run --no-default-browser-check
    else
        echo "Error: Google Chrome not found at $CHROME_PATH"
        kill $SERVER_PID
        exit 1
    fi
else
    # Linux / Other (Assumes google-chrome is in PATH)
    CMD=""
    if command -v google-chrome &> /dev/null; then
        CMD="google-chrome"
    elif command -v chromium-browser &> /dev/null; then
        CMD="chromium-browser"
    elif command -v chromium &> /dev/null; then
        CMD="chromium"
    fi

    if [ -n "$CMD" ]; then
         "$CMD" --app="$URL" --kiosk --start-fullscreen --user-data-dir="$TMP_PROFILE_DIR" --no-first-run --no-default-browser-check
    else
        echo "Error: Google Chrome or Chromium not found in PATH."
        kill $SERVER_PID
        exit 1
    fi
fi

echo "Browser closed. Stopping server..."
kill $SERVER_PID
rm -rf "$TMP_PROFILE_DIR"
