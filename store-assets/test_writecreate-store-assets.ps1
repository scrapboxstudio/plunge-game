$base = "C:\Users\Mars\Desktop\projects\plunge-game\store-assets"

# store-listing.md
Set-Content "$base\store-listing.md" -Encoding UTF8 @"
# PLUNGE — Store Listing Copy

## Short Description (80 chars max)
Dive deep. Dodge everything. How far can you plunge?

*(79 characters — fits Google Play and App Store)*

---

## Full Description (Google Play / App Store Connect)

**PLUNGE** is a fast-paced deep sea diving arcade game. One tap controls your diver as you descend through increasingly dangerous ocean depths. How deep can you go before the ocean claims you?

### DIVE THROUGH 5 BREATHTAKING ZONES

🌊 **The Shallows** — Bright water, gentle currents. Learn the ropes before the deep gets dark.

🌿 **Kelp Forest** — Towering kelp columns twist and close in. Navigate the tangle or get wrapped up.

🌑 **Midnight Zone** — No light reaches here. Only bioluminescent hazards cutting through the black.

🦑 **Hadal Trench** — The crushing deep. Ancient creatures and collapsing rock walls. Pure survival.

⬜ **The Void** — Beyond depth. Beyond logic. If you reach it, you'll know.

### FEATURES
- Addictive one-tap arcade gameplay — easy to pick up, impossible to master
- 5 hand-crafted biomes with unique obstacles, enemies, and visual style
- Original deep sea soundtrack — original music for every zone
- Unlock depth milestones and beat your personal record
- No internet required — play anywhere
- Optional ads and in-app upgrades — never pay to progress

### HOW TO PLAY
Tap to steer. Avoid obstacles. Descend. That's it. The rest is between you and the abyss.

### PERMISSIONS
PLUNGE requests internet access for optional ads (AdMob). No account required. No personal data collected. See our Privacy Policy for full details.

---

## Keyword Tags (5)

1. arcade
2. diving
3. deep sea
4. one tap
5. endless

---

## Additional Metadata

- **Category:** Games → Arcade
- **Content Rating:** Everyone (ESRB E / PEGI 3)
- **Price:** Free (with optional ads + IAP)
- **Developer Name:** Scrapbox Studio
- **Contact Email:** scrapbox.studio@protonmail.com
"@

Write-Host "store-listing.md created"

# privacy-policy.md
Set-Content "$base\privacy-policy.md" -Encoding UTF8 @"
# Privacy Policy — PLUNGE

**Effective Date:** June 3, 2026
**Developer:** Scrapbox Studio
**Contact:** scrapbox.studio@protonmail.com

---

## Overview

PLUNGE is developed by Scrapbox Studio. This Privacy Policy explains what data is collected when you use the App and your rights.

**No account is required to play PLUNGE.** We do not collect your name, email address, or any personally identifying information from you directly.

---

## Data Collected by Third Parties

### Advertising — Google AdMob

The App displays optional ads powered by Google AdMob. AdMob may collect and use data including:
- Device identifiers (advertising ID)
- IP address (approximate location)
- App usage and interaction data
- Device type, OS, and language

AdMob privacy policy: https://policies.google.com/privacy

Opt out via device settings:
- Android: Settings → Privacy → Ads → Opt out of Ads Personalization
- iOS: Settings → Privacy & Security → Apple Advertising → off

### In-App Purchases

Transactions are processed by Google Play or Apple App Store. We do not receive or store payment card information.

---

## Data We Do NOT Collect

We do not operate analytics or tracking. We do not collect:
- Name, email, or contact info
- Location
- Photos, files, or contacts
- Login credentials

---

## Children's Privacy (COPPA)

PLUNGE does not knowingly collect personal information from children under 13. If you believe a child has provided info, contact scrapbox.studio@protonmail.com.

---

## Changes to This Policy

Updates will be posted at the same public URL. Continued use constitutes acceptance.

---

## Contact

Scrapbox Studio
scrapbox.studio@protonmail.com
"@

Write-Host "privacy-policy.md created"

# admob-setup-guide.md
Set-Content "$base\admob-setup-guide.md" -Encoding UTF8 @"
# AdMob Setup Guide — PLUNGE

## Step 1 — Create AdMob Account
1. Go to https://admob.google.com
2. Sign in with your Scrapbox Studio Google account
3. Click Get Started and complete onboarding
4. Enter: Account name = Scrapbox Studio, Country, Time zone
5. Accept terms — you land on the AdMob dashboard

## Step 2 — Add PLUNGE to AdMob
1. Click Apps in the left sidebar
2. Click Add App → choose Android (do iOS later when you have a Mac)
3. Select "No, app is not published yet"
4. Enter App Name: PLUNGE
5. Copy the App ID (ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX)

## Step 3 — Create Ad Units

### Banner
1. App page → Ad units → Add ad unit → Banner
2. Name: plunge-banner
3. Create and copy the Ad Unit ID

### Interstitial
1. Add ad unit → Interstitial
2. Name: plunge-interstitial
3. Create and copy the Ad Unit ID

