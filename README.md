# TimeBank — UPT & PTO Calculator

Mobile-first static website for planning UPT and paid time off.

## Current features

- **How early can I leave?** Choose how much Flexible PTO, Standard PTO, and UPT you want to spend.
- **What time do I want to leave?** Enter a target time. If your balances can cover it, the site suggests a valid combination; otherwise it shows your earliest possible leave time and how short you are.
- **Save UPT** or **Save PTO** priority modes.
- Choose whether Flexible PTO or Standard PTO is spent first.
- **Single-shift UPT prediction** using start time, end/leave time, and a fixed 30-minute lunch window.
- **Late clock-in UPT checker** with 15-minute UPT rounding.
- Overnight shifts supported.
- Values save locally on each device.
- Installable from Safari with **Add to Home Screen**.

## Rules built into this version

- UPT earns at **5 minutes per hour actually worked**.
- Single-shift prediction prorates the 5-min/hour rate by minutes actually worked and rounds down to a whole minute.
- UPT balance caps at **80 hours**.
- UPT attendance gaps use **15-minute blocks**.
- For maximum early-leave planning, usable UPT is the balance rounded down to a full 15-minute block.
- Flexible PTO + Standard PTO can be combined and used by the minute.
- UPT can be used alongside PTO, while the UPT portion stays in 15-minute blocks.
- Unpaid lunch is excluded from work and time-off coverage.

## Examples

### Early leave
Shift: **6:15 PM → 4:45 AM**  
Lunch: **10:45 PM → 11:15 PM**  
PTO: **3 hours**  
UPT: **1 hr 16 min → 1 hr 15 min usable**

Total usable time = **4 hr 15 min**, so earliest leave = **12:30 AM**.

### UPT prediction
- **6:15 PM → 4:45 AM** = 10 hr 30 min elapsed − 30 min lunch = **10 hr worked** → **50 min UPT**.
- **6:15 PM → 3:45 AM** = 9 hr 30 min elapsed − 30 min lunch = **9 hr worked** → **45 min UPT**.

## Publish free with GitHub Pages

1. Create a new GitHub repository.
2. Upload every file from this folder to the repository root.
3. Commit the files.
4. Open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select `main` and `/ (root)`, then save.
7. GitHub provides the shareable website URL.

On iPhone: open the published site in Safari → **Share** → **Add to Home Screen**.

## Not included yet

- Schedule/calendar saving
- Multi-day or future-date UPT forecasting

This is an unofficial planning calculator. The employer's actual timekeeping system remains the final source of truth.
