
# Focus Blocker – Free Chrome Site Blocker (MV3)

A privacy-first, fully local site blocker with schedules, soft/hard block, and temporary overrides.

## Features
- Blocklist supports wildcard (`*.example.com`), exact domain, and regex
- Modes: **hard** (instant) and **soft** (continue after countdown)
- Optional **allowlist mode** (block everything except allowed)
- **Schedules** per rule (days + HH:MM window)
- **Temporary overrides** per hostname (5/15/30 minutes; configurable)
- Import/Export JSON of rules
- Syncs via `chrome.storage.sync` when available
- Clean popup and options UI

## Install (Unpacked)
1. Download the ZIP and extract.
2. Go to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and choose the extracted folder.
5. Pin **Focus Blocker** to your toolbar.

## Quick Test
- Open the popup → "Add current site to blocklist". Try visiting the site again.
- In Options, add rule `*.twitter.com` (wildcard, Hard). Visit Twitter.
- Try **soft** mode and use the "Continue" button after the countdown.
- Use override (5/15/30 min) on the block page to temporarily allow.

## Notes
- Schedules are evaluated every minute.
- Soft "continue" is one-shot: we briefly remove the matching DNR rule (15s) to let the navigation through, then restore.
- Overrides are keyed by hostname and bypass rules for that host until expiration.
- Everything is local—no analytics or external requests.

## Files
- `manifest.json` (MV3)
- `service-worker.js` (rules, schedules, overrides, dynamic DNR updates)
- `popup.html/js/css`, `options.html/js/css`
- `block.html/js/css`
- `lib/*` utils
- `_locales/en|es/messages.json`
- `icons/*`

## Troubleshooting
- If changes don't reflect immediately, toggle the extension off/on in `chrome://extensions` or click the reload icon.
- If regex is invalid, your rule won't be added—fix the pattern.
- If you get storage sync quota errors, the extension falls back to local storage automatically.

## License
MIT