## Step 4 — Plug IDs Into Codebase

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
AdMob → Apps → Link to Play Store → search and link your app to unlock full targeting and payments.
"@

Write-Host "admob-setup-guide.md created"

# keystore-backup-instructions.md
Set-Content "$base\keystore-backup-instructions.md" -Encoding UTF8 @"
# Keystore Backup Instructions — PLUNGE

Your keystore (plunge-keystore.jks at C:\Users\Mars\) is irreplaceable.
Losing it means you can NEVER update your Play Store app. Ever. Do this today.

## What to Back Up
- plunge-keystore.jks (the file)
- Keystore password
- Key alias
- Key password (if different)

## Step 1 — USB Drive
1. Plug in a dedicated USB drive
2. Create folder: Scrapbox-Studio-Keys/
3. Copy plunge-keystore.jks into it
4. Add KEYSTORE-INFO.txt (alias, date — NOT the password in plaintext)
5. Store USB somewhere physically separate from your laptop

## Step 2 — Cloud
Option A: Google Drive private folder (Scrapbox Studio/Keys)
Option B: Password manager with file attachment (recommended)
Option C: Encrypted ZIP uploaded to any cloud storage

## Step 3 — Password Storage
NEVER store in: desktop text files, Notion, email, Discord

DO store in:
- Bitwarden (free): https://bitwarden.com
- Create entry "PLUNGE Keystore" with password, alias, key password

## If You Lose It
You cannot update your Play Store listing. You'd need a new listing, new package name, zero reviews. No recovery. Google will not help.

## Checklist
- [ ] Copied to USB
- [ ] USB stored safely (not with laptop)
- [ ] Uploaded to cloud (private folder)
- [ ] Password stored in password manager
- [ ] Can access without your current laptop
"@

Write-Host "keystore-backup-instructions.md created"

# missing-content-checklist.md
Set-Content "$base\missing-content-checklist.md" -Encoding UTF8 @"
# Missing Content Checklist — PLUNGE

> Cross-check filenames against your actual this.load.* calls in src/scenes/Game.js
> Run: grep -n "this.load." src/scenes/Game.js to see exact keys

## Biome Structure (assumed from project description)
0. Shallows / Surface (starting zone)
1. Kelp Forest (200-800m)
2. Midnight Zone (800-3000m)
3. Hadal Trench (3000-6000m)
4. The Void (6000m+)

---

## Missing Obstacle Sprites

Kelp Forest:
- [ ] kelp-obstacle-left.png
- [ ] kelp-obstacle-right.png

Midnight Zone:
- [ ] midnight-obstacle-jellyfish.png
- [ ] midnight-obstacle-wall-left.png
- [ ] midnight-obstacle-wall-right.png

Hadal Trench:
- [ ] hadal-obstacle-rock-left.png
- [ ] hadal-obstacle-rock-right.png
- [ ] hadal-obstacle-debris.png

The Void:
- [ ] void-obstacle-fragment.png
- [ ] void-obstacle-bar.png

---

## Missing Backgrounds (5 total)

- [ ] bg-shallows.png — bright blue, light rays, surface visible
- [ ] bg-kelp.png — dense green kelp, darker water
- [ ] bg-midnight.png — near-black, bioluminescent particles
- [ ] bg-hadal.png — dark rocky walls, crushing depth
- [ ] bg-void.png — pure white or glitchy abstract

Recommended size: match your game resolution (check index.html or main.js config)

---

## Missing Music (3 per biome, ~15 tracks total)

- [ ] music-shallows-1.mp3 / -2 / -3
- [ ] music-kelp-1.mp3 / -2 / -3
- [ ] music-midnight-1.mp3 / -2 / -3
- [ ] music-hadal-1.mp3 / -2 / -3
- [ ] music-void-1.mp3 / -2 / -3

Generate via Suno. Prompts:
- Kelp: "underwater ambient, slow bubbling, light and eerie, no vocals"
- Midnight: "deep sea horror ambient, bioluminescent, tense, no melody"
- Hadal: "crushing pressure, low drone, dark industrial, 120bpm"
- Void: "distorted glitch ambient, reversed reverb, unsettling"

---

## Missing SFX

- [ ] sfx-hit.mp3 — obstacle collision (short thud)
- [ ] sfx-death.mp3 — player death (impact + fade)
- [ ] sfx-collect.mp3 — pickup (bright chime)
- [ ] sfx-burst.mp3 — boost/bubble burst
- [ ] sfx-transition.mp3 — biome change (whoosh or depth ping)

---

## Special Effects

- [ ] The Void white flash transition (likely a code effect — check for flash-overlay.png or void-flash.png)

---

## Quick Verification Commands
List all current assets:
  find public/assets -type f | sort

Check all Phaser load calls:
  grep -n "this.load\." src/scenes/Game.js
  grep -n "this.load\." src/main.js
"@

Write-Host "missing-content-checklist.md created"

Write-Host ""
Write-Host "ALL FILES CREATED SUCCESSFULLY in $base"
