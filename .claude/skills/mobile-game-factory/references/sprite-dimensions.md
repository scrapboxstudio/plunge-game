# Sprite Dimensions & Art Pipeline Reference

---

## Required Store Assets

| Asset | Size | Format | Notes |
|---|---|---|---|
| App icon (Android) | 512×512 | PNG | No transparency, no rounded corners (Play Store rounds them) |
| App icon (iOS) | 1024×1024 | PNG | No transparency, no rounded corners (App Store rounds them) |
| Feature graphic (Android) | 1024×500 | PNG/JPG | Shows in Play Store search results — very important |
| Splash screen | 2732×2732 | PNG | Center logo on solid color — will be cropped to device |
| Phone screenshots | 320-3840px | PNG | At least 4 required for Android |

---

## In-Game Sprite Guidelines

### General Rules
- Design at **2× the target render size** — scale down in engine for crisp results on retina displays
- Author wall/obstacle sprites at **220px tall**, render at **110px** (`setDisplaySize(w, 110)`)
- Sprites that will be randomly flipped horizontally by the engine: **design to read both ways**
- Player sprite that needs to face downward: **author facing RIGHT**, rotate 90° in engine

### Phaser Scaling
```js
// Scale to fit a target width (e.g. 90% of screen width)
sprite.setDisplaySize(targetWidth, targetWidth * (sprite.height / sprite.width));

// Or set explicit display size
sprite.setDisplaySize(110, 110);

// Text: clamp to max width (critical for Android — renders fonts wider than iOS)
const maxWidth = this.scale.width * 0.85;
txt.setScale(Math.min(1.0, maxWidth / txt.width));
```

---

## ADD Blend Mode — Neon Art Style

ADD blend mode: **pure black (#000000) = completely invisible**. This is the key to the neon-on-black style.

### How It Works
- Design sprites on a **pure black canvas** with neon/bright art on top
- At runtime, black pixels disappear, bright pixels glow/add to what's behind
- No alpha/transparency channel needed — saves file size, simpler AI generation

### AI Prompt Formula
```
[subject] neon glowing art style, pure black background, bright [colors], 
no transparency needed, game sprite, high contrast
```

### Engine Setup
```js
sprite.setBlendMode(Phaser.BlendModes.ADD);
// OR in group:
this.obstacles = this.add.group({ blendMode: Phaser.BlendModes.ADD });
```

### Tinting Neon Sprites
For color cosmetics, desaturate first then apply color (prevents muddy look):
```js
// Direct tint on multicolored art = muddy
sprite.setTint(0xff0000);  // ❌ mixes red into all existing colors

// Desaturate first, then tint = clean
sprite.setTint(0x888888);  // step 1: desaturate
sprite.setTint(0xff0000);  // step 2: apply color cleanly ✅
```

---

## Sprite Sheet Creation

### Manual (TexturePacker free tier)
```bash
npx free-tex-packer-core --input ./raw-sprites --output ./assets/images --name spritesheet
```

### Animation Frame Naming Convention
```
player_idle_0.png
player_idle_1.png
player_run_0.png
player_run_1.png
player_run_2.png
player_run_3.png
player_death_0.png
```

### Loading Sprite Sheets in Phaser
```js
// In Boot.js preload():
this.load.spritesheet('player', 'assets/images/player_sheet.png', {
  frameWidth: 64,
  frameHeight: 64
});

// In Game.js create():
this.anims.create({
  key: 'run',
  frames: this.anims.generateFrameNumbers('player', { start: 0, end: 3 }),
  frameRate: 12,
  repeat: -1
});
this.player.play('run');
```

---

## Minimum Asset List Per Game

```
□ Player sprite (idle / default)
□ Player sprite (action: jump/flap/attack)
□ Player sprite (death/hit)
□ Background layer 1 (far)
□ Background layer 2 (near / parallax, optional)
□ Obstacle/enemy sprite
□ Collectible (coin/star/gem)
□ UI: Play button
□ UI: Restart button
□ UI: Heart/life icon
□ App icon (512×512 Android + 1024×1024 iOS)
□ Feature graphic (1024×500)
□ Splash screen (2732×2732)
□ SFX: jump
□ SFX: die/death
□ SFX: score/collect
□ BGM: main loop (seamless)
```

---

## Audio Asset Sources (Free)

| Source | What to get |
|---|---|
| freesound.org | Jump, coin, explosion SFX |
| opengameart.org | Chiptune BGM, full SFX packs |
| pixabay.com/music | Background music, loops |
| zapsplat.com | Professional SFX library |
| jsfxr.com | Generate 8-bit SFX in browser (free, no download) |

### jsfxr Quick Recipes
- Jump: Preset "Jump" → pitch up slightly
- Coin: Preset "Pickup/Coin" → works great as-is
- Explosion: Preset "Explosion" → reduce duration to 0.4s
- Laser: Preset "Laser/Shoot" → increase frequency sweep
