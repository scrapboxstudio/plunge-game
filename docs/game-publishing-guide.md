# Mobile Game Publishing Guide — Phaser 3 + Capacitor + Google Play

> Distilled from building and shipping PLUNGE. Use as a blueprint for every future mobile game.

---

## SECTION 1 — PROJECT STRUCTURE (USE THIS FOR EVERY GAME)

```
my-game/                        ← git root, npm root, Capacitor root (ALL ONE FOLDER)
├── src/
│   ├── main.js                 ← Phaser game init, Capacitor init, AdMob init, IAP init
│   ├── iap.js                  ← IAP module (capacitor-plugin-cdv-purchase)
│   └── scenes/
│       ├── Boot.js
│       ├── Menu.js
│       └── Game.js
├── public/
│   └── assets/                 ← audio, images
├── dist/                       ← built output (gitignored)
├── android/                    ← Capacitor Android platform
│   ├── app/
│   │   ├── build.gradle        ← signing config, versionCode, versionName
│   │   └── src/main/
│   │       ├── AndroidManifest.xml
│   │       └── res/values/styles.xml
│   └── key.properties          ← GITIGNORED — keystore credentials
├── store-assets/
│   ├── icon-512.png            ← app icon (512×512)
│   ├── feature-graphic-1024x500.png
│   ├── screenshots/            ← phone screenshots (at least 2)
│   └── privacy-policy.html     ← host on GitHub Pages
├── docs/
│   └── game-publishing-guide.md
├── capacitor.config.json
├── package.json
├── vite.config.js
└── .gitignore                  ← include: dist/, android/key.properties, *.jks
```

**Critical rule:** `npm run build` and `npx cap sync` must both run from the SAME root folder where `package.json`, `capacitor.config.json`, and `android/` all live. Nesting any of these in a subfolder breaks the sync.

---

## SECTION 2 — SETUP FROM SCRATCH

### Prerequisites (install once, reuse forever)

| Tool | Where |
|---|---|
| Node.js 18+ LTS | nodejs.org |
| Android Studio (latest) | developer.android.com/studio — brings JDK 17 and SDK |

**Windows env vars (System Properties → Environment Variables):**
```
ANDROID_HOME = C:\Users\<you>\AppData\Local\Android\Sdk
JAVA_HOME    = C:\Program Files\Android\Android Studio\jbr
```
Add to PATH: `%ANDROID_HOME%\platform-tools`

### New project commands

```bash
# 1. Create project
npm create vite@latest my-game -- --template vanilla
cd my-game

# 2. Install stack
npm install phaser
npm install @capacitor/core @capacitor/cli @capacitor/android
npm install @capacitor/splash-screen @capacitor/status-bar @capacitor/haptics
npm install @capacitor-community/admob capacitor-plugin-cdv-purchase

# 3. Init Capacitor (run from the project root)
npx cap init "My Game" "com.yourname.mygame" --web-dir dist

# 4. Build once first (android/ needs dist/ to exist)
npm run build

# 5. Add Android platform
npx cap add android

# 6. Sync web assets into Android
npx cap sync android
```

---

## SECTION 3 — DAILY DEVELOPMENT LOOP

```bash
npm run dev           # browser dev with hot reload — fastest iteration
# ...make changes...
npm run build         # bundle to dist/
npx cap sync android  # push web assets into Android
npx cap open android  # open Android Studio to run on device/emulator
```

Add this to `package.json` scripts for a one-command sync:
```json
"sync": "npm run build && npx cap sync"
```
Then `npm run sync` covers build + sync in one step.

---

## SECTION 4 — ANDROID MANIFEST

`android/app/src/main/AndroidManifest.xml` — copy this structure:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application ...>
    <activity
        android:screenOrientation="portrait"
        android:windowSoftInputMode="adjustPan"
        android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>

    <!-- AdMob App ID -->
    <meta-data
        android:name="com.google.android.gms.ads.APPLICATION_ID"
        android:value="ca-app-pub-XXXXXXXX~XXXXXXXXXX"/>
  </application>

  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="com.google.android.gms.permission.AD_ID" />
