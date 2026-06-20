# Monetization Reference

---

## ⚠️ AdMob Rewarded Ads — The #1 Bug (Read This First)

> **UPDATE from PLUNGE's post-launch builds:** the flag+dismiss pattern below is *necessary
> but proved NOT sufficient on real devices.* Two further failures showed up only on testers'
> phones: (1) the `Rewarded` JS event does not reliably bridge on every Android device, so the
> flag never gets set and revive never fires; and (2) even reviving on `Dismissed` can race the
> WebView regaining focus. The production-grade fix is to **detect the reward via the event AND
> the `showRewardVideoAd()` return value AND a ~45s failsafe**, and to **grant the player a life
> instead of auto-reviving** — let them resume with a normal button tap. Read
> **`references/runtime-lessons.md` §1** for the full, working pattern. The section below is the
> correct *foundation*; runtime-lessons.md §1 is what actually shipped.

### The Freeze-on-Continue Bug
**Symptom:** Ad plays, shows "reward earned," but the player lands on a frozen continue screen and the game never resumes.

**Root cause:** The reward event and the dismiss event are TWO SEPARATE events. The reward fires WHILE the ad is still on screen, before it closes. If you revive the game on the reward event, you resume while the ad overlay is still up and physics is paused — the resume gets swallowed and you're left frozen.

### The Fix — Flag on Reward, Revive on Dismiss

```javascript
// 1. When "watch ad" is pressed:
this._adRewarded = false;

// 2. On Rewarded / userEarnedReward event — ONLY set the flag, do NOT revive here:
adListener = await AdMob.addListener(AdMobRewardItem.REWARDED, () => {
  this._adRewarded = true;   // flag only — game still has ad on top
});

// 3. On Dismissed event — THIS is where you revive:
dismissListener = await AdMob.addListener(AdMobRewardItem.DISMISSED, () => {
  if (this._adRewarded) {
    this._revive();            // safe: ad is gone, WebView has focus
  } else {
    this._showContinueButtons(); // user skipped/closed early
  }
  this._rewardedAd = null;    // always null the reference
  // remove listeners
  adListener.remove();
  dismissListener.remove();
});

// 4. On FailedToShow:
await AdMob.addListener(AdMobRewardItem.FAILED_TO_SHOW_FULL_SCREEN_CONTENT, () => {
  this._showContinueButtons();
  this._rewardedAd = null;
});
```

### Critical Rules for _revive()
`_revive()` MUST do all three or you'll get a frozen state:
```javascript
_revive() {
  if (this._reviving) return;   // gate against double-fire
  this._reviving = true;
  this.physics.resume();         // 1. resume physics
  this._clearContinueOverlay();  // 2. remove the continue screen UI
  this._restartTimers();         // 3. restart game timers/tick events
  this._reviving = false;
}
```

Missing any one of the three = frozen state. Always null the ad reference after dismiss to prevent replay/frozen states.

### "Limited Ad Serving" on New AdMob Accounts
A new AdMob account shows "Limited ad serving" status. Ads may not fill until:
- You link a live Play Store URL in AdMob (requires the app to be published)
- Account has some history

Use test ad IDs during development. Switch to real IDs before submitting to Play Console.

---

## AdMob Setup (Capacitor)

### 1. Install
```bash
npm install @capacitor-community/admob
npx cap sync
```

### 2. Get Ad Unit IDs
- Create account at admob.google.com
- Create App → Add Ad Units (Interstitial + Rewarded)
- Use TEST IDs during development (listed below)

### 3. capacitor.config.json
```json
{
  "appId": "com.yourname.gamename",
  "appName": "Game Name",
  "webDir": "dist",
  "plugins": {
    "AdMob": {
      "appId": {
        "ios": "ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY",
        "android": "ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"
      }
    }
  }
}
```

### 4. iOS — Info.plist (inside <dict>)
```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY</string>
<key>NSUserTrackingUsageDescription</key>
<string>This helps show you relevant ads.</string>
```

### 5. Android — AndroidManifest.xml (inside <application>)
```xml
<meta-data
  android:name="com.google.android.gms.ads.APPLICATION_ID"
  android:value="ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"/>
```

---

## AdManager.js — Drop-in Ad Controller (with correct rewarded pattern)

