# PLUNGE — Bug Fix Summary

## App Info
- **Bundle ID:** `com.scrapboxstudio.plunge`
- **Version:** 3.3.3 (versionCode 2)
- **Stack:** Phaser 3.60 + Capacitor 6
- **Project folder:** `C:\Users\Mars\Desktop\projects\plunge-game`

---

## Bug 1 — Game crashes when buying coins

**Root cause:** The confirm button handler in `src/scenes/Menu.js` was an `async` function calling `await purchaseCoins(pkg.id)` with no `try/catch`. When the Google Play billing sheet is dismissed or any billing error occurs, the thrown exception becomes an unhandled promise rejection — on Android WebView this kills the entire app.

**Fixes in `src/iap.js`:**
- `purchaseCoins()` now wraps `_store.order()` in try/catch; errors are caught and reported via a new `_fail()` notifier instead of propagating
- `initIAP()` now wraps everything in try/catch; if IAP fails to initialize, `_store` stays null and `isIAPReady()` returns false — the game keeps working, purchases just don't open
- Added `store.error()` top-level handler to catch billing-layer errors from the native plugin
- Added `.cancelled()` to the `store.when()` chain to handle user dismissing the purchase sheet
- Exported `onPurchaseFailed` / `offPurchaseFailed` so the UI can react to failures

**Fixes in `src/scenes/Menu.js`:**
- Confirm button now wraps `purchaseCoins` in try/catch
- Registers an `onPurchaseFailed` listener that clears the "Opening store..." text when the purchase is cancelled or fails
- Adds a 45-second auto-clear timer as a safety net if native callbacks never fire
- Both the listener and timer clean themselves up to avoid accumulating stale state

---

## Bug 2 — Music keeps playing during ads

`_watchAd()` in `src/scenes/Game.js` now mutes all music tracks immediately before showing the ad, and fades them back in after the rewarded callback fires (or on any failure/cancellation path).

---

## Bug 3 — No countdown after watching ad

After `RewardAdPluginEvents.Rewarded` fires, the game now shows "REVIVING IN 3... 2... 1..." before calling `_revive()`.

---

## Bug 4 — White bar at top of screen

Fixed by setting `background: #010c18` on the `html` element (not just `body`) in `index.html`, and adding `windowTranslucentStatus`, `statusBarColor: transparent`, and `fitsSystemWindows: false` to the Android theme in `android/app/src/main/res/values/styles.xml`.

---

## Bug 5 — Platinum shells not being collected

Shell physics body in `_spawnShell()` was only as wide as the displayed texture. Fixed with an explicit `body.setSize(56, 56, true)` — roughly 2× the visual size to compensate for lag-frame skipping on cheap hardware.

---

## Bug 6 — Very slow startup

`src/scenes/Boot.js` previously loaded all 10 music tracks (~39MB) before the game started. Now only the first biome's track loads at boot. Remaining tracks lazy-load during gameplay via polling, with the next track pre-fetching in the background while the current one plays. Also added a visible progress bar so the boot screen isn't a frozen black screen.

---

## Coin Storage Fix

Replaced `localStorage` with `@capacitor/preferences` for all coin/progress data. Android can silently wipe WebView storage under memory pressure; Capacitor Preferences writes to native SharedPreferences which only clears on app uninstall. A sync cache in `src/storage.js` means all reads remain synchronous.

---

## To Deploy

Upload `android/app/build/outputs/bundle/release/app-release.aab` to Play Console → Alpha track (versionCode 2, versionName 3.3.3).
