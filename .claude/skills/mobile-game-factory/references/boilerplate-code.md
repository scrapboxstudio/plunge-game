# Boilerplate Code Reference

---

## ⚠️ Data Persistence — Use @capacitor/preferences, NOT localStorage

`localStorage` is unreliable inside a Capacitor WebView. The OS can clear it and it doesn't survive all app states. Symptoms: coins/high scores randomly reset between sessions.

**Fix:** Use `@capacitor/preferences` for anything that must persist.

```js
import { Preferences } from '@capacitor/preferences';

// Save
await Preferences.set({ key: 'coins', value: String(coins) });
await Preferences.set({ key: 'highScore', value: String(score) });

// Load
const { value } = await Preferences.get({ key: 'coins' });
const coins = value ? parseInt(value) : 0;

// Remove
await Preferences.remove({ key: 'coins' });
```

**Note:** Preferences is async — wrap reads/writes accordingly. Plan for this from the START; retrofitting later means touching every save/load call.

---

## StorageManager.js — Drop-in Persistence Wrapper

```js
import { Preferences } from '@capacitor/preferences';

export default class StorageManager {
  static async getHighScore() {
    const { value } = await Preferences.get({ key: 'highScore' });
    return value ? parseInt(value) : 0;
  }

  static async saveHighScore(score) {
    const current = await StorageManager.getHighScore();
    if (score > current) {
      await Preferences.set({ key: 'highScore', value: String(score) });
      return true; // new high score!
    }
    return false;
  }

  static async getCoins() {
    const { value } = await Preferences.get({ key: 'coins' });
    return value ? parseInt(value) : 0;
  }

  static async addCoins(amount) {
    const current = await StorageManager.getCoins();
    await Preferences.set({ key: 'coins', value: String(current + amount) });
    return current + amount;
  }

  static async spendCoins(amount) {
    const current = await StorageManager.getCoins();
    if (current < amount) return false;
    await Preferences.set({ key: 'coins', value: String(current - amount) });
    return true;
  }

  static async getLives() {
    const { value } = await Preferences.get({ key: 'lives' });
    return value ? parseInt(value) : 0;
  }

  static async addLife() {
    const current = await StorageManager.getLives();
    await Preferences.set({ key: 'lives', value: String(current + 1) });
  }

  static async getOwned(itemId) {
    const { value } = await Preferences.get({ key: `owned_${itemId}` });
    return value === 'true';
  }

  static async setOwned(itemId) {
    await Preferences.set({ key: `owned_${itemId}`, value: 'true' });
  }
}
```

---

## main.js — Phaser Config

```js
import Phaser from 'phaser';
import Boot from './scenes/Boot.js';
import Menu from './scenes/Menu.js';
import Game from './scenes/Game.js';
import GameOver from './scenes/GameOver.js';

const config = {
  type: Phaser.AUTO,
  width: 390,
  height: 844,
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'game-container',
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 800 }, debug: false }
  },
  scene: [Boot, Menu, Game, GameOver]
};

new Phaser.Game(config);
```

---

## index.html — Required Meta Tags

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>My Game</title>
</head>
<body>
  <div id="game-container"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

---

## Boot.js — Asset Loader

```js
export default class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const bar = this.add.graphics();
    this.load.on('progress', v => {
      bar.clear();
      bar.fillStyle(0xffffff);
      bar.fillRect(0, this.scale.height / 2 - 15, this.scale.width * v, 30);
    });

    this.load.image('bg', 'assets/images/bg.jpg');
    this.load.image('player', 'assets/images/player.png');
    this.load.image('obstacle', 'assets/images/obstacle.png');
    this.load.image('coin', 'assets/images/coin.png');
    this.load.audio('jump', 'assets/audio/jump.mp3');
    this.load.audio('die', 'assets/audio/die.mp3');
    this.load.audio('score', 'assets/audio/score.mp3');
    this.load.audio('bgm', 'assets/audio/bgm.mp3');
  }

  create() { this.scene.start('Menu'); }
}
```

---

## Menu.js — Main Menu

