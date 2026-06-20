# App Store Submission Guide

---

## Google Play — Account Setup (Do In This Exact Order)

This order unblocks you fastest. Doing them out of order causes delays.

### 1. Identity Verification (Start FIRST — Slowest Gate)
- Go to Play Console → upload government ID (passport or driver's license photo)
- Takes hours to days to verify — start immediately
- Everything else is blocked until this clears

### 2. Android Device Verification
- Install the **Google Play Console** app on a real Android phone
- Sign in with your developer Gmail account
- **Real phone is strongly recommended.** Emulators often fail ("can't verify using this device") even with the correct Google Play system image. Browser verification is sometimes offered as an alternative on the device-verification screen.
- If using an emulator: must use Google Play system image (shows ▶ Play icon in AVD Manager) — NOT the Google APIs image

### 3. Phone Number Verification
- Auto-unlocks after steps 1 + 2 complete

### 4. Merchant/Payments Profile (for IAP)
- Required to create in-app products
- Takes ~24 hours to verify
- Start this as early as possible — you can't add IAP products until it's done

### Account Notes
- **Must use a Gmail account** — Protonmail and other providers cannot sign in to Play Console
- **$25 one-time fee** — paid at play.google.com/console
- The IAP "In-app products" tab only appears after uploading at least one AAB to any track

---

## The Closed Testing Requirement (New Accounts — Critical)

New developer accounts **cannot publish straight to Production.** Required path:

```
1. Upload AAB → Closed Testing (Alpha track)
2. Add Gmail addresses to tester email list
3. Send opt-in link to testers: play.google.com/apps/testing/com.your.package
4. Get minimum 12 testers opted in (check current Google requirement — it changes)
5. Maintain 12+ testers with app installed for 14 continuous days
6. Apply for Production access → Submit for review (1–7 days)
```

### Finding Testers (The Real Bottleneck)
Testers only need to INSTALL the app — they don't have to play it.

**Sources that work:**
- r/androidgaming and r/indiegaming — post a genuine first-game story
- Indie game Discord servers
- Friends and family (non-gamers count)
- Other indie devs doing tester exchanges

**Line these up BEFORE you hit this stage.** Don't wait until you've submitted.

### Tester Rules
- Play Console only accepts **Gmail/Google accounts** — Yahoo, Protonmail, etc. will error on save
- Use **BCC** when emailing testers — keeps everyone's address private from each other
- Testers must click the opt-in link AND install via Play Store for it to count toward the 14 days
- Being on the email list automatically gives testers sandbox IAP (no real charges)

---

## Full Build Pipeline

```bash
# 1. Build web assets
npm run build

# 2. Sync to native
npx cap sync

# 3. Open Android Studio
npx cap open android
# Build → Generate Signed Bundle / APK → Android App Bundle (.aab)
```

---

## Keystore — Critical Rules

```
⚠️ Lose your keystore = can NEVER update the app again. Ever.
You would have to unpublish and start a new listing from scratch.
```

- Use **PKCS12 format** — single password for store + key (simpler)
- To change password: use `-storepasswd` ONLY. `-keypasswd` errors on PKCS12.
- **Back up the `.jks` file to USB + cloud storage IMMEDIATELY after creating it**
- Store the password in a **password manager** — NEVER in plaintext, a code file, a chat window, or an email
- If a password is accidentally pasted into a chat, **rotate it immediately**
- Add `key.properties` to `.gitignore`
- Every AAB upload (even to the same track) needs a **higher versionCode**

### key.properties (gitignored)
```properties
storePassword=your_password
keyPassword=your_password
keyAlias=your_key_alias
storeFile=../keystore/your.jks
```

### android/app/build.gradle
```gradle
def keystorePropertiesFile = rootProject.file("key.properties")
def keystoreProperties = new Properties()
keystoreProperties.load(new FileInputStream(keystorePropertiesFile))

android {
    signingConfigs {
        release {
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

---

## Play Console Setup Steps

1. Create app → App name, Language, Type (Game), Free/Paid
2. Dashboard → Complete all tasks (guided checklist)
3. **Store listing:** Icon (512×512), Feature graphic (1024×500), Screenshots, Description
4. **Content rating:** Complete questionnaire (~5 min)
5. **Target audience:** Age group
6. **Data safety:** Most simple games: no data collected (if using only @capacitor/preferences locally)
7. **Closed Testing (Alpha):** Upload AAB, add testers, get opt-ins

### R8/ProGuard Warning
You'll see "no deobfuscation file associated with this App Bundle" warning in Play Console — **safe to ignore** for Phaser/JS games running in a WebView.

---

## Store Assets Required

| Asset | Size | Notes |
|---|---|---|
| App Icon | 512×512 PNG | Android Play Store |
| Feature Graphic | 1024×500 PNG | Shows in search results — important! |
| Phone Screenshots | Min 320px, max 3840px | At least 4 required |
| Short Description | <80 chars | Punchy — shows in search |
| Full Description | 500+ words | Keyword-rich for ASO |

### Screenshot Creation (Fast)
1. Capture: Run game in browser at phone dimensions, screenshot
2. Frame: Canva → "App Store Screenshot" template
3. Text: 3-word tagline per screen ("One Tap. Infinite Fun.")
4. Export: PNG at correct dimensions

**5 screenshots × 15 min each = ~1.25 hours**

---

## Privacy Policy (Required)

Host on GitHub Pages or Notion for free.

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

---

## iOS Submission (App Store Connect)

### Requirements
- Mac with Xcode 15+
- Apple Developer Account ($99/year) at developer.apple.com

### Xcode Steps
1. `npx cap open ios`
2. Signing & Capabilities → Select Team, set Bundle ID
3. General → Set version (1.0.0) and build number (1)
4. Product → Archive
5. Organizer → Distribute App → App Store Connect → Upload

### Screenshot Sizes
| Device | Size |
|---|---|
| iPhone 6.7" (required) | 1290×2796 |
| iPhone 6.5" (required) | 1242×2688 |
| iPhone 5.5" | 1242×2208 |

---

## Launch Day Checklist

**Before submitting:**
- [ ] Tested on real Android device (not just simulator)
- [ ] Ad unit IDs switched from TEST to REAL
- [ ] All data persists using @capacitor/preferences (not localStorage)
- [ ] Audio mute works (pointerdown, not pointerover)
- [ ] No crash on backgrounding/returning
- [ ] Privacy policy URL is live
- [ ] No console errors

**Store listing:**
- [ ] App icon (512×512 Android, 1024×1024 iOS)
- [ ] Feature graphic (1024×500 Android)
- [ ] 4+ screenshots
- [ ] Short description (<80 chars)
- [ ] Full description (keyword-rich)
- [ ] Category: Games → Arcade / Casual / Action
- [ ] Content rating complete
- [ ] Data safety complete
- [ ] Privacy policy URL

**Keystore:**
- [ ] `.jks` backed up to USB + cloud
- [ ] Password in password manager
- [ ] `key.properties` in `.gitignore`

**After submission:**
- iOS review: 24-48 hours typically
- Android review: 1-7 days typically
- AdMob "Limited ad serving" lifts after linking live Play Store URL