</manifest>
```

`android/app/src/main/res/values/styles.xml` — add inside AppTheme for fullscreen + notch:
```xml
<item name="android:windowFullscreen">true</item>
<item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
```

---

## SECTION 5 — SIGNING + RELEASE BUILD

### Create keystore (ONE TIME — back it up to USB immediately)

```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore C:\Users\<you>\my-game-keystore.jks -alias my-game -keyalg RSA -keysize 2048 -validity 10000
```

**PKCS12 quirk:** store password and key password are unified. To change it later:
```powershell
keytool -storepasswd -keystore C:\Users\<you>\my-game-keystore.jks
```
Use `-storepasswd` only — `-keypasswd` is not supported for PKCS12 and will error.

### `android/key.properties` — never commit this file

```
storePassword=YourPassword
keyPassword=YourPassword
keyAlias=my-game
storeFile=C:/Users/<you>/my-game-keystore.jks
```

### `android/app/build.gradle` — signing block

```groovy
def keystorePropertiesFile = rootProject.file("key.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    defaultConfig {
        versionCode 1       // increment by 1 for every upload to Play Console
        versionName "1.0.0" // user-visible version string
    }
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
    }
}
```

### Build the signed AAB

```powershell
cd android
.\gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

---

## SECTION 6 — ADMOB INTEGRATION

### `capacitor.config.json`

```json
{
  "plugins": {
    "AdMob": {
      "appId": { "android": "ca-app-pub-XXXXXXXX~XXXXXXXXXX" },
      "initializeForTesting": false
    }
  }
}
```

### `main.js` — initialize on startup

```javascript
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  import('@capacitor-community/admob').then(({ AdMob }) => {
    AdMob.initialize({ requestTrackingAuthorization: false });
  });
}
```

### Rewarded ad

```javascript
async function watchAd() {
  const { AdMob, RewardAdPluginEvents } = await import('@capacitor-community/admob');

  const rewardListener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
    grantReward();
    rewardListener.remove();
  });

  const failListener = await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => {
    failListener.remove();
  });

  await AdMob.prepareRewardVideoAd({ adId: 'ca-app-pub-XXXXXXXX/XXXXXXXXXX' });
  await AdMob.showRewardVideoAd();
}
```

Test ad ID during development (rewarded): `ca-app-pub-3940256099942544/5224354917`

---

## SECTION 7 — IAP INTEGRATION (capacitor-plugin-cdv-purchase)

### `iap.js` — full reusable module

```javascript
import { Capacitor } from '@capacitor/core';

export const COIN_PACKAGES = [
  { id: 'coins_099', label: '$0.99', coins: 100  },
  { id: 'coins_199', label: '$1.99', coins: 200  },
  { id: 'coins_499', label: '$4.99', coins: 500  },
  { id: 'coins_999', label: '$9.99', coins: 1000 },
];

const _listeners = new Set();
let _store = null;
let _CdvPurchase = null;

export function onCoinsGranted(cb)  { _listeners.add(cb); }
export function offCoinsGranted(cb) { _listeners.delete(cb); }
export function isIAPReady()        { return Capacitor.isNativePlatform() && _store !== null; }

function _grant(coins) {
  const cur = parseInt(localStorage.getItem('coins') || '0', 10);
  const updated = cur + coins;
  localStorage.setItem('coins', String(updated));
  _listeners.forEach(cb => cb(coins, updated));
}

export async function initIAP() {
  if (!Capacitor.isNativePlatform()) return;
  const mod = await import('capacitor-plugin-cdv-purchase');
  _CdvPurchase = mod.CdvPurchase;
  const { store, ProductType, Platform } = _CdvPurchase;
  _store = store;

  store.register(COIN_PACKAGES.map(p => ({
    id: p.id,
    type: ProductType.CONSUMABLE,
    platform: Platform.GOOGLE_PLAY,
  })));

  store.when()
    .approved(t => t.verify())
    .verified(receipt => {
      const productId = receipt.transactions?.[0]?.products?.[0]?.id;
      const pkg = COIN_PACKAGES.find(p => p.id === productId);
      if (pkg) _grant(pkg.coins);
      receipt.finish();
    });

  await store.initialize([Platform.GOOGLE_PLAY]);
}

export async function purchaseCoins(productId) {
  if (!_store || !_CdvPurchase) return;
  const product = _store.get(productId, _CdvPurchase.Platform.GOOGLE_PLAY);
  if (product?.canPurchase) await _store.order(product);
}
```

