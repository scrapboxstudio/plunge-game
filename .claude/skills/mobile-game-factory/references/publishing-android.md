# Android Publishing Reference
## Learned from shipping PLUNGE to Google Play

---

## Windows Environment Variables (set once)

```
ANDROID_HOME = C:\Users\<you>\AppData\Local\Android\Sdk
JAVA_HOME    = C:\Program Files\Android\Android Studio\jbr
PATH         += %ANDROID_HOME%\platform-tools
```
Set via: System Properties → Environment Variables → System Variables

---

## Keystore Creation (ONE TIME — back up immediately to USB + cloud)

```powershell
keytool -genkeypair -v -storetype PKCS12 -keystore C:\Users\<you>\my-game-keystore.jks -alias my-game -keyalg RSA -keysize 2048 -validity 10000
```

**PKCS12 quirk:** store password and key password are unified (one password).
To change password later:
```powershell
keytool -storepasswd -keystore C:\Users\<you>\my-game-keystore.jks
```
Use `-storepasswd` ONLY — `-keypasswd` errors on PKCS12.

**Back up:**
- `my-game-keystore.jks` → USB drive + encrypted cloud folder
- Password → password manager (never in plaintext, never in chat)
- If you lose the keystore you CANNOT update the app on Play Store ever again

---

## android/key.properties (NEVER COMMIT — add to .gitignore)

```
storePassword=YourPassword
keyPassword=YourPassword
keyAlias=my-game
storeFile=C:/Users/<you>/my-game-keystore.jks
```

---

## android/app/build.gradle — Signing Block

```groovy
def keystorePropertiesFile = rootProject.file("key.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    defaultConfig {
        versionCode 1       // increment by 1 for EVERY upload to Play Console
        versionName "1.0.0" // user-visible version string
    }
    signingConfigs {
        release {
            keyAlias      keystoreProperties['keyAlias']
            keyPassword   keystoreProperties['keyPassword']
            storeFile     keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
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

---

## AndroidManifest.xml

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
    <meta-data
        android:name="com.google.android.gms.ads.APPLICATION_ID"
        android:value="ca-app-pub-XXXXXXXX~XXXXXXXXXX"/>
  </application>
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="com.google.android.gms.permission.AD_ID" />
</manifest>
```

## styles.xml — Fullscreen + Notch Support

Add inside AppTheme:
```xml
<item name="android:windowFullscreen">true</item>
<item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
```

---

## Build Signed AAB

```powershell
cd android
.\gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

Every upload to Play Console needs a higher `versionCode` in build.gradle.

---

## Google Play Console — Account Setup (One Time)

- Must use a **Gmail** account — protonmail and other providers cannot sign in directly
- Pay **$25 one-time** developer registration fee
- Complete developer profile (name, email, address, phone)
- **Identity verification** — upload passport or driver's license photo (takes hours to days — start immediately)
- **Android device verification** — install Google Play Console app on an Android device and sign in
  - Needs a physical Android phone OR an emulator with Google Play Store image
  - Emulator: Android Studio → Virtual Device Manager → pick device with ▶ Play icon → API 35, Services: Google Play Store
  - Must use Google Play Store image (not just Google APIs image)
- **Phone number verification** — unlocks after identity + device verification

---

## Google Play Console — Release Process

### New Account Requirement
New accounts CANNOT go straight to Production.
Must complete **14-day closed testing (Alpha)** with **20 testers** first.

### Steps
1. Upload AAB to **Testing → Closed testing (Alpha)** track
2. Add 20 testers by Gmail address
3. Share the opt-in link Play Console generates
4. Testers accept + install (they don't need to play, just install)
5. Wait **14 days** with testers active
6. Promote Alpha → Production
7. Submit for Google review (1–7 days typically)

### Finding 20 Testers Fast
- Post in r/androidgaming or r/indiegaming: "need alpha testers for first mobile game"
- Discord indie game dev servers (most have a #show-your-game channel)
- Friends and family — non-gamers count, they just need to install it

---

## Declarations Checklist (all required before submission)

- [ ] Content rating questionnaire completed
- [ ] Ads declaration — yes if using AdMob
- [ ] Target audience — 13+ if not targeting children
- [ ] In-app purchases declaration — yes if using IAP
- [ ] Data safety form — list what AdMob collects (device identifiers, usage data)
- [ ] Ad ID declaration — select "Analytics" if using AdMob rewarded/banner ads

---

## Phone-Only Restriction (Prevent Tablet/Desktop)

In AndroidManifest.xml:
```xml
<uses-feature android:name="android.hardware.telephony" android:required="true" />
```
This hides the app from tablet listings on Google Play automatically.

Web fallback (index.html):
```javascript
const isPhone = window.innerWidth < 768 && 
  (navigator.userAgent.includes('Mobile') || 
   window.matchMedia('(pointer: coarse)').matches);
if (!isPhone) {
  // hide canvas, show "download on mobile" message
}
```

---

## IAP Product Setup in Play Console

Create AFTER uploading first AAB (tab only appears after an AAB exists):
- Monetize → In-app products → Create product
- Type: Managed product (consumable)
- Status: Active
- Product ID must EXACTLY match the IDs in your code

---

## Version History Pattern

```
versionCode 1  → first upload (any track)
versionCode 2  → second upload (must be higher, even for same track)
versionName "1.0.0" → what users see
versionName "1.0.1" → bug fix
versionName "1.1.0" → new feature
```