```js
import { AdMob, AdMobRewardItem } from '@capacitor-community/admob';

// TEST IDs (replace with real ones before publishing)
const IDS = {
  interstitial: {
    ios: 'ca-app-pub-3940256099942544/4411468910',
    android: 'ca-app-pub-3940256099942544/1033173712'
  },
  rewarded: {
    ios: 'ca-app-pub-3940256099942544/1712485313',
    android: 'ca-app-pub-3940256099942544/5224354917'
  }
};

const isIOS = /iPhone|iPad/.test(navigator.userAgent);
const platform = isIOS ? 'ios' : 'android';

export default class AdManager {
  static deathCount = 0;

  static async init() {
    await AdMob.initialize({ requestTrackingAuthorization: true });
  }

  static async onDeath() {
    AdManager.deathCount++;
    if (AdManager.deathCount % 3 === 0) {
      await AdManager.showInterstitial();
    }
  }

  static async showInterstitial() {
    try {
      await AdMob.prepareInterstitial({ adId: IDS.interstitial[platform] });
      await AdMob.showInterstitial();
    } catch (e) { console.log('Ad not ready', e); }
  }

  // onRewarded: called with true if reward earned, false if skipped/failed
  // Uses the correct flag+dismiss pattern to avoid the freeze bug
  static async showRewarded(onRewarded) {
    let _rewarded = false;
    let rewardListener, dismissListener, failListener;

    try {
      await AdMob.prepareRewardVideoAd({ adId: IDS.rewarded[platform] });

      // Note: addListener returns a Promise — must await for .remove() to work
      rewardListener = await AdMob.addListener(AdMobRewardItem.REWARDED, () => {
        _rewarded = true;  // flag only — do NOT revive yet
      });

      dismissListener = await AdMob.addListener(AdMobRewardItem.DISMISSED, () => {
        rewardListener?.remove();
        dismissListener?.remove();
        failListener?.remove();
        onRewarded(_rewarded);  // called AFTER ad closes — safe to revive
      });

      failListener = await AdMob.addListener(
        AdMobRewardItem.FAILED_TO_SHOW_FULL_SCREEN_CONTENT, () => {
          rewardListener?.remove();
          dismissListener?.remove();
          failListener?.remove();
          onRewarded(false);
        }
      );

      await AdMob.showRewardVideoAd();
    } catch (e) {
      rewardListener?.remove();
      dismissListener?.remove();
      failListener?.remove();
      onRewarded(false);
    }
  }
}
```

### Usage in Game scene (continue/revive flow)
```js
// In your "watch ad" button handler:
AdManager.showRewarded((earned) => {
  if (earned) {
    this._revive();            // safe — called after ad fully dismissed
  } else {
    this._showContinueButtons(); // user skipped or ad failed
  }
});
```

---

## In-App Purchases (IAP)

### ⚠️ Package Name — Critical
- **CORRECT:** `capacitor-plugin-cdv-purchase`
- **WRONG (doesn't exist):** `@capacitor-community/in-app-purchases` — will waste hours
- Requires **Capacitor 6+** — upgrade all `@capacitor/*` packages together to avoid peer dependency conflicts

```bash
npm install capacitor-plugin-cdv-purchase
npx cap sync
```

### Play Console Setup Order
1. The "In-app products" tab in Play Console only appears **after** you upload at least one AAB to any track
2. Merchant/payments profile needs **~24 hours** to verify — start this early, you can't create products until it's done
3. Product IDs in code must **exactly match** Play Console (case-sensitive, no spaces)

### Basic IAP Setup
```js
import { CdvPurchase } from 'capacitor-plugin-cdv-purchase';

const store = CdvPurchase.store;

// Register products
store.register([
  { id: 'coins_small', type: CdvPurchase.ProductType.CONSUMABLE, platform: CdvPurchase.Platform.GOOGLE_PLAY },
  { id: 'coins_medium', type: CdvPurchase.ProductType.CONSUMABLE, platform: CdvPurchase.Platform.GOOGLE_PLAY },
  { id: 'remove_ads', type: CdvPurchase.ProductType.NON_CONSUMABLE, platform: CdvPurchase.Platform.GOOGLE_PLAY },
]);

// Handle purchase approved
store.when().approved(async (transaction) => {
  await transaction.verify();
  await transaction.finish();
  // grant the item
});

// Initialize
await store.initialize([CdvPurchase.Platform.GOOGLE_PLAY]);
```

### Testers Get Free IAP
Any tester on your Play Console closed testing email list who opts in via the testing link gets **sandbox IAP** — purchases go through Google's test environment and they are NOT charged real money. No separate setup needed.

---

## Cosmetics & Economy Design

### What Works (from PLUNGE)
- Cosmetics should apply to the **whole run**, not one level. A skin that only affects the first biome feels worthless since most players die early.
- Use `setTint()` for color cosmetics. Mark `// SPRITE SWAP POINT` for future real-sprite upgrades.
- Make **2-3 Legendary tier items** actual sprite swaps — those are what players talk about and chase.

### Economy That Worked
```
Coins per run:     ~200 at mid-skill level
1 life cost:       100 coins
Cosmetics range:   300 coins (Common) → 12,000 coins (Legendary)
F2P unlock time:   ~55 days — keeps players coming back daily
```

### Coin Store Design
- Show **real $ price as primary label**, coin count secondary
- Add "BEST VALUE" badge to the largest pack
- Add "MOST POPULAR" badge to the mid pack
- This anchoring drives players toward the mid/high packs

---

## Revenue Expectations (Realistic)

| Downloads/day | Sessions | eCPM | Est. Daily Revenue |
|---|---|---|---|
| 100 | 3 each | $2 | ~$0.60 |
| 1,000 | 3 each | $2 | ~$6 |
| 10,000 | 3 each | $2 | ~$60 |
| 100,000 | 3 each | $2 | ~$600 |

---

## Marketing From Zero

**Best free channels for a no-audience launch:**
- r/indiegaming + r/androidgaming — genuine first-game story + trailer
- TikTok/Reels — algorithm surfaces cold accounts, no following needed
- Product Hunt — launch Tuesday or Wednesday AM
- itch.io web build — free discovery

**30-second trailer formula:** mystery cold open → show difficulty escalating biome by biome → near-death tension → death flash → title + store badge

**A striking art style is half the marketing** — it stops the scroll.

**Early installs + ratings from friends/family** signal legitimacy to the store algorithm. Line them up for launch week.
