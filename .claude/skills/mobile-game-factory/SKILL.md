---
name: mobile-game-factory
description: >
  Rapid mobile game development skill for building addictive, app-store-ready games (Flappy Bird style, endless runners, arcade shooters, puzzle games, etc.) using Phaser 3 + Capacitor. Use this skill whenever the user wants to create a mobile game, build a game for iOS/Android, make an arcade-style game, generate game assets, set up a game project, or package a game for the app store. Trigger even if they just say "make me a game" or "I want to build something like Flappy Bird." This skill covers the entire pipeline: concept → code → assets → packaging → publishing.
---

# Mobile Game Factory

A full pipeline for pumping out addictive, app-store-ready mobile games fast.

## Tech Stack (Always Use This)

| Layer | Tool | Why |
|---|---|---|
| Game Engine | **Phaser 3** | Best HTML5 game framework, huge community, great docs |
| Mobile Wrapper | **Capacitor** | Wraps web game → native iOS + Android in minutes |
| Language | **JavaScript / TypeScript** | Fast to write, AI-friendly, no compile friction |
| Asset Pipeline | **Midjourney / DALL-E 3** | Prompts in `assets-prompts/` reference files |
| Audio | **Howler.js** or Phaser Audio | Simple, cross-platform sound |
| Ads / Monetization | **AdMob via Capacitor plugin** | Standard mobile ad network |
| Leaderboards | **Firebase Firestore** | Free tier, real-time, easy |

---

## Workflow: From Idea to App Store in a Weekend

```
1. CONCEPT (5 min)     → Pick game archetype + theme
2. SCAFFOLD (10 min)   → Run setup commands, get boilerplate running
3. CORE LOOP (2-4 hrs) → Code the one mechanic that makes it addictive
4. ASSETS (1-2 hrs)    → Generate with AI prompts, drop into /assets
5. JUICE (1 hr)        → Particles, screen shake, sound, haptics
6. MONETIZE (30 min)   → AdMob interstitials + rewarded ads
7. PACKAGE (30 min)    → Capacitor build → .ipa + .aab files
8. SUBMIT (1 hr)       → App Store Connect + Google Play Console
```

---

## Step 1: Concept — Pick Your Archetype

Read `references/archetypes.md` for detailed breakdowns. Quick reference:

| Archetype | Core Mechanic | Difficulty to Build | Addictiveness |
|---|---|---|---|
| **Tap Runner** (Flappy Bird) | One-button timing | ⭐⭐ Easy | 🔥🔥🔥🔥🔥 |
| **Endless Runner** (Subway Surfers) | Swipe dodge/jump | ⭐⭐⭐ Medium | 🔥🔥🔥🔥🔥 |
| **Arcade Shooter** (Galaxian) | Aim + shoot, waves | ⭐⭐⭐ Medium | 🔥🔥🔥🔥 |
| **Stack/Hyper Casual** (Stack) | Tap timing precision | ⭐ Very Easy | 🔥🔥🔥🔥🔥 |
| **Brick Breaker** | Ball physics + powerups | ⭐⭐ Easy | 🔥🔥🔥🔥 |
| **Match 3** | Grid swap + combos | ⭐⭐⭐⭐ Hard | 🔥🔥🔥🔥🔥 |

**Start with Tap Runner or Stack for first games. Ship fast.**

---

## Step 2: Project Scaffold

### First-time setup (run once)
```bash
npm install -g @ionic/cli @capacitor/cli
```

### New game project
```bash
mkdir my-game && cd my-game
npm init -y
npm install phaser
npm install -D vite
npx cap init "My Game Name" com.yourname.mygame --web-dir dist
npm install @capacitor/core @capacitor/ios @capacitor/android
npm install @capacitor/haptics @capacitor/status-bar @capacitor/splash-screen
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
│   ├── main.js          ← Phaser config + game init
│   ├── scenes/
│   │   ├── Boot.js      ← Load assets
│   │   ├── Menu.js      ← Main menu + high score display
│   │   ├── Game.js      ← Core gameplay loop
│   │   └── GameOver.js  ← Score, restart, ads
│   └── utils/
│       ├── ScoreManager.js   ← localStorage high scores
│       └── AdManager.js      ← AdMob wrapper
├── assets/
│   ├── images/          ← sprites, backgrounds, UI
│   ├── audio/           ← sfx, music
│   └── fonts/           ← bitmap fonts
├── capacitor.config.json
├── package.json
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
// In Game.js update():
const difficulty = Math.floor(this.score / 10); // increases every 10 points
const speed = Phaser.Math.Clamp(200 + difficulty * 15, 200, 600);
const spawnRate = Phaser.Math.Clamp(1500 - difficulty * 50, 400, 1500);
```

### Score + Combo System
```js
// Multiplier that resets on damage/death
this.combo = 0;
this.multiplier = 1;

addScore(base) {
  this.combo++;
  this.multiplier = Math.min(Math.floor(this.combo / 5) + 1, 8);
  this.score += base * this.multiplier;
  if (this.combo % 5 === 0) this.showComboFeedback();
}
```

Read `references/boilerplate-code.md` for full scene templates per archetype.

---

## Step 4: Asset Generation

Read `assets-prompts/image-prompts.md` for ready-to-use Midjourney + DALL-E prompts by game type.

