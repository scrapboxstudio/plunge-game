# AdMob Setup Guide â€” PLUNGE

## Step 1 â€” Create AdMob Account
1. Go to https://admob.google.com
2. Sign in with your Scrapbox Studio Google account
3. Click Get Started and complete onboarding
4. Enter: Account name = Scrapbox Studio, Country, Time zone
5. Accept terms â€” you land on the AdMob dashboard

## Step 2 â€” Add PLUNGE to AdMob
1. Click Apps in the left sidebar
2. Click Add App â†’ choose Android (do iOS later when you have a Mac)
3. Select "No, app is not published yet"
4. Enter App Name: PLUNGE
5. Copy the App ID (ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX)

## Step 3 â€” Create Ad Units

### Banner
1. App page â†’ Ad units â†’ Add ad unit â†’ Banner
2. Name: plunge-banner
3. Create and copy the Ad Unit ID

### Interstitial
1. Add ad unit â†’ Interstitial
2. Name: plunge-interstitial
3. Create and copy the Ad Unit ID

## Step 4 â€” Plug IDs Into Codebase

### capacitor.config.json
{
  "plugins": {
    "AdMob": {
      "appId": {
        "android": "ca-app-pub-XXXXXXXX~XXXXXXXXXX",
        "ios": "ca-app-pub-XXXXXXXX~XXXXXXXXXX"
      }
    }
  }
}

### AndroidManifest.xml (inside <application>)
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-XXXXXXXX~XXXXXXXXXX"/>

### In your JS ad initialization:
Replace test IDs with real ones ONLY in release builds:
- Banner:       ca-app-pub-XXXXXXXX/XXXXXXXXXX
- Interstitial: ca-app-pub-XXXXXXXX/XXXXXXXXXX

## Test Ad IDs (use in dev only)
- Banner:       ca-app-pub-3940256099942544/6300978111
- Interstitial: ca-app-pub-3940256099942544/1033173712
- Rewarded:     ca-app-pub-3940256099942544/5224354917

## After Publishing
AdMob â†’ Apps â†’ Link to Play Store â†’ search and link your app to unlock full targeting and payments.
