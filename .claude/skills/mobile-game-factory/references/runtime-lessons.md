# Runtime Lessons — Phaser + Capacitor Gotchas

Hard-won fixes from PLUNGE **post-launch** (the bugs that only show up on real devices,
not in the browser). Read this when ads, audio, saved data, or small-screen UI misbehave.

---

## 1. Rewarded-Ad Revive — the #1 trap

**Symptom:** player watches the ad, sees "reward earned," closes it — and the game is stuck
on a frozen continue screen instead of resuming.

**Three independent root causes, all real:**

1. **Don't resume gameplay from the ad's `Dismissed` callback.** When a native ad shows, the
   WebView is backgrounded and Phaser's loop/clock pauses. The instant the ad closes, focus is
   still being handed back — calling `scene.resume()` / your `_revive()` there races that
   transition and gets swallowed. The world stays frozen.
2. **The `Rewarded` JS event is NOT reliably delivered on every Android device.** The native
   "reward earned" toast is shown by the SDK itself; the JS event bridging is separate and
   sometimes never fires. If your revive is gated only on that event, it never happens.
3. **`AdMob.addListener()` returns a `Promise<PluginListenerHandle>`.** If you call
   `listener.remove()` without `await`ing the handle, you're calling `.remove()` on a Promise —
   it throws, listeners leak, and stale listeners from earlier ad views fire into dead closures.

**The robust pattern — grant a resource, let the player resume with a tap:**

Instead of auto-reviving, give the player a **life** (or coins) and re-show the continue screen
so an existing, already-working button (`USE A LIFE`) performs the resume. The resume then
happens on a clean, fully-focused frame from a normal tap — zero timing races. Re-showing UI
behind a still-open ad overlay is harmless because nothing resumes until the tap.

```javascript
async _watchAd() {
  if (this._adInProgress) return;
  this._adInProgress = true;
  this.contEvt?.remove();                       // pause the continue countdown
  this.contObjs.forEach(o => o.setVisible(false));
  this._musicSounds.forEach(s => s.setVolume(0));

  const { AdMob, RewardAdPluginEvents } = await import('@capacitor-community/admob');

  let earned = false, resolved = false, failTimer = null, backstop = null;
  let rwdH = null, dsmH = null, failH = null;

  const finish = () => {
    if (failTimer) clearTimeout(failTimer);
    if (backstop)  clearTimeout(backstop);
    try { rwdH?.remove(); } catch {}            // resolved handles → .remove() works
    try { dsmH?.remove(); } catch {}
    try { failH?.remove(); } catch {}
  };
  const resolve = () => {
    if (resolved) return; resolved = true;
    finish();
    if (earned) setItem(LIVES, (+getItem(LIVES) || 0) + 1);  // GRANT, don't revive
    this._adInProgress = false;
    this._showContinue();                       // re-shows UI; USE A LIFE now active
  };

  // earned is set by ANY of three signals (belt + suspenders):
  failTimer = setTimeout(() => { earned = true; }, 45000);   // (1) failsafe — full ad ≈ 45s
  backstop  = setTimeout(() => resolve(), 60000);            // unblock if Dismissed never fires

  rwdH  = await AdMob.addListener(RewardAdPluginEvents.Rewarded,     () => { earned = true; }); // (2) event
  dsmH  = await AdMob.addListener(RewardAdPluginEvents.Dismissed,    () => resolve());
  failH = await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => resolve());

  try {
    await AdMob.prepareRewardVideoAd({ adId: REWARD_ID });
    const reward = await AdMob.showRewardVideoAd();  // (3) resolves with the reward at earn time
    if (reward) earned = true;                       // works even when the event doesn't bridge
  } catch { resolve(); }
}
```

