# Data Integrity & Safety

## Why Data Integrity Matters

IN-FLIGHT stores critical aviation data including:
- **70,000+ airport locations** (coordinates, elevations, runways)
- **10,000+ navaid positions** (VORs, NDBs, GPS waypoints)
- **Airways and procedures** (routes, departure/arrival procedures)

**If this data becomes corrupted**, you could end up with:
- Wrong airport coordinates → navigate to wrong location
- Incorrect navaid frequencies → unable to tune navigation radios
- Missing airway waypoints → invalid route calculations

**Data corruption** can happen due to:
- Browser crashes during data save
- Disk errors or storage failures
- Browser bugs in IndexedDB implementation
- Power loss during database update

---

## Data Integrity Protection

### Checksum Verification

Starting in **version 2.5.0**, IN-FLIGHT automatically verifies all cached aviation data using **SHA-256 checksums**.

**What are checksums?**
- A checksum is like a "digital fingerprint" of your data
- Any tiny change in the data produces a completely different checksum
- By comparing checksums, we can instantly detect corruption

**When are checksums used?**
1. **When data is saved** - Calculate checksum for each dataset
2. **When data is loaded** - Verify checksum matches
3. **If mismatch detected** - Clear corrupted data and alert you

---

## What You'll See

### Normal Operation

When you open IN-FLIGHT, you'll see:

```
[OK] INDEXED DATABASE LOADED (12D OLD - NASR + OurAirports) [VERIFIED]
```

The `[VERIFIED]` badge means all checksums passed - your data is intact.

---

### Data Corruption Detected

If corruption is detected, you'll see:

**Alert Dialog:**
```
┌──────────────────────────────────────────────┐
│  DATA INTEGRITY FAILURE                      │
│                                              │
│  Cached aviation data failed checksum       │
│  verification. This indicates corruption.   │
│                                              │
│  The corrupted cache has been cleared.      │
│  Please reload the database from the         │
│  internet.                                   │
│                                              │
│  Click "LOAD DATA" to download fresh data.  │
│                                              │
│  [ OK ]                                     │
└──────────────────────────────────────────────┘
```

**Status Bar:**
```
[ERR] DATA CORRUPTED - PLEASE RELOAD
```

---

## What To Do If You See Corruption

### Step 1: Don't Panic

- Data corruption is **rare** but possible
- Your data is **automatically cleared** to prevent navigation errors
- You'll need to **reload fresh data** from the internet

### Step 2: Reload Database

1. Make sure you have internet connection
2. Go to **DATA** tab
3. Click **LOAD DATA** button
4. Wait for download (55MB, takes 1-2 minutes)
5. Database will be saved with **new checksums**

### Step 3: Verify Success

You should see:
```
[OK] 70,234 AIRPORTS | 8,621 NAVAIDS | 12,450 FIXES (NASR + OurAirports)
```

And when you restart:
```
[OK] INDEXED DATABASE LOADED (0D OLD - NASR + OurAirports) [VERIFIED]
```

---

## Prevention Tips

### Reduce Corruption Risk

1. **Don't force-close browser** during data load/save
2. **Let database operations complete** before closing tab
3. **Keep browser updated** (newest versions have better IndexedDB)
4. **Avoid low disk space** (can cause incomplete writes)

### When Data is Being Saved

You'll see progress messages like:
```
[...] COMPRESSING RAW CSV DATA
[...] CALCULATING CHECKSUMS FOR DATA INTEGRITY
[...] CACHING INDEXED DATABASE
```

**Wait for completion**:
```
[OK] 70,234 AIRPORTS | 8,621 NAVAIDS | ... (NASR + OurAirports)
```

---

## How Often Should I Reload Data?

### Aviation Data (Long-Term)

**Recommended**: Every 28 days

**Why?**
- FAA NASR data updates every 56 days
- Airport/navaid changes are infrequent
- Checksums protect against corruption between updates