### In `main.js`

```javascript
if (Capacitor.isNativePlatform()) {
  import('./iap.js').then(({ initIAP }) => initIAP());
}
```

### IAP products in Play Console

Create these **after** uploading your first AAB to any track:
**Monetize → In-app products → Create product**
- Type: Managed product (consumable)
- Status: Active
- Product ID must exactly match the IDs in your code

---

## SECTION 8 — GOOGLE PLAY CONSOLE CHECKLIST

### One-time account setup
- [ ] Google (Gmail) account — required, protonmail cannot be used directly
- [ ] Pay $25 developer registration fee
- [ ] Fill out developer profile (name, email, address, phone)
- [ ] Wait for approval (minutes to a few hours)
- [ ] Create app: All apps → Create app

### Store listing (must be complete before any release)
- [ ] App name (30 chars max)
- [ ] Short description (80 chars)
- [ ] Full description (4000 chars)
- [ ] App icon — 512×512 PNG, no transparency
- [ ] Feature graphic — 1024×500 PNG
- [ ] At least 2 phone screenshots (portrait)
- [ ] Privacy policy URL (host on GitHub Pages — see Section 9)
- [ ] Category and contact email

### Declarations
- [ ] Content rating — complete the questionnaire
- [ ] Ads declaration — yes if using AdMob
- [ ] Target audience — 13+ if not targeting children
- [ ] In-app purchases declaration — yes if using IAP
- [ ] Data safety form — list what data AdMob collects
- [ ] Ad ID declaration — select "Analytics" if using AdMob for rewarded/banner ads

### Closed testing (mandatory for new accounts)
- [ ] Upload AAB to **Testing → Closed testing (Alpha)** track
- [ ] Add 20 testers by Gmail address
- [ ] Share the opt-in link Play Console generates
- [ ] Testers must accept and install the app
- [ ] Wait **14 days** with testers active
- [ ] After 14 days → Promote to Production

### Production
- [ ] Promote from Alpha → Production
- [ ] Submit for Google review (1–7 days typically)

---

## SECTION 9 — PRIVACY POLICY (HOST ON GITHUB PAGES)

1. Create `store-assets/privacy-policy.html` in your repo
2. Push to GitHub
3. Enable GitHub Pages: Repo Settings → Pages → Branch: main → folder: / (root)
4. URL: `https://yourusername.github.io/repo-name/store-assets/privacy-policy.html`

Minimum content: what data you collect, how AdMob uses device identifiers, contact email, last updated date.

---

## SECTION 10 — PHONE / NOTCH SUPPORT

### `main.js` — read safe areas at startup

```javascript
function _readSafeAreaBottom() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;';
  document.body.appendChild(el);
  const h = el.offsetHeight;
  document.body.removeChild(el);
  return h;
}

export const IS_PHONE = window.innerWidth <= 500;
export const SAFE_BOTTOM = IS_PHONE ? Math.max(_readSafeAreaBottom(), 0) : 0;
```

### Phaser scale config

```javascript
scale: {
  mode: IS_PHONE ? Phaser.Scale.NONE : Phaser.Scale.FIT,
  width:  IS_PHONE ? window.innerWidth  : 390,
  height: IS_PHONE ? window.innerHeight : 844,
}
```

