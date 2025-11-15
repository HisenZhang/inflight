# Troubleshooting

Common issues and solutions for InFlight.

## Database Issues

### Database Won't Load

**Symptoms:**
- LOAD DATABASE button does nothing
- Loading stalls midway
- Error message appears

**Solutions:**

1. **Check Internet Connection**
   - Database download requires active internet
   - Try loading a website to verify connectivity
   - Switch to WiFi if on cellular (large download)

2. **Clear Browser Cache**
   - Chrome: Settings → Privacy → Clear browsing data
   - Firefox: Settings → Privacy → Clear Data
   - Safari: Settings → Clear History and Website Data
   - Reload InFlight and try again

3. **Check Storage Space**
   - Database requires ~50-100 MB
   - Browser: Settings → Storage
   - Free up space if needed

4. **Try Different Browser**
   - Chrome and Firefox work best
   - Ensure browser is up to date

5. **Disable Browser Extensions**
   - Ad blockers may interfere
   - Privacy extensions may block IndexedDB
   - Try Incognito/Private mode

### Database Loaded But Searches Don't Work

**Symptoms:**
- Autocomplete shows no results
- Waypoints "not found"
- Routes fail to calculate

**Solutions:**

1. **Reindex Database**
   - Go to DATA tab
   - Click REINDEX button
   - Wait for completion

2. **Clear and Reload**
   - Click CLEAR ALL in DATA tab
   - Click LOAD DATABASE again
   - Re-download may fix corruption

3. **Check Browser Console**
   - Press F12 (Windows) or Cmd+Option+I (Mac)
   - Look for JavaScript errors
   - Report errors if found

## Route Calculation Issues

### "Airport Not Found" Error

**Symptoms:**
- Departure or destination shows error
- Red error message appears

**Solutions:**

1. **Verify ICAO Code**
   - Use 4-letter ICAO (KALB not ALB)
   - Check spelling carefully
   - Try autocomplete suggestions

2. **Try IATA Code**
   - Some airports use IATA (3-letter)
   - Example: ORD instead of KORD (both work)

3. **Check Database**
   - Ensure database loaded (DATA tab)
   - Small/private airports may not be included
   - Use nearby alternative airport

### "Waypoint Not Found" in Route

**Symptoms:**
- Route calculation fails
- Specific waypoint highlighted

**Solutions:**

1. **Check Spelling**
   - Use autocomplete to avoid typos
   - Waypoint codes are case-insensitive