**Warning levels**:
- ✅ **0-28 days old**: `[OK] ... [VERIFIED]` - Fresh, verified data
- ⚠️ **28+ days old**: `[!] ... UPDATE RECOMMENDED` - Still safe, but outdated

### Weather Data (Perishable)

**Coming in future version**:
- **Winds Aloft**: Auto-refresh every 3 hours
- **METARs**: Auto-refresh every hour
- **TAFs**: Auto-refresh every 6 hours

These will also use checksums to prevent corrupted weather data.

---

## Technical Details (For Curious Pilots)

### What is SHA-256?

- **SHA-256** = Secure Hash Algorithm, 256-bit
- Produces a 64-character "fingerprint" of data
- **Collision-resistant**: Nearly impossible for two different datasets to have same checksum
- **Avalanche effect**: Change one character → completely different checksum

**Example**:
```
Data:    "KALB" (Albany International)
Checksum: a7f3b2c1d4e5f6a7b8c9d0e1f2a3b4c5...

Data:    "KBOS" (Boston Logan)
Checksum: f9e8d7c6b5a4... (completely different!)
```

### What Gets Checksummed?

**All cached data**:
- Airports (70,000+ records)
- Navaids (10,000+ records)
- Fixes/waypoints (12,000+ records)
- Airways, procedures
- Frequencies, runways
- Raw CSV data (compressed, 55MB)

**Total**: 11 separate checksums verified on every load

### Performance Impact

- **Checksum calculation**: ~400ms (when saving 85,000 records)
- **Checksum verification**: ~300ms (when loading)
- **Total overhead**: <1 second
- **Storage cost**: 704 bytes (11 checksums × 64 bytes)

**Worth it?** Absolutely - 1 second of verification prevents hours of navigation errors.

---

## Frequently Asked Questions

### Q: Will checksums slow down the app?

**A**: Barely noticeable. Verification adds ~300ms to load time (1-2% overhead).

---

### Q: What if I'm offline and cache is corrupted?

**A**: You'll see the corruption alert, but **cannot reload** without internet. Options:

1. **Wait until online** to reload fresh data
2. **Use a different device** with valid cached data
3. **Plan conservatively** - don't fly with corrupted navigation data

---

### Q: Can I disable checksum verification?

**A**: No. This is a **safety feature** and cannot be disabled. Corrupted aviation data is a flight hazard.

---

### Q: Does this protect against intentional tampering?

**A**: No. Checksums detect **accidental corruption** (disk errors, crashes). If someone maliciously modifies both your data AND checksums, this won't detect it.

**Use case**: Prevent accidents, not attacks.

---

### Q: What about my flight plans? Are they checksummed?

**A**: Not yet (as of v2.5.0). **Coming soon**:
- Flight plan checksums (detect corruption in saved routes)
- GPS track checksums (verify track log integrity)
- Import/export validation (ensure no data loss)

---

### Q: I got a corruption error but it works fine now?

**A**: You reloaded the data, which:
1. Downloaded fresh aviation data from internet
2. Calculated new checksums
3. Saved with verification enabled

Everything is working correctly!

---

## Security & Privacy

### What Checksums DON'T Do

- ❌ **Don't send data anywhere** - All calculated locally in your browser
- ❌ **Don't encrypt data** - Aviation data is public information
- ❌ **Don't require authentication** - No passwords or accounts
- ❌ **Don't track you** - No analytics or telemetry

### What Checksums DO

- ✅ **Detect corruption** - Instantly catch storage errors
- ✅ **Protect safety** - Prevent use of corrupted navigation data
- ✅ **Work offline** - Verification happens locally
- ✅ **Zero privacy cost** - All processing in your browser

---

## Related Documentation

- [Data Management](./tab-data.md) - How to load and manage aviation data
- [Offline Usage](./offline-usage.md) - Using IN-FLIGHT without internet
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions

---

**Remember**: Data integrity is about **flight safety**. When in doubt, reload fresh data before flight.

*Last Updated*: 2025-01-20
*Version*: 2.5.0-dev
