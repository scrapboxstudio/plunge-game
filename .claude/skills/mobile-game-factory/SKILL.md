---
name: mobile-game-factory
description: >
  Rapid mobile game development skill for building addictive, app-store-ready games using Phaser 3 + Capacitor. Use this skill whenever the user wants to create a mobile game, build a game for iOS/Android, make an arcade-style game (Flappy Bird, endless runner, arcade shooter, stack game etc.), generate game assets, set up a game project, package a game for the app store, integrate AdMob ads, add in-app purchases, publish to Google Play or App Store, design a coin economy or cosmetics system, or create game art/audio assets. Trigger even for casual requests like "make me a game", "I want to build something like Flappy Bird", "how do I publish my game", or "I need a coin store". This skill covers the entire pipeline: concept → code → assets → monetization → publishing.
---

# Mobile Game Factory

A full pipeline for building addictive, app-store-ready mobile games — battle-tested from a real solo first-game release (PLUNGE, Phaser 3 + Capacitor 6, Google Play).

---

## Tech Stack (Always Use This)

| Layer | Tool | Why |
|---|---|---|
| Game Engine | **Phaser 3.60+** | Best HTML5 game framework, huge community, great docs |
| Mobile Wrapper | **Capacitor 6** | Wraps web game → native iOS + Android. Use v6+. |
| Language | **JavaScript / TypeScript** | Fast to write, AI-friendly, no compile friction |
| Persistence | **@capacitor/preferences** | Reliable storage in WebView — NOT localStorage |
| Asset Pipeline | **Midjourney / DALL-E 3** | Prompts in `assets-prompts/` reference files |
| Audio | **Phaser Audio** | Built-in, good enough for most games |
| Ads | **@capacitor-community/admob** | Standard mobile ad network |
| IAP | **capacitor-plugin-cdv-purchase** | The correct IAP package (see monetization.md) |
| Leaderboards | **Firebase Firestore** | Free tier, real-time, easy |

> **⚠️ localStorage is unreliable in Capacitor WebViews.** The OS can clear it and it doesn't survive all app states. Use `@capacitor/preferences` for everything that must persist (coins, lives, high score, owned cosmetics, settings). Plan for this from the START — retrofitting it late means touching every save/load call.

> **⚠️ Device-only bugs live in `references/runtime-lessons.md`.** The hardest PLUNGE bugs passed in the browser and only broke on real Android: the rewarded-ad revive freeze, music silence / loader hang from big audio, saved data wiped on update, and menus overflowing small screens. Read that file BEFORE shipping ads or audio, and whenever something works locally but not on a tester's phone.

---

## Workflow: From Idea to App Store

```
1. CONCEPT (5 min)       → Pick game archetype + theme
2. SCAFFOLD (10 min)     → Run setup commands, get boilerplate running
3. CORE LOOP (2-4 hrs)   → Code the one mechanic that makes it addictive
4. ASSETS (1-2 hrs)      → Generate with AI prompts, drop into /assets
5. JUICE (1 hr)          → Particles, screen shake, sound, haptics
6. MONETIZE (30 min)     → AdMob + IAP setup
7. PACKAGE (30 min)      → Capacitor build → signed .aab
8. SUBMIT (1-2 hrs)      → Play Console setup + closed testing track
9. TESTER WAIT (14 days) → Get 12+ testers opted in, maintain 14 days
10. PRODUCTION (1 hr)    → Promote Alpha → Production, submit for review
```

> **Real timeline for a solo first-timer:** The code is the easy part. The long poles are Google account verification (days), finding testers (days), the 14-day closed test window, and payment/merchant verification. Start these early and in parallel with coding.

---

## Three-Tool Workflow (Solo Dev with AI)

This is what works in practice:

| Tool | Role |
|---|---|
| **Planning chat** (Claude.ai) | Strategy, design decisions, debugging logic, asset direction. Cannot touch files. |
| **Claude Code** (VS Code) | Reads/edits actual codebase, runs terminal commands. Reads `CLAUDE.md` each session. |
| **Claude Cowork** | Drives the desktop — Play Console, AdMob dashboard, Android Studio UI tasks. |