2. **Oceanic Waypoints**
   - InFlight only supports US domestic
   - Use alternative route
   - See [Limitations](tab-welcome.md#limitations)

3. **Try Nearby Fix**
   - Use alternative waypoint
   - Airways may use different fixes

### "No Route Found on Airway"

**Symptoms:**
- Airway specified but route fails
- Error mentions airway

**Solutions:**

1. **Check Airway Connectivity**
   - Airway may not connect those waypoints
   - Use intermediate waypoint
   - Example: `V4 WAYPOINT1 V4 WAYPOINT2`

2. **Verify Airway Direction**
   - Some airways are one-way
   - Reverse route or use alternative

3. **Airways Database**
   - Some airways may not be in database
   - Use direct routing as fallback

### Wind Data Unavailable

**Symptoms:**
- "Wind data unavailable" error
- No WCA calculations
- Route calculates but without winds

**Solutions:**

1. **Check Internet**
   - Wind data requires internet connection
   - Verify connectivity in STATS tab

2. **Try Different Forecast Period**
   - 6/12/24 hour forecasts may have different availability
   - NOAA may have outages

3. **Continue Without Winds**
   - Route still calculates
   - Use manual heading calculations
   - Or fly and use GPS ground speed

## GPS Issues

### GPS Permission Denied

**Symptoms:**
- "Location permission denied" message
- GPS status shows DENIED
- Map won't track position

**Solutions:**

**Chrome/Edge (Desktop):**
1. Click lock icon in address bar
2. Location → Allow
3. Refresh page

**Firefox (Desktop):**
1. Click info icon in address bar
2. Permissions → Location → Allow
3. Refresh page

**Safari (iOS):**
1. Settings → Safari → Location
2. Select "Ask" or "Allow"
3. Close and reopen InFlight

**Chrome (Android):**
1. Settings → Site settings → Location
2. Allow for InFlight
3. Or grant when prompted

### GPS Not Updating

**Symptoms:**
- Position frozen
- Aircraft doesn't move on map
- GPS shows ACTIVE but no updates

**Solutions:**

1. **Wait for Fix**
   - Initial fix can take 30-60 seconds
   - Requires clear view of sky
   - Move away from buildings/trees

2. **Check Device GPS**
   - Open Maps app to verify GPS works
   - If Maps doesn't work, device issue
   - Restart device

3. **Airplane Mode**
   - Toggle airplane mode off/on (mobile)
   - Resets GPS receiver
   - Wait for reacquisition

4. **Refresh Page**
   - Reload InFlight
   - Re-grant location permission
   - GPS may reinitialize

### Inaccurate Position

**Symptoms:**
- GPS shows wrong location
- H-ACC very high (>100M)
- Position jumps around

**Solutions:**

1. **Improve Sky View**
   - Move to open area
   - Away from buildings, trees, canyons
   - GPS needs satellite line-of-sight

2. **Wait for Better Accuracy**
   - H-ACC improves over time
   - More satellites acquired
   - Typically takes 1-2 minutes

3. **Calibrate Compass** (Mobile):
   - Android: Move device in figure-8 pattern
   - iOS: Settings → Privacy → Location → Compass Calibration
   - Improves heading accuracy

4. **Check Interference**
   - Metal structures block GPS
   - Electronic interference possible
   - Move away from interference sources

## Map Display Issues

### Map Not Showing

**Symptoms:**
- MAP tab is blank
- No route displayed
- White/black screen

**Solutions:**

1. **Calculate Route First**
   - Must have route calculated
   - Go to ROUTE tab
   - Click CALCULATE

2. **Check Browser Compatibility**
   - Use modern browser (Chrome, Firefox, Safari, Edge)
   - Update browser to latest version
   - Avoid IE11 or older browsers

3. **JavaScript Errors**
   - Press F12 for console
   - Look for errors
   - Report if found

### Waypoint Announcements Not Working

**Symptoms:**
- No voice announcements
- Silent when passing waypoints
- TTS not speaking

**Solutions:**

1. **Check Volume**
   - Device volume up
   - Not muted
   - Test with other apps

2. **Browser TTS Support**
   - Chrome and Safari work best
   - Firefox has limited TTS
   - Some browsers don't support speech

3. **Test TTS**
   - Browser console: `speechSynthesis.speak(new SpeechSynthesisUtterance("test"))`
   - If this doesn't work, browser doesn't support TTS

4. **System TTS Settings**
   - Some devices require TTS engine installed
   - Android: Download Google TTS
   - Check system accessibility settings

### Device Won't Vibrate

**Symptoms:**
- No vibration on waypoint passage
- Haptic feedback missing

**Solutions:**

1. **Mobile Only**
   - Desktop browsers don't support vibration
   - Use mobile device for this feature

2. **Check Settings**
   - Device vibration enabled in system settings
   - Not in silent mode (some devices)

3. **iOS Limitations**
   - iOS has limited web vibration support
   - May not work on all iOS devices
   - Known limitation

## Performance Issues

### Slow Database Loading

**Symptoms:**
- Takes >2 minutes to load
- Progress stalls
- Browser becomes unresponsive

**Solutions:**

1. **Be Patient**
   - First load can take 60+ seconds
   - Large dataset being processed
   - Don't close browser

2. **Close Other Tabs**
   - Free up memory
   - Reduce CPU load
   - Improves processing speed

3. **Faster Connection**
   - Use WiFi instead of cellular
   - Higher bandwidth helps
   - Download speed varies

### Slow Route Calculation

**Symptoms:**
- CALCULATE button takes long time
- Browser "Not Responding"
- Eventually completes

**Solutions:**

1. **Complex Routes**
   - Airways expansion is intensive
   - Long routes take more time
   - 30-60 seconds normal for complex routes

2. **Wind Data Fetch**
   - Internet fetch adds time
   - NOAA API can be slow
   - Usually completes within 30 seconds

3. **Close Other Apps**
   - Free up device resources
   - Improves calculation speed

## Storage Issues

### "Out of Storage" Error

**Symptoms:**
- Cannot save tracks
- Database load fails
- Browser storage full

**Solutions:**

1. **Export Tracks**
   - Save tracks you want to keep
   - Export as GPX files

2. **Clear Old Tracks**
   - Go to DATA tab
   - CLEAR ALL TRACKS
   - Frees up significant space

3. **Clear Browser Data**
   - Clear cache from other websites
   - Browser Settings → Storage → Clear
   - Keep InFlight data if possible

4. **Increase Storage**
   - Some browsers allow storage increase
   - Chrome: Unlimited storage mode
   - Check browser documentation

### Tracks Not Saving

**Symptoms:**
- Track records during flight
- Disappears after landing
- Not in DATA tab

**Solutions:**

1. **Wait for Save**
   - Auto-save happens after landing detected
   - May take 10-30 seconds
   - Don't close browser immediately

2. **Manual Export**
   - Export from STATS tab before closing
   - Saves current track immediately

3. **Storage Space**
   - Check available storage
   - Clear old tracks if needed

## Display Issues

### Text Too Small

**Symptoms:**
- Hard to read on mobile
- Needs zooming
- Uncomfortable reading

**Solutions:**

1. **Browser Zoom**
   - Ctrl/Cmd + Plus to zoom in
   - Mobile: Pinch to zoom
   - Settings → Accessibility → Text Size

2. **Larger Device**
   - Use tablet instead of phone
   - Desktop has more space
   - Recommended for complex planning

### Dark Mode Too Dark

**Symptoms:**
- Can't read in bright cockpit
- Screen too dim

**Solutions:**

1. **Increase Brightness**
   - Device screen brightness to max
   - Disable auto-brightness
   - Use max brightness for cockpit

2. **Screen Readable in Sun**
   - Find optimal angle
   - Use sun shade/hood
   - High-brightness devices work best

## Export/Import Issues

### Navlog Export Fails

**Symptoms:**
- EXPORT button doesn't work
- No file downloads
- Error message

**Solutions:**

1. **Check Downloads Enabled**
   - Browser may block downloads
   - Allow downloads in settings
   - Check popup blocker

2. **Try Different Browser**
   - Some browsers handle downloads differently
   - Chrome/Firefox most reliable

3. **Check Disk Space**
   - Ensure space for download
   - File is small (~10-100 KB)

### Navlog Import Fails

**Symptoms:**
- IMPORT doesn't load file
- Error reading file
- Route doesn't appear

**Solutions:**

1. **Verify File Format**
   - Must be JSON file from InFlight
   - Exported via EXPORT button
   - Not GPX or other format

2. **File Not Corrupted**
   - Re-export if possible
   - Open in text editor to verify JSON
   - Must be valid JSON structure

3. **Database Loaded**
   - Database must be loaded
   - Waypoints in file must exist
   - Load database first

## Still Having Issues?

If problems persist:

1. **Try Different Browser** - Chrome recommended
2. **Update Browser** - Ensure latest version
3. **Clear Everything** - Full browser reset and reload
4. **Check Device** - Try different device
5. **Report Bug** - Open GitHub issue with details:
   - Browser and version
   - Device and OS
   - Steps to reproduce
   - Error messages
   - Screenshots if helpful

---

**Most issues can be resolved by reloading the page, clearing cache, or using a different browser.**