**Key facts that make the above correct (verified in the plugin's native source):**
- `showRewardVideoAd()` resolves with `AdMobRewardItem` at the exact moment the reward is earned
  (ad still on screen) — it's a *second, independent* reward signal. Use it AND the event.
- Documented event order is **`Rewarded` → `Dismissed`** (reward fires while the ad is still up;
  Dismissed = ad closed). Order can be reversed on some devices, so never depend on it.
- **Use `setTimeout`, never `this.time.delayedCall`, for ad timers** — Phaser's clock is paused
  while the native ad overlay has focus, so `delayedCall` won't fire until the ad closes.
- **Failsafe = ~45s, not 30s.** An ad takes a few seconds to start; at 30s a player could close
  early on an *unpaid* impression and still get the reward.

**Pre-load so the first ad isn't a cold load:** right after `AdMob.initialize()`, call
`AdMob.prepareRewardVideoAd({ adId })` once so the ad is warm before the first death.

---

## 2. Saved Data Survives Updates — localStorage → Preferences

`localStorage` in a Capacitor WebView can be **cleared on app update**, wiping coins/high scores.
Use `@capacitor/preferences` (native storage) and migrate v1 data once.

- Install the version that matches your Capacitor major: `@capacitor/preferences@^6` for Cap 6
  (latest needs Cap 8+ and will peer-dep-conflict).
- Preferences is async; preload all keys into a sync cache at boot so gameplay reads stay sync.

```javascript
// storage.js — one-time localStorage → Preferences migration on first launch after update
const { value } = await Prefs.get({ key });
if (value !== null) { cache[key] = value; }
else {
  const legacy = localStorage.getItem(key);            // v1 stored here
  if (legacy !== null) { cache[key] = legacy; await Prefs.set({ key, value: legacy }); localStorage.removeItem(key); }
}
```

---

## 3. Audio That Plays Immediately (and Doesn't Freeze the Loader)

Two separate audio bugs, both from large BGM files (~4 MB MP3s):

- **Loader freezes at 100%:** Phaser decodes audio (`decodeAudioData`) *after* download but
  *before* `create()`. A big track makes the progress bar hit 100% then hang for seconds.
  → Keep heavy music OUT of `Boot.preload()`; lazy-load it during gameplay.
- **Silence for the first 5–10 s of play:** the first track lazy-loads from zero when the game
  scene starts. → Preload the menu track in Boot, and *prefetch* the first gameplay track while
  the player is on the menu so it's cached by the time they hit Play.

Other audio rules:
- **Compress BGM to 64–96 kbps** (≈1 MB instead of 4). Use `ffmpeg-static` as a devDependency so
  there's no system ffmpeg install: `node` script with `execFileSync(ffmpegStatic, ['-i', f,
  '-codec:a','libmp3lame','-b:a','64k','-y',tmp])`.
- **First track: fade in over ~1.2 s, not 7 s.** A 7 s crossfade (great for biome transitions)
  is inaudible at the start of a run — the player thinks there's no music.
- **Lazy-load mid-scene:** `this.load.audio(key, path); this.load.start();
  this.load.once(Phaser.Loader.Events.COMPLETE, cb);` then poll `this.cache.audio.exists(key)`.

---

## 4. Responsive UI for Small Screens (overlays that overflow)

**Symptom:** a tester on a shorter phone can't see/reach the bottom of a menu — close/back
buttons fall off the panel. **Cause:** UI positioned with fixed pixel offsets calibrated for a
tall (~844px) design; short screens (~640px) overflow by ~200px.

**Auto-fit, then scroll** (a no-op when content already fits, so tall screens are untouched):

1. Collect a screen/page's objects into an array (most builders already do via an `mk()` helper).
2. Measure the group's bounding box; if taller than its panel, uniformly **shrink it to fit**
   (`scale = min(1, viewH/contentH)`), centering the slack. If it *still* overflows at a min
   scale, clip with a geometry mask and enable **drag-scroll**.
3. **Pin chrome** (close/back buttons, transient status toasts) *outside* the scaled group so
   they're always reachable; reserve panel-bottom room for them.

**Two traps:**
- **Geometry masks clip rendering but NOT input** — a scrolled-out button is invisible yet still
  catches taps. Toggle `obj.input.enabled` based on whether its position is within the view.
- **Never fit-scale a widget whose drag math uses cached coordinates** (e.g. a volume slider that
  stores `trackLeft/trackW` at build). Scaling moves the visuals but not the cached math →
  broken. For those screens, **reposition proportionally** (`const k = oh / DESIGN_OH; const sy =
  v => oy + v*k;`) instead of scaling — the slider's horizontal math stays correct.
- Use a `fitText(txt, maxW)` helper (`txt.setScale(txt.width > maxW ? maxW/txt.width : 1)`) to
  stop large dynamic numbers (depth, balances) from clipping their box on narrow screens.

---

## 5. Misc Phaser + Capacitor

- **`Phaser` is global without importing it in every file** — Phaser's UMD build sets
  `window.Phaser` as a side effect of the entry import in `main.js`. New modules can `import
  Phaser from 'phaser'` explicitly to be safe.
- **Big tap targets:** a Text object's default hit area is its tight text bounds (tiny). Give
  buttons a generous rectangle: `txt.setInteractive(new Phaser.Geom.Rectangle(-90,-24,180,48),
  Phaser.Geom.Rectangle.Contains)`.
- **IAP handlers must not throw:** wrap `purchaseCoins()` and the confirm handler in try/catch,
  add a top-level `store.error(...)` handler and `.cancelled(...)` on the `when()` chain — an
  unhandled rejection in an async buy handler crashes the whole game.
- **Version discipline:** bump `versionCode` on *every* upload; show the `versionName` somewhere
  in-app so you can confirm which build is actually on the device (Play propagation + cached
  installs cause "I fixed it but it's still broken" confusion).
- **Keep an in-app "what's new" note in sync with each release** if you have one (e.g. a splash
  changelog) — stale notes mislead testers about which build they're on.