**The bridge problem:** Planning chat and Claude Code cannot talk directly — YOU are the bridge. Copy key decisions into `CLAUDE.md` so Code picks them up next session.

**Keep `CLAUDE.md`** as the shared notebook: tech stack, run commands (from git root), key file map, app IDs, keystore location, AdMob unit IDs. Update it whenever anything ships.

**One chat per game.** Long chats lose early context. Start fresh, load the skill, paste a short project summary at the top. Keep a running project summary to paste when resuming.

**Disable conflicting VS Code AI extensions** (Cline, Continue, Codeium). Copilot can coexist (autocomplete vs chat).

---

## Step 1: Concept — Pick Your Archetype

Read `references/archetypes.md` for detailed breakdowns. Quick reference:

| Archetype | Core Mechanic | Build Time | Addictiveness |
|---|---|---|---|
| **Tap Runner** (Flappy Bird) | One-button timing | 3-4 hrs | 🔥🔥🔥🔥🔥 |
| **Endless Runner** (Subway Surfers) | Swipe dodge/jump | 6-10 hrs | 🔥🔥🔥🔥🔥 |
| **Arcade Shooter** (Galaxian) | Aim + shoot, waves | 8-12 hrs | 🔥🔥🔥🔥 |
| **Stack/Hyper Casual** | Tap timing precision | 2-3 hrs | 🔥🔥🔥🔥🔥 |
| **Endless Diver** (PLUNGE-style) | Tilt/dodge, biome progression | 6-10 hrs | 🔥🔥🔥🔥🔥 |
| **Brick Breaker** | Ball physics + powerups | 4-6 hrs | 🔥🔥🔥🔥 |

**Start with Tap Runner or Stack for first games. Ship fast.**

**Secret/endless content drives retention.** Once the core loop is solid, add a hidden late-game zone. See `references/archetypes.md` for the full pattern.

---

## Step 2: Project Scaffold

### First-time setup (run once)
```bash
npm install -g @capacitor/cli
```

### New game project
```bash
mkdir my-game && cd my-game
npm init -y
npm install phaser
npm install -D vite
npx cap init "My Game Name" com.yourname.mygame --web-dir dist
npm install @capacitor/core @capacitor/android @capacitor/ios
npm install @capacitor/preferences @capacitor/haptics @capacitor/status-bar @capacitor/splash-screen
npm install @capacitor-community/admob
npm install capacitor-plugin-cdv-purchase   # for IAP — NOT @capacitor-community/in-app-purchases (doesn't exist)
npx cap add android
npx cap add ios
```

### vite.config.js
```js
export default {
  base: './',
  build: { outDir: 'dist' }
}
```

### Project structure
```
my-game/
├── src/
│   ├── main.js
│   ├── scenes/
│   │   ├── Boot.js        ← Load assets
│   │   ├── Menu.js        ← Main menu + high score
│   │   ├── Game.js        ← Core gameplay loop
│   │   └── GameOver.js    ← Score, restart, ads
│   └── utils/
│       ├── StorageManager.js  ← @capacitor/preferences wrapper
│       └── AdManager.js       ← AdMob wrapper
├── android/
├── ios/
├── assets/
│   ├── images/
│   ├── audio/
│   └── fonts/
├── capacitor.config.json
├── package.json
├── CLAUDE.md              ← Shared AI context notebook
└── vite.config.js
```

Read `references/boilerplate-code.md` for ready-to-paste scene templates.

---

## Step 3: Core Loop Patterns

### The Addiction Formula
Every great mobile game has:
1. **Instant start** — playing in <3 seconds of opening
2. **One-more-try loop** — death is fast, restart is instant
3. **Progressive difficulty** — gets harder every 30 seconds
4. **Score milestone feedback** — celebrate 100, 500, 1000 points
5. **Personal best** — always show vs their high score