```js
import StorageManager from '../utils/StorageManager.js';

export default class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  async create() {
    const { width, height } = this.scale;
    const highScore = await StorageManager.getHighScore();

    this.add.image(width / 2, height / 2, 'bg').setDisplaySize(width, height);

    // Title — scale to fit (Android renders fonts wider than iOS)
    const title = this.add.text(width / 2, height * 0.3, 'GAME TITLE', {
      fontSize: '52px', fontFamily: 'Arial Black',
      color: '#ffffff', stroke: '#000000', strokeThickness: 6
    }).setOrigin(0.5);
    title.setScale(Math.min(1.0, (width * 0.9) / title.width));

    this.add.text(width / 2, height * 0.45, `Best: ${highScore}`, {
      fontSize: '28px', color: '#ffd700'
    }).setOrigin(0.5);

    const tap = this.add.text(width / 2, height * 0.7, 'TAP TO START', {
      fontSize: '32px', color: '#ffffff'
    }).setOrigin(0.5);
    this.tweens.add({ targets: tap, alpha: 0.2, yoyo: true, repeat: -1, duration: 700 });

    // Use pointerdown — pointerover/pointerout NEVER fire on touchscreens
    this.input.once('pointerdown', () => this.scene.start('Game'));
  }
}
```

---

## GameOver.js

```js
import StorageManager from '../utils/StorageManager.js';

export default class GameOver extends Phaser.Scene {
  constructor() { super('GameOver'); }

  init(data) { this.finalScore = data.score || 0; }

  async create() {
    const { width, height } = this.scale;
    const isNewBest = await StorageManager.saveHighScore(this.finalScore);

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);

    this.add.text(width / 2, height * 0.3, isNewBest ? 'NEW BEST! 🎉' : 'GAME OVER', {
      fontSize: '44px', fontFamily: 'Arial Black',
      color: isNewBest ? '#ffd700' : '#ff4444'
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.45, `Score: ${this.finalScore}`, {
      fontSize: '36px', color: '#ffffff'
    }).setOrigin(0.5);

    const highScore = await StorageManager.getHighScore();
    this.add.text(width / 2, height * 0.55, `Best: ${highScore}`, {
      fontSize: '24px', color: '#aaaaaa'
    }).setOrigin(0.5);

    // Use pointerdown only
    const btn = this.add.rectangle(width / 2, height * 0.72, 220, 70, 0x4CAF50).setInteractive();
    this.add.text(width / 2, height * 0.72, 'PLAY AGAIN', {
      fontSize: '28px', color: '#ffffff', fontFamily: 'Arial Black'
    }).setOrigin(0.5);

    btn.on('pointerdown', () => {
      this.cameras.main.fadeOut(200);
      this.time.delayedCall(200, () => this.scene.start('Game'));
    });

    this.cameras.main.fadeIn(300);
  }
}
```

---

## Game.js — Tap Runner (Flappy Bird style)

```js
import StorageManager from '../utils/StorageManager.js';

export default class Game extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    const { width, height } = this.scale;
    this.score = 0;
    this._dead = false;      // gate flag — prevents double-fire on die()
    this.pipeSpeed = 200;

    this.bg = this.add.tileSprite(width / 2, height / 2, width, height, 'bg');

    this.player = this.physics.add.sprite(width * 0.25, height / 2, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.body.setGravityY(600);

    this.pipes = this.physics.add.group();

    this.scoreTxt = this.add.text(width / 2, 60, '0', {
      fontSize: '56px', fontFamily: 'Arial Black', color: '#ffffff',
      stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5);

    this.physics.add.collider(this.player, this.pipes, () => this.die());

    // pointerdown only — pointerover never fires on touchscreens
    this.input.on('pointerdown', () => this.flap());

    this.pipeTimer = this.time.addEvent({
      delay: 1400, callback: this.spawnPipe, callbackScope: this, loop: true
    });

    this.cameras.main.fadeIn(300);
  }

  flap() {
    if (this._dead) return;
    this.player.setVelocityY(-380);
    this.jumpSFX?.play();   // null-check: safe on scene restart
    this.tweens.add({ targets: this.player, angle: -20, duration: 150, yoyo: true });
  }

  spawnPipe() {
    const { width, height } = this.scale;
    const gap = 220;
    const gapY = Phaser.Math.Between(150, height - 150);

    const topPipe = this.pipes.create(width + 50, gapY - gap / 2, 'obstacle');
    const botPipe = this.pipes.create(width + 50, gapY + gap / 2, 'obstacle');

    [topPipe, botPipe].forEach(p => {
      p.setVelocityX(-this.pipeSpeed);
      p.setImmovable(true);
      p.body.allowGravity = false;
    });
    topPipe.isTop = true;
  }

  update() {
    if (this._dead) return;
    this.bg.tilePositionX += 1;
    this.player.angle = Phaser.Math.Clamp(this.player.body.velocity.y * 0.06, -25, 70);

    this.pipes.getChildren().forEach(pipe => {
      if (pipe.isTop && !pipe.scored && pipe.x < this.player.x) {
        pipe.scored = true;
        this.addScore();
      }
      if (pipe.x < -100) pipe.destroy();
    });

    if (this.player.y <= 0 || this.player.y >= this.scale.height) this.die();
  }

  addScore() {
    this.score++;
    this.scoreTxt.setText(this.score);
    this.scoreSFX?.play();
    this.tweens.add({ targets: this.scoreTxt, scaleX: 1.3, scaleY: 1.3, yoyo: true, duration: 100 });
  }

  die() {
    if (this._dead) return;   // gate: prevent double-fire
    this._dead = true;
    this.dieSFX?.play();
    this.cameras.main.shake(250, 0.015);
    this.physics.pause();
    this.tweens.add({ targets: this.player, alpha: 0, duration: 600,
      onComplete: () => this.scene.start('GameOver', { score: this.score })
    });
  }
}
```

