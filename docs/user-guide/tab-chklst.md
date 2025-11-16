# CHKLST Tab

The CHKLST tab provides an interactive checklist for the Piper Cherokee 140. You can check off items as you complete them.

## What It Includes

The checklist has 10 sections covering normal operations:

1. Before Start (10 items)
2. Engine Start (10 items)
3. Before Taxi (5 items)
4. Run-up (15 items)
5. Before Takeoff (10 items)
6. Climb (6 items)
7. Cruise (5 items)
8. Descent (10 items)
9. After Landing (7 items)
10. Shutdown (7 items)

This checklist is hard-coded for the PA-28-140 and cannot be customized.

## How It Works

When you tap a checkbox, the item's state saves to localStorage and persists across browser sessions. Completed sections turn green and collapse automatically, while the next uncompleted section expands.

The **RESET ALL** button unchecks everything and collapses all sections except Before Start.

## Example

Each item follows the format "Control/action - EXPECTED STATE". For example:

```text
☐ Fuel selector - DESIRED TANK
```

After you set the fuel selector, tap the checkbox. The item stays checked until you reset the checklist.

## Disclaimer

This checklist is not FAA approved and should only be used as a training tool or reference. Always use your aircraft's official POH checklist for actual flight operations.

Verify all procedures against your specific aircraft, as not all PA-28-140s are configured identically.

---

**This is for practice and convenience.** Always carry your POH checklist for actual flight operations.