### `index.html`

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<style>
  body { margin: 0; background: #000; }
  canvas { display: block; }
</style>
```

### Text overflow on Android

Arial Black and similar fonts render wider on Chrome/Android than on iOS Safari. Always scale long text:
```javascript
const txt = this.add.text(x, y, 'LONG TITLE', { fontFamily: 'Arial Black', fontSize: '68px' });
txt.setScale(Math.min(1.0, (screenWidth - 28) / txt.width));
```

---

## SECTION 11 — VS CODE SETUP

### Essential extensions

| Extension | ID | Purpose |
|---|---|---|
| ESLint | dbaeumer.vscode-eslint | catch JS errors live |
| Prettier | esbenp.prettier-vscode | auto-format on save |
| GitLens | eamodio.gitlens | inline git blame and history |
| Claude Code | anthropic.claude-code | AI assistance |
| Live Server | ritwickdey.liveserver | quick browser preview |

### `.vscode/settings.json`

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.tabSize": 2,
  "files.exclude": {
    "node_modules": true,
    "dist": true,
    "android": true
  }
}
```

### `.vscode/tasks.json` — keyboard-triggered build commands

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Dev Server",
      "type": "shell",
      "command": "npm run dev",
      "group": { "kind": "build", "isDefault": true }
    },
    {
      "label": "Sync Android",
      "type": "shell",
      "command": "npm run build && npx cap sync android"
    },
    {
      "label": "Build AAB",
      "type": "shell",
      "command": "cd android && .\\gradlew bundleRelease",
      "group": "build"
    }
  ]
}
```

`Ctrl+Shift+B` → runs Dev Server. `Ctrl+Shift+P → Run Task` → pick Sync Android or Build AAB.

---

## SECTION 12 — CLAUDE CODE SETUP

### `CLAUDE.md` in project root (copy and fill in for each game)

```markdown
# [Game Name] — Claude Code Context

## Stack
- Phaser 3.60 (game engine)
- Vite 5 (bundler)
- Capacitor 6 (native wrapper)
- @capacitor-community/admob (ads)
- capacitor-plugin-cdv-purchase (IAP)

## Commands — all run from THIS folder (git root)
- `npm run build` → bundles to dist/
- `npx cap sync android` → syncs web assets into android/
- `cd android && .\gradlew bundleRelease` → builds signed AAB

## Key files
- src/main.js — Phaser init, Capacitor init, AdMob init, IAP init
- src/iap.js — full IAP module (capacitor-plugin-cdv-purchase)
- capacitor.config.json — Capacitor + plugin config
- android/app/build.gradle — versionCode, versionName, signing
- android/app/src/main/AndroidManifest.xml — permissions, orientation

## App IDs
- Bundle ID: com.yourname.gamename
- AdMob App ID: ca-app-pub-XXXXXXXX~XXXXXXXXXX
- Ad Unit (rewarded): ca-app-pub-XXXXXXXX/XXXXXXXXXX

## Keystore
- File: C:/Users/<you>/my-game-keystore.jks
- Config: android/key.properties (gitignored — do not commit)
```

### Session habits that save time

1. Start sessions: "I'm continuing [game name]. Check memory for context."
2. Phrase requests specifically: "add rewarded ad to Game.js using the same pattern as the existing `_watchAd` stub"
3. Ask for checklists: "give me the checklist to go from current code to a signed AAB"
4. One feature per session — cleaner code, easier to review
5. Ask Claude to write the commit message after each feature

---

## SECTION 13 — COMMON PITFALLS

| Problem | Fix |
|---|---|
| `npx cap sync` can't find android/ | Run from the git root, not a subfolder |
| PKCS12 keystore `-keypasswd` error | Use `-storepasswd` only — key/store share one password in PKCS12 |
| IAP plugin not found on npm | Use `capacitor-plugin-cdv-purchase`, not `@capacitor-community/in-app-purchases` (doesn't exist) |
| IAP peer dep conflict on install | Requires Capacitor 6+. Upgrade all `@capacitor/*` packages together |
| Text overflows on Android but not iOS | Chrome/Android renders fonts wider. Scale text with `Math.min(1.0, maxWidth / txt.width)` |
| Can't go straight to Production | New accounts must complete 14-day closed test with 20 testers first |
| In-app products tab missing in Play Console | Upload at least one AAB to any track first — products tab unlocks after that |
| GitHub Pages shows black screen | Make sure the URL points directly to the `.html` file, not the directory |
| AAB rejected for missing declaration | Complete ALL declarations (data safety, ads, IAP, AD_ID, content rating) before submitting |