---

## Mobile-Specific Gotchas (Checklist)

### Input
- `pointerover` / `pointerout` **never fire on touchscreens** — use `pointerdown` / `pointerup` only
- Hover-based button highlights appear invisible/dead on mobile

### Text & Fonts
- Android renders fonts **wider** than iOS — text that fits on iPhone overflows on Android
- Always scale: `txt.setScale(Math.min(1.0, maxWidth / txt.width))`

### Audio
- Null-check audio before playing to avoid crashes on scene restart:
  ```js
  this.hitSFX?.play();
  ```

### State Management
- Gate one-time actions with a flag to prevent double-fire (double-revive, double-die):
  ```js
  if (this._reviving) return;
  this._reviving = true;
  ```

### Physics Resume
- After an ad or pause, always resume ALL three: `this.physics.resume()`, clear overlay, restart timers
- Missing any one leaves you in a partial-frozen state

### Portrait Lock + Notch
In `android/app/src/main/AndroidManifest.xml`:
```xml
android:screenOrientation="portrait"
```
In `android/app/src/main/res/values/styles.xml`:
```xml
<item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
```

---

## Game.js — Endless Runner

```js
export default class GameRunner extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    const { width, height } = this.scale;
    this.score = 0;
    this.speed = 300;
    this._dead = false;

    this.bg1 = this.add.tileSprite(width/2, height/2, width, height, 'bg').setDepth(0);
    this.bg2 = this.add.tileSprite(width/2, height/2, width, height, 'bg2').setDepth(1).setAlpha(0.6);

    this.ground = this.physics.add.staticGroup();
    this.ground.create(width/2, height - 30, 'ground').setDisplaySize(width, 60).refreshBody();

    this.player = this.physics.add.sprite(100, height - 100, 'player').setDepth(2);
    this.physics.add.collider(this.player, this.ground);

    this.obstacles = this.physics.add.group();
    this.physics.add.overlap(this.player, this.obstacles, () => this.die());

    this.coins = this.physics.add.group();
    this.physics.add.overlap(this.player, this.coins, (_, coin) => this.collectCoin(coin));

    this.time.addEvent({ delay: 1800, callback: this.spawnObstacle, callbackScope: this, loop: true });
    this.time.addEvent({ delay: 900, callback: this.spawnCoin, callbackScope: this, loop: true });
    this.time.addEvent({ delay: 100, callback: () => {
      this.score++;
      this.speed = Math.min(300 + this.score * 0.5, 600);
    }, loop: true });

    // Swipe detection — pointerdown/pointerup only
    this.input.on('pointerdown', p => { this.dragStart = p.y; });
    this.input.on('pointerup', p => {
      const dy = this.dragStart - p.y;
      if (dy > 40) this.jump();
      else if (dy < -40) this.slide();
      else this.jump();
    });

    this.scoreTxt = this.add.text(20, 20, 'Score: 0', {
      fontSize: '28px', color: '#fff'
    }).setDepth(10);
  }

  jump() {
    if (this._dead || !this.player.body.touching.down) return;
    this.player.setVelocityY(-600);
    this.jumpSFX?.play();
  }

  die() {
    if (this._dead) return;
    this._dead = true;
    this.dieSFX?.play();
    this.cameras.main.shake(300, 0.012);
    this.time.delayedCall(800, () => this.scene.start('GameOver', { score: this.score }));
  }

  collectCoin(coin) {
    coin.destroy();
    this.score += 10;
    this.scoreSFX?.play();
  }

  update() {
    if (this._dead) return;
    this.bg1.tilePositionX += 1;
    this.bg2.tilePositionX += 2;
    this.scoreTxt.setText('Score: ' + this.score);
    [...this.obstacles.getChildren(), ...this.coins.getChildren()]
      .forEach(obj => { if (obj.x < -100) obj.destroy(); });
  }
}
```
