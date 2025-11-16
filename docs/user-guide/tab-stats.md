# STATS Tab

The STATS tab provides real-time flight monitoring, GPS tracking, and fuel calculations.

## Flight Status

A large indicator at the top of the screen shows your current status. It displays **ON GROUND** when GPS shows less than 40 knots or when GPS is unavailable, and automatically switches to **IN FLIGHT** when GPS exceeds 40 knots. This detection is automatic and requires no button press.

## System Status

The system status card shows your current internet connectivity (ONLINE, OFFLINE, or CHECKING), GPS status (CHECKING, ACTIVE, DENIED, or UNAVAILABLE), and GPS accuracy in both horizontal and vertical dimensions.

**GPS H-ACC** shows horizontal accuracy in feet (lower is better), while **GPS V-ACC** shows vertical accuracy. Typical in-flight accuracy is ±10-50 feet horizontally.

## Fuel Statistics

Fuel statistics only appear if you enabled fuel planning in the ROUTE tab.

**REM (Remaining)** shows fuel currently left in gallons. **ENDUR (Endurance)** calculates how long you can fly on remaining fuel in hours and minutes. **USED** tracks fuel burned since takeoff, while **START** shows the initial fuel on board at engine start.

These values auto-calculate using your flight time and the burn rate from the ROUTE tab, updating every second during flight.

The display uses color coding: green when remaining fuel exceeds reserve plus 30 minutes, yellow when below reserve plus 30 minutes, and red when below reserve (indicating you should land immediately).

Remember that these are estimates only. Always monitor your actual fuel gauges.

## Flight Time & Performance

**TIME** shows flight duration since takeoff in hours, minutes, and seconds. **T/O** displays takeoff time in 24-hour local time format.

**AVG GS** calculates your average ground speed since takeoff in knots. **DIST** tracks total distance traveled from the GPS track in nautical miles.

All values auto-calculate from GPS data.

## GPS Track Recording

The tracker operates in two modes: AUTO (default) or MANUAL.

In **AUTO mode**, recording starts automatically when you're airborne (above 40 knots) and stops when you land (below 40 knots for 10+ seconds). This requires zero pilot workload.

In **MANUAL mode**, you control recording by clicking **START** to begin and **STOP** to end. This is useful for ground testing or recording specific flight segments.

The **REC** status shows INACTIVE when not recording and ACTIVE (in red) when recording. **PTS (Points)** displays the number of GPS positions logged so far.

Two buttons are available: **EXPORT** downloads the current track as a GeoJSON file, while **CLEAR** deletes the current track (saved tracks remain in the DATA tab).

The track format is GeoJSON LineString, including timestamp, position, altitude, speed, heading, and accuracy for each point.

## Logbook Times

You can manually enter engine hours in the logbook section. **Hobbs Start/End** fields record the engine hour meter before and after flight, while **Tach Start/End** fields record tachometer readings.

The **Totals** (END minus START) calculate automatically. Use these values for logbook entries and maintenance tracking.

## How It Works

The system detects takeoff when GPS speed exceeds 40 knots, which starts the flight timer and fuel tracking. During flight, all values update every 1 second. Landing is detected when GPS speed drops below 40 knots for 10+ seconds, which stops the timer and saves the track to localStorage.

No internet is required except for the initial database load.

## Typical Workflow

Before flight, verify GPS is ACTIVE, enter your Hobbs and Tach START values, and set the track mode (AUTO is recommended).

During flight, monitor fuel remaining versus ETE, check that the track is recording (PTS should be increasing), and glance at AVG GS for performance verification.

After landing, the track stops automatically in AUTO mode. Enter your Hobbs and Tach END values (totals calculate automatically), click EXPORT to save the track, and note DIST and TIME for your logbook.

## Troubleshooting

If flight status stays ON GROUND, check that GPS is ACTIVE and you're exceeding 40 knots ground speed. It may take 5-10 seconds after takeoff to detect.

If fuel stats don't appear, you need to enable fuel planning in the ROUTE tab and calculate a route first.

If the track isn't recording, verify GPS is ACTIVE. In AUTO mode, you need to exceed 40 knots to start. In MANUAL mode, click the START button.

If GPS accuracy is poor (over 100 feet), move your device to a window and wait for better satellite lock. Typical in-flight accuracy is ±10-50 feet.

---

**Monitor your flight in real-time.** All data updates automatically while you fly the airplane.
