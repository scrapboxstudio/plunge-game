# Monetization Reference

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

### 4. iOS — Info.plist (add inside <dict>)
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

## AdManager.js — Drop-in Ad Controller

```js
import { AdMob, BannerAdSize, BannerAdPosition, AdMobRewardItem } from '@capacitor-community/admob';

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

  // Call this on every death — shows ad every 3 deaths
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

  // Returns true if user watched the ad, false if skipped/failed
  static async showRewarded() {
    try {
      await AdMob.prepareRewardVideoAd({ adId: IDS.rewarded[platform] });
      return new Promise(resolve => {
        AdMob.addListener('onRewarded', () => resolve(true));
        AdMob.addListener('onRewardedVideoAdClosed', () => resolve(false));
        AdMob.showRewardVideoAd();
      });
    } catch { return false; }
  }
}
```

### Usage in GameOver.js
```js
import AdManager from '../utils/AdManager.js';

// In create():
await AdManager.onDeath(); // auto-shows interstitial every 3 deaths

// "Continue with ad" button:
const watched = await AdManager.showRewarded();
if (watched) this.scene.start('Game', { continueScore: this.finalScore });
```

---

## Revenue Expectations (Realistic)

| Downloads/day | Avg Sessions | eCPM | Est. Daily Revenue |
|---|---|---|---|
| 100 | 3 sessions each | $2 | ~$0.60 |
| 1,000 | 3 sessions each | $2 | ~$6 |
| 10,000 | 3 sessions each | $2 | ~$60 |
| 100,000 | 3 sessions each | $2 | ~$600 |

**Keys to more downloads:**
- Unique theme/twist on proven mechanic
- Good app store screenshots (most important!)
- ASO: keywords in title + description
- TikTok/Reels showing gameplay (free marketing)

---

## Monetization Strategies (pick 1-2 per game)

| Strategy | Implementation | Best For |
|---|---|---|
| **Interstitials** | Every 3 deaths | High-death games (Flappy style) |
| **Rewarded Continue** | "Watch ad to continue" | Endless runners |
| **Rewarded Revive** | "Watch ad for 2nd chance" | High-investment sessions |
| **Remove Ads IAP** | $1.99 one-time | Loyal player retention |
| **Skin Packs IAP** | $0.99 per theme | When you have good art |
| **No-Monetization** | Pure free | Build audience first |
