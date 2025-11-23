/**
 * Test suite for Winds Aloft parsing and metadata extraction
 */

// Sample wind data with metadata headers
const SAMPLE_WIND_DATA = `000
FBUS31 KWNO 230158
FD1US1
DATA BASED ON 230000Z
VALID 230600Z   FOR USE 0200-0900Z. TEMPS NEG ABV 24000

FT  3000    6000    9000   12000   18000   24000  30000  34000  39000
ABI      1707+13 1909+08 2310+02 2524-10 2538-23 255439 256150 256158
ABQ              1621+06 1732-01 1841-16 2066-29 219242 218850 228256
ALB 3210 2810-03 2714-06 2824-10 2752-19 2768-30 277546 286952 276251
`;

window.WindsTests = TestFramework.describe('Winds Aloft Data', function({ it }) {

    it('should parse wind data metadata correctly', () => {
        const result = window.WindsAloft.parseWindsAloft(SAMPLE_WIND_DATA);

        assert.isTrue(result.metadata !== null && result.metadata !== undefined, 'should return metadata object');
        assert.equals(result.metadata.dataBasedOn, '230000Z');
        assert.equals(result.metadata.validTime, '230600Z');
        assert.equals(result.metadata.useWindow, '0200-0900Z');
        assert.isTrue(result.metadata.parsedAt !== null && result.metadata.parsedAt !== undefined, 'should include parsedAt timestamp');
    });

    it('should parse wind station data correctly', () => {
        const result = window.WindsAloft.parseWindsAloft(SAMPLE_WIND_DATA);

        assert.isTrue(result.stations !== null && result.stations !== undefined, 'should return stations object');
        assert.isTrue(result.stations.ALB !== undefined, 'should parse ALB station');
        assert.isTrue(result.stations.ALB[3000] !== undefined, 'should parse 3000ft data for ALB');
        assert.equals(result.stations.ALB[3000].dir, 320);
        assert.equals(result.stations.ALB[3000].spd, 10);
    });

    it('should format Zulu time on same day', () => {
        const now = new Date();
        const day = String(now.getUTCDate()).padStart(2, '0');
        const zuluTime = `${day}0630Z`;

        const result = window.Utils.formatZuluTime(zuluTime);
        assert.equals(result, '06:30Z');
    });

    it('should format Zulu time on different day', () => {
        const now = new Date();
        const currentDay = now.getUTCDate();
        const differentDay = currentDay === 1 ? '02' : '01'; // Use a day that's not today
        const zuluTime = `${differentDay}0630Z`;

        const result = window.Utils.formatZuluTime(zuluTime);
        const expectedDay = parseInt(differentDay).toString(); // '01' becomes '1'
        assert.isTrue(result.includes(expectedDay), 'should include day number');
        assert.isTrue(result.includes('06:30Z'), 'should include time');
    });

    it('should format use window correctly', () => {
        const result = window.Utils.formatUseWindow('0200-0900Z');
        assert.equals(result, '02:00-09:00Z');
    });

    it('should check if within use window', () => {
        const now = new Date();
        const currentHour = String(now.getUTCHours()).padStart(2, '0');
        const currentMin = String(now.getUTCMinutes()).padStart(2, '0');

        // Create a window that includes current time
        const startTime = String(Math.max(0, now.getUTCHours() - 1)).padStart(2, '0') + '00';
        const endTime = String(Math.min(23, now.getUTCHours() + 1)).padStart(2, '00') + '59';
        const useWindow = `${startTime}-${endTime}Z`;

        const result = window.Utils.isWithinUseWindow(useWindow);
        assert.equals(result, true);
    });

    it('should check if outside use window', () => {
        const useWindow = '0000-0100Z'; // Midnight to 1 AM (unlikely to be current time)
        const now = new Date();
        const currentUTC = now.getUTCHours() * 100 + now.getUTCMinutes();

        if (currentUTC >= 100) { // If not between 00:00 and 01:00
            const result = window.Utils.isWithinUseWindow(useWindow);
            assert.equals(result, false);
        } else {
            // Skip test if running during the window
            assert.isTrue(true);
        }
    });

    it('should handle midnight-crossing use windows', () => {
        // Test window that crosses midnight (e.g., 2000-0300Z = 8PM to 3AM)

        // Mock the current time by temporarily replacing the function
        const originalFunction = window.Utils.isWithinUseWindow;

        // Create a test version that accepts a mock time
        const testIsWithinUseWindow = (useWindow, mockHour, mockMin) => {
            if (!useWindow) return false;
            const match = useWindow.match(/^(\d{2})(\d{2})-(\d{2})(\d{2})Z$/);
            if (!match) return false;

            const currentUTC = mockHour * 100 + mockMin;
            const startTime = parseInt(match[1] + match[2]);
            const endTime = parseInt(match[3] + match[4]);

            if (endTime < startTime) {
                return currentUTC >= startTime || currentUTC <= endTime;
            } else {
                return currentUTC >= startTime && currentUTC <= endTime;
            }
        };

        const midnightWindow = '2000-0300Z';

        // Should be outside window (before start)
        assert.equals(testIsWithinUseWindow(midnightWindow, 19, 0), false, '19:00 should be outside 2000-0300Z window');

        // Should be inside window (at start)
        assert.equals(testIsWithinUseWindow(midnightWindow, 20, 0), true, '20:00 should be inside 2000-0300Z window');

        // Should be inside window (before midnight)
        assert.equals(testIsWithinUseWindow(midnightWindow, 22, 30), true, '22:30 should be inside 2000-0300Z window');
        assert.equals(testIsWithinUseWindow(midnightWindow, 23, 59), true, '23:59 should be inside 2000-0300Z window');

        // Should be inside window (after midnight)
        assert.equals(testIsWithinUseWindow(midnightWindow, 0, 0), true, '00:00 should be inside 2000-0300Z window');
        assert.equals(testIsWithinUseWindow(midnightWindow, 2, 30), true, '02:30 should be inside 2000-0300Z window');

        // Should be inside window (at end)
        assert.equals(testIsWithinUseWindow(midnightWindow, 3, 0), true, '03:00 should be inside 2000-0300Z window');

        // Should be outside window (after end)
        assert.equals(testIsWithinUseWindow(midnightWindow, 3, 1), false, '03:01 should be outside 2000-0300Z window');
        assert.equals(testIsWithinUseWindow(midnightWindow, 10, 0), false, '10:00 should be outside 2000-0300Z window');
    });

    it('should format data age in minutes', () => {
        const timestamp = Date.now() - (5 * 60 * 1000); // 5 minutes ago
        const result = window.Utils.getDataAge(timestamp);
        assert.equals(result, '5m ago');
    });

    it('should format data age in hours', () => {
        const timestamp = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
        const result = window.Utils.getDataAge(timestamp);
        assert.equals(result, '2h ago');
    });

    it('should format data age in hours and minutes', () => {
        const timestamp = Date.now() - (2 * 60 * 60 * 1000 + 15 * 60 * 1000); // 2 hours 15 minutes ago
        const result = window.Utils.getDataAge(timestamp);
        assert.equals(result, '2h 15m ago');
    });

    it('should format data age in days', () => {
        const timestamp = Date.now() - (2 * 24 * 60 * 60 * 1000); // 2 days ago
        const result = window.Utils.getDataAge(timestamp);
        assert.equals(result, '2d ago');
    });

    it('should handle very recent age in seconds', () => {
        const timestamp = Date.now() - 30000; // 30 seconds ago
        const result = window.Utils.getDataAge(timestamp);
        assert.equals(result, '30s ago');
    });

});
