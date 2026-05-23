# PLUNGE — Setup Guide

## Play Immediately (No Setup)
Open `plunge-preview.html` in any browser. Works on desktop too — click left/right halves to steer.

---

## Full Project Setup (for Capacitor mobile export)

### 1. Install dependencies
```bash
cd plunge-game
npm install
```

### 2. Run local dev server
```bash
npm run dev
# Opens at http://localhost:3000
# Use browser DevTools → Toggle Device Toolbar → iPhone 14 Pro for accurate preview
```

### 3. Build + sync to native
```bash
npm run build        # compiles to /dist
npx cap sync         # copies dist → ios/android projects
```

### 4. Add native platforms (first time only)
```bash
npx cap add ios
npx cap add android
npx cap sync
```

### 5. Open in Xcode / Android Studio
```bash
npm run open:ios      # opens Xcode — then Product → Archive
npm run open:android  # opens Android Studio — then Build → Generate Signed Bundle
```

---

## Replace Placeholder Graphics

All graphics are procedurally generated right now. To add real art:

1. Drop PNGs in `/assets/images/`
2. Update `Boot.js` to load them: `this.load.image('diver', 'assets/images/diver.png')`
3. Remove the corresponding `_make___()` call
4. Done — real art replaces the placeholders

See `../mobile-game-factory/assets-prompts/image-prompts.md` for Midjourney/DALL-E prompts to generate all assets.

---

## Game Variables to Tune

In `src/main.js`, the `BIOMES` array controls all difficulty:

```js
{ fallSpeed: 200,   // how fast diver falls (higher = harder)
  spawnMs: 1500,    // ms between obstacle rows (lower = harder)
  gapWidth: 215,    // pixel gap between walls (lower = harder)
  lightFade: 0.0 }  // darkness 0=lit, 0.9=nearly black
```

Experiment with these to dial in difficulty feel.

---

## Quick Re-skin Ideas (same codebase)

| Change | Result |
|---|---|
| Theme: space + asteroid belt | "DESCENT" — satellite falling through asteroid field |
| Theme: cave + stalactites | "CAVERN" — explorer rappelling into cave |
| Theme: clouds + birds | "SKYDIVE" — upward version, diver rises |
| Colors + obsColor only | Totally different visual feel in 2 min |

---

## AdMob (monetization)

```bash
npm install @capacitor-community/admob
npx cap sync
```

Then see `../mobile-game-factory/references/monetization.md` for full drop-in `AdManager.js`.

---

## App Store Assets Needed
- App icon: 1024×1024 PNG (dark ocean background + diver silhouette)
- Splash screen: 2732×2732 PNG (same style, centered logo)
- Screenshots: See submission guide in skill references