### Difficulty Scaling Template
```js
const difficulty = Math.floor(this.score / 10);
const speed = Phaser.Math.Clamp(200 + difficulty * 15, 200, 600);
const spawnRate = Phaser.Math.Clamp(1500 - difficulty * 50, 400, 1500);
```

### Mobile Input — CRITICAL RULES
```js
// ✅ CORRECT — works on touchscreens
this.input.on('pointerdown', () => this.doThing());
this.input.on('pointerup', () => this.stopThing());

// ❌ WRONG — pointerover / pointerout NEVER fire on touchscreens
btn.on('pointerover', () => btn.setTint(0xaaaaaa));  // invisible on mobile
btn.on('pointerout', () => btn.clearTint());          // never fires
```

**Use only `pointerdown` / `pointerup` for all button feedback and interaction.**

---

## Step 4: Asset Generation

See `assets-prompts/image-prompts.md` for full prompt library and `references/sprite-dimensions.md` for sizes.

### ADD Blend Mode — Neon Art Style
ADD blend mode: **pure black (#000000) = invisible**. Design sprites on black canvas with neon art on top. No transparency channel needed. AI handles "neon art on pure black background" prompts extremely well.

```js
sprite.setBlendMode(Phaser.BlendModes.ADD);
```

For color cosmetics on multicolored sprites — desaturate first, then tint:
```js
sprite.setTint(0x888888);  // desaturate
sprite.setTint(0xff6600);  // then apply color — clean, not muddy
```

### Android vs iOS Font Width
Android renders fonts wider than iOS. Always clamp:
```js
txt.setScale(Math.min(1.0, maxWidth / txt.width));
```

---

## Step 5: Juice

```js
this.cameras.main.shake(200, 0.01);                                     // screen shake
this.tweens.add({ targets: player, alpha: 0, yoyo: true, repeat: 3, duration: 80 }); // flash
this.tweens.add({ targets: scoreTxt, scaleX: 1.4, scaleY: 1.4, yoyo: true, duration: 100 }); // score pop
this.particles.emitParticleAt(x, y, 10);                                // particle burst

import { Haptics, ImpactStyle } from '@capacitor/haptics';
await Haptics.impact({ style: ImpactStyle.Medium });                     // haptics

this.hitSFX?.play();        // null-check audio — prevents crash on scene restart
```

---

## Step 6: Monetization

Read `references/monetization.md` for full AdMob code, IAP setup, and economy design.
Read **`references/runtime-lessons.md` §1** for the rewarded-ad pattern that actually ships
(the monetization.md flag+dismiss pattern is the foundation but is NOT sufficient alone).

**Ad placements:**
- Interstitial: game over only, every 3rd death
- Rewarded: "watch ad to continue / earn a life" — **grant a life and let the player tap to
  resume; do NOT auto-revive from the ad callback.** Detect the reward via the event AND the
  `showRewardVideoAd()` return value AND a ~45s failsafe. See `runtime-lessons.md` §1.
- Banner: optional, menu only

**Economy that works (from PLUNGE):**
- ~200 coins/run at mid-skill level
- 1 life = 100 coins
- Cosmetics: 300 → 12,000 coins (Common → Legendary)
- ~55 days to unlock F2P — keeps players returning
- Coin store: real $ price as primary label, coin count secondary
- "BEST VALUE" / "MOST POPULAR" badges anchor the mid/high packs
- Make 2-3 Legendary items actual sprite swaps — those are what players chase

---

## Step 7: Package & Sign

Read `references/publishing-android.md` for the exact commands — Windows env vars, the
`keytool -genkeypair` keystore command, the build.gradle signing block, manifest +
`styles.xml` notch/fullscreen config, and the CLI AAB build.

```bash
npm run build && npx cap sync
npx cap open android   # opens Android Studio
# Build → Generate Signed Bundle → Android App Bundle (.aab)
# CLI alternative: cd android && ./gradlew bundleRelease
```

### Keystore Rules (CRITICAL)
- PKCS12 format — one password for store + key
- Change password with `-storepasswd` ONLY (not `-keypasswd` — errors on PKCS12)
- **Back up `.jks` to USB + cloud immediately.** Lose it = can never update the app, ever.
- Password in password manager — NEVER plaintext, NEVER in a chat window
- `key.properties` must be in `.gitignore`
- Every upload needs a higher `versionCode` — even re-uploads to the same track

---

## Step 8: Google Play Submission

Read `references/app-store-submission.md` for full checklist.

### Account Setup — Do In This Order
1. **Identity verification** (passport/license) — hours to days, slowest gate, start FIRST
2. **Android device verification** — real Android phone is far more reliable than an emulator
3. **Phone number** — auto-unlocks after 1 + 2
4. **Merchant/payments profile** — ~24 hours to verify, needed for IAP

Must use Gmail. $25 one-time fee.

### Closed Testing → Production Path (New Accounts)
New accounts cannot publish to Production directly:
1. Upload AAB to **Closed Testing (Alpha)**
2. Add tester Gmail addresses to email list in Play Console
3. Get **12+ testers opted in** via the opt-in link (`play.google.com/apps/testing/com.your.package`)
4. Maintain testers for **14 continuous days**
5. Promote Alpha → Production → submit for review (1–7 days)

**Finding testers is the real bottleneck.** Sources: r/androidgaming, r/indiegaming, indie Discords, friends/family. Line them up before you hit this stage. They only need to install, not play.

---

## Marketing From Zero

- **r/indiegaming + r/androidgaming** — genuine first-game story + trailer performs well
- **TikTok/Reels** — algorithm surfaces cold accounts; no following needed
- **Product Hunt** — launch Tue/Wed AM
- **itch.io web build** — free discovery channel
- **30-second trailer formula:** mystery cold open → difficulty escalating → near-death tension → death flash → title + store badge
- A striking art style is half the marketing — it stops the scroll
- Early installs + ratings from friends/family signal legitimacy to store algorithm; line them up for launch week

---

## Quality Checklist Before Submission

- [ ] 60fps on mid-tier Android (Pixel 4a level)
- [ ] Tested on real Android device
- [ ] No crash on minimize + return
- [ ] Portrait mode locked
- [ ] Status bar hidden
- [ ] `@capacitor/preferences` for all persistence (NOT localStorage)
- [ ] All buttons use pointerdown (not pointerover)
- [ ] Text scales on Android (no overflow)
- [ ] Audio mute works
- [ ] Restart < 1 second
- [ ] Ad IDs switched from TEST to REAL
- [ ] Privacy policy URL live
- [ ] Screenshots captured
- [ ] Keystore backed up (USB + cloud)
- [ ] `key.properties` in `.gitignore`
- [ ] `versionCode` incremented

---

## Game Prompt Templates (for AI coding sessions)

### Tap Runner (Flappy Bird)
```
Build a Phaser 3 mobile game:
- Boot → Menu → Game → GameOver scenes
- Game: player auto-falls (gravity 800), tap/pointerdown applies upward velocity (-350). Obstacles scroll left. Score per obstacle passed. Die on collision or off-screen.
- GameOver: score, high score, restart button
- Use @capacitor/preferences (NOT localStorage) for high score
- Mobile-first: 390×844 canvas, input on pointerdown only (pointerover never fires on touch)
- Null-check audio: this.sfx?.play()
- Gate die() with this._dead flag to prevent double-fire
- Placeholder colored rectangles for sprites
- Screen shake on death, score pop on point
```

### Endless Runner
```
Build a Phaser 3 endless side-scrolling runner:
- Parallax background (2 layers), auto-running player
- Tap = jump, swipe down = slide — use pointerdown/pointerup only
- Coins, speed increase over time
- @capacitor/preferences for high score + coins
- Scale all text: txt.setScale(Math.min(1.0, maxWidth / txt.width))
```

### Arcade Shooter
```
Build a Phaser 3 vertical arcade shooter:
- Player at bottom, drag left/right (pointerdown + pointermove — no pointerover)
- Auto-fires every 300ms, enemy waves from top
- Basic / armored / boss enemies, score via @capacitor/preferences
```