### Minimum asset list per game
| Asset | Size | Format |
|---|---|---|
| Player sprite (idle + 2 frames) | 64×64 or 128×128 | PNG transparent |
| Background (tileable or scrolling) | 1080×1920 | JPG |
| Obstacle/enemy sprites | 64×64 | PNG transparent |
| Coin/collectible | 32×32 | PNG transparent |
| UI buttons (play, restart) | 200×80 | PNG |
| App icon | 1024×1024 | PNG |
| Splash screen | 2732×2732 | PNG |

### Sprite sheet creation
After generating individual frames, combine with TexturePacker (free tier works) or:
```bash
npx free-tex-packer-core --input ./raw-sprites --output ./assets/images --name spritesheet
```

---

## Step 5: Juice (Polish That Makes Games Feel Amazing)

```js
// Screen shake on hit/death
this.cameras.main.shake(200, 0.01);

// Flash player red on damage
this.tweens.add({ targets: player, alpha: 0, yoyo: true, repeat: 3, duration: 80 });

// Particle burst on coin collect
this.particles.emitParticleAt(x, y, 10);

// Score pop animation
this.tweens.add({ targets: scoreText, scaleX: 1.4, scaleY: 1.4, yoyo: true, duration: 100 });

// Haptic feedback (via Capacitor)
import { Haptics, ImpactStyle } from '@capacitor/haptics';
await Haptics.impact({ style: ImpactStyle.Medium }); // on score, death, etc.
```

---

## Step 6: Monetization

### AdMob Setup
```bash
npm install @capacitor-community/admob
npx cap sync
```

### Ad placements (don't annoy players)
- **Interstitial**: Show on game over ONLY every 3rd death
- **Rewarded**: "Watch ad to continue" or "Watch ad for x2 score"
- **Banner**: Optional bottom banner on menu screen only

Read `references/monetization.md` for full AdMob init code + iOS/Android config.

---

## Step 7: Package for App Stores

### Build web assets
```bash
npm run build
npx cap sync
```

### iOS (requires Mac + Xcode)
```bash
npx cap open ios
# In Xcode: Product → Archive → Distribute App → App Store Connect
```

### Android
```bash
npx cap open android
# In Android Studio: Build → Generate Signed Bundle → Upload to Play Console
```

### Required assets for submission
| Asset | iOS | Android |
|---|---|---|
| App Icon | 1024×1024 PNG | 512×512 PNG |
| Screenshots | 6.7" + 6.5" + 5.5" sizes | Phone + 7" tablet |
| Feature Graphic | — | 1024×500 PNG |
| Privacy Policy URL | Required | Required |

Read `references/app-store-submission.md` for full checklist + template privacy policy URL.

---

## Game Prompt Templates (for AI coding sessions)

Use these exact prompts when starting a new AI coding session:

### Tap Runner (Flappy Bird clone)
```
Build a Phaser 3 mobile game using this structure:
- Boot scene loads assets
- Menu scene shows title + high score + tap to start
- Game scene: player character auto-falls with gravity (800), tap/click applies upward velocity (-350). Pipes/obstacles scroll left at increasing speed. Score increments each obstacle passed. Death on any collision or going off screen.
- GameOver scene shows score, high score, restart button
- LocalStorage saves high score
- Mobile-first: 390×844 canvas, input on both touch and mouse
- Use placeholder colored rectangles for all sprites (I'll replace with real assets)
- Add screen shake on death, score pop animation on point scored
```

### Endless Runner
```
Build a Phaser 3 mobile game - endless side-scrolling runner:
- Parallax background with 2 layers scrolling at different speeds
- Player auto-runs right, can jump (single tap) and slide (swipe down)
- Ground scrolls with obstacles (rocks, gaps) spawning on timer
- Collectible coins with +10 score
- Speed increases every 500 points
- Score counter top-right, high score below it
- Death → brief death animation → GameOver scene with score + restart
- Touch input: tap anywhere = jump, swipe down = slide
```

### Arcade Shooter
```
Build a Phaser 3 mobile game - vertical arcade shooter:
- Player ship at bottom, moves left/right with touch drag
- Auto-fires bullets upward every 300ms
- Enemy waves spawn from top in formation patterns, move down + side to side
- Enemy types: basic (1 hit), armored (3 hits, flashes), boss every 5 waves (20 hits, fires back)
- Explosions on enemy death (particle effect)
- Score: 10/30/100 per enemy type, ×2 for kill chains
- Lives: 3 (show heart icons top-left)
- PowerUps drop randomly: spread shot, shield, speed boost (10 sec each)
- High score saved to localStorage
```

---

## Fast Theming System

Change a game's entire look by swapping 4 things:
1. **Background image** — sets the world (space, jungle, city, ocean)
2. **Player sprite** — character identity (bird, ninja, spaceship, car)
3. **Obstacle sprite** — world-consistent hazards
4. **Color palette** — UI tint: `this.cameras.main.setBackgroundColor('#1a1a2e')`

Same codebase → 10 different games with different themes.

---

## Quality Checklist Before Submission

- [ ] Game runs at 60fps on mid-tier Android (Pixel 4a level)
- [ ] No crash on minimize + return to app
- [ ] Portrait mode locked (no rotation)
- [ ] Status bar hidden
- [ ] Mute button works
- [ ] High score persists between sessions
- [ ] Restart is instant (<1 second)
- [ ] Privacy policy URL live and accessible
- [ ] All required screenshots captured
- [ ] App tested on real device (not just simulator)
