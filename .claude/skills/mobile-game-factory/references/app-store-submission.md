# App Store Submission Guide

## Full Build Pipeline

```bash
# 1. Build the web game
npm run build

# 2. Sync to native projects
npx cap sync

# 3. Open in Xcode (iOS) or Android Studio (Android)
npx cap open ios
npx cap open android
```

---

## iOS Submission (App Store Connect)

### Requirements
- Mac with Xcode 15+
- Apple Developer Account ($99/year)
- Paid at developer.apple.com

### Xcode Steps
1. Open project with `npx cap open ios`
2. **Signing & Capabilities** → Select your Team, set Bundle ID
3. **General** → Set version (1.0.0) and build number (1)
4. **Product** → **Scheme** → Select your app name (not simulator)
5. **Product** → **Archive**
6. In Organizer → **Distribute App** → **App Store Connect** → Upload

### App Store Connect Setup
1. Go to appstoreconnect.apple.com
2. My Apps → + → New App
3. Fill in: Name, Bundle ID, SKU, Language
4. App Information: Category → Games → [Subcategory]
5. Pricing: Free
6. Screenshots: **Most important thing** — use Figma or Canva

### Screenshot Sizes Required
| Device | Size |
|---|---|
| iPhone 6.7" (required) | 1290×2796 |
| iPhone 6.5" (required) | 1242×2688 |
| iPhone 5.5" | 1242×2208 |

**Screenshot tip**: Don't show the raw game. Add a phone mockup frame + tagline. Use Canva → "App Store Screenshot" templates.

### App Review Notes
```
This is a casual arcade game. No login required. No personal data collected. 
No third-party account needed to use any features.
Demo account: N/A
```

---

## Android Submission (Google Play Console)

### Requirements  
- Google Play Developer Account ($25 one-time)
- Paid at play.google.com/console

### Android Studio Steps
1. Open project with `npx cap open android`
2. **Build** → **Generate Signed Bundle / APK**
3. Choose **Android App Bundle** (.aab) — required for new apps
4. Create keystore (save this file safely! Cannot recover)
5. Upload .aab to Play Console

### ⚠️ Save Your Keystore File
```
Store the .jks keystore file in a SAFE PLACE (cloud backup).
If you lose it, you CANNOT update the app. You would have to republish as a new app.
```

### Play Console Setup
1. Create app → App name, Language, Type (Game), Free
2. Dashboard → Complete all tasks (they guide you through)
3. **Store listing**: Icon, Feature graphic, Screenshots, Description
4. **Content rating**: Complete questionnaire (takes 5 min)
5. **Target audience**: Age group
6. **Data safety**: Most simple games: no data collected
7. **Production track**: Upload .aab → Review and publish

### Screenshots Required
| Device | Size |
|---|---|
| Phone (required) | Min 320px, max 3840px per side |
| 7-inch tablet | Optional but recommended |

Feature Graphic: 1024×500 (required) — this shows in search results

---

## Privacy Policy (Required by Both Stores)

### Free Hosting Option
Use GitHub Pages or Notion for a free URL.

### Minimal Privacy Policy Template
```
Privacy Policy for [Game Name]

Last updated: [Date]

[Game Name] is a free arcade game. 

Information we collect: This app does not collect any personal information.

Advertising: This app uses Google AdMob to display advertisements. 
AdMob may collect device identifiers and usage data to show relevant ads. 
See Google's Privacy Policy at https://policies.google.com/privacy

Children: This app is not directed at children under 13.

Contact: [your email]
```

Post this on a GitHub Pages site or any public URL.

---

## Screenshot Creation Workflow (Fast)

1. **Capture**: Run game in browser, resize to phone dimensions, screenshot
2. **Frame**: Import to Canva → search "App Store Screenshot" → pick template
3. **Customize**: Drop in screenshot, change background color to match game theme
4. **Text**: Add 3-word tagline per screen ("One Tap. Infinite Fun.")
5. **Export**: PNG, correct dimensions

**5 screenshots per store × 15 min each = ~1.25 hours**

---

## Launch Day Checklist

**Before submitting:**
- [ ] Tested on real iOS device
- [ ] Tested on real Android device  
- [ ] Ad unit IDs switched from TEST to REAL
- [ ] High score actually saves and loads correctly
- [ ] Audio mute button works
- [ ] No console errors
- [ ] App doesn't crash on backgrounding
- [ ] Privacy policy URL is live and accessible

**Store listing:**
- [ ] App icon (all sizes)
- [ ] 5+ screenshots
- [ ] Feature graphic (Android)
- [ ] Short description (<80 chars, punchy)
- [ ] Full description (keyword-rich, 500+ words)
- [ ] Category: Games → [Arcade / Casual / Action]
- [ ] Content rating complete
- [ ] Privacy policy URL

**After submission:**
- iOS review: 24-48 hours typically
- Android review: 1-3 days typically
