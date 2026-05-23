# Boilerplate Code Reference

## main.js — Phaser Config (use for every game)

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

## Boot.js — Asset Loader

```js
export default class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    // Progress bar
    const bar = this.add.graphics();
    this.load.on('progress', v => {
      bar.clear();
      bar.fillStyle(0xffffff);
      bar.fillRect(0, this.scale.height / 2 - 15, this.scale.width * v, 30);
    });

    // Load your assets here:
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
export default class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    const { width, height } = this.scale;
    const highScore = localStorage.getItem('highScore') || 0;

    this.add.image(width / 2, height / 2, 'bg').setDisplaySize(width, height);

    this.add.text(width / 2, height * 0.3, 'GAME TITLE', {
      fontSize: '52px', fontFamily: 'Arial Black',
      color: '#ffffff', stroke: '#000000', strokeThickness: 6
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.45, `Best: ${highScore}`, {
      fontSize: '28px', color: '#ffd700'
    }).setOrigin(0.5);

    // Pulsing start prompt
    const tap = this.add.text(width / 2, height * 0.7, 'TAP TO START', {
      fontSize: '32px', color: '#ffffff'
    }).setOrigin(0.5);
    this.tweens.add({ targets: tap, alpha: 0.2, yoyo: true, repeat: -1, duration: 700 });

    this.input.once('pointerdown', () => this.scene.start('Game'));
  }
}
```

---

## ScoreManager.js

```js
export default class ScoreManager {
  static getHighScore() {
    return parseInt(localStorage.getItem('highScore') || '0');
  }

  static saveHighScore(score) {
    const current = ScoreManager.getHighScore();
    if (score > current) {
      localStorage.setItem('highScore', score.toString());
      return true; // new high score!
    }
    return false;
  }
}
```

---

## GameOver.js

```js
import ScoreManager from '../utils/ScoreManager.js';

export default class GameOver extends Phaser.Scene {
  constructor() { super('GameOver'); }

  init(data) { this.finalScore = data.score || 0; }

  create() {
    const { width, height } = this.scale;
    const isNewBest = ScoreManager.saveHighScore(this.finalScore);

    // Dim overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);

    this.add.text(width / 2, height * 0.3, isNewBest ? 'NEW BEST! 🎉' : 'GAME OVER', {
      fontSize: '44px', fontFamily: 'Arial Black', color: isNewBest ? '#ffd700' : '#ff4444'
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.45, `Score: ${this.finalScore}`, {
      fontSize: '36px', color: '#ffffff'
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.55, `Best: ${ScoreManager.getHighScore()}`, {
      fontSize: '24px', color: '#aaaaaa'
    }).setOrigin(0.5);

    // Restart button
    const btn = this.add.rectangle(width / 2, height * 0.72, 220, 70, 0x4CAF50, 1).setInteractive();
    this.add.text(width / 2, height * 0.72, 'PLAY AGAIN', {
      fontSize: '28px', color: '#ffffff', fontFamily: 'Arial Black'
    }).setOrigin(0.5);

    btn.on('pointerdown', () => {
      this.cameras.main.fadeOut(200);
      this.time.delayedCall(200, () => this.scene.start('Game'));
    });

    // Bounce in animation
    this.cameras.main.fadeIn(300);
  }
}
```

---

## Game.js — Tap Runner (Flappy Bird style)

```js
import ScoreManager from '../utils/ScoreManager.js';

export default class Game extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    const { width, height } = this.scale;
    this.score = 0;
    this.gameOver = false;
    this.pipeSpeed = 200;
    this.pipeInterval = 1400;

    // Background (scrolling)
    this.bg = this.add.tileSprite(width / 2, height / 2, width, height, 'bg');

    // Player
    this.player = this.physics.add.sprite(width * 0.25, height / 2, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.body.setGravityY(600);

    // Pipe group
    this.pipes = this.physics.add.group();

    // Score UI
    this.scoreTxt = this.add.text(width / 2, 60, '0', {
      fontSize: '56px', fontFamily: 'Arial Black', color: '#ffffff', stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5);

    // Collider → game over
    this.physics.add.collider(this.player, this.pipes, () => this.die());

    // Tap/click = flap
    this.input.on('pointerdown', () => this.flap());

    // Pipe spawn timer
    this.pipeTimer = this.time.addEvent({
      delay: this.pipeInterval, callback: this.spawnPipe, callbackScope: this, loop: true
    });

    // Difficulty ramp every 10 points
    this.time.addEvent({
      delay: 10000, callback: () => {
        this.pipeSpeed = Math.min(this.pipeSpeed + 20, 400);
      }, loop: true
    });

    this.cameras.main.fadeIn(300);
  }

  flap() {
    if (this.gameOver) return;
    this.player.setVelocityY(-380);
    this.sound.play('jump', { volume: 0.5 });
    // Rotate player slightly upward
    this.tweens.add({ targets: this.player, angle: -20, duration: 150, yoyo: true });
  }

  spawnPipe() {
    const { width, height } = this.scale;
    const gap = 220; // space between pipes
    const gapY = Phaser.Math.Between(150, height - 150);

    const topPipe = this.pipes.create(width + 50, gapY - gap / 2, 'obstacle');
    const botPipe = this.pipes.create(width + 50, gapY + gap / 2, 'obstacle');

    [topPipe, botPipe].forEach(p => {
      p.setVelocityX(-this.pipeSpeed);
      p.setImmovable(true);
      p.body.allowGravity = false;
      p.scored = false;
    });
    topPipe.isTop = true; // mark for score tracking
  }

  update() {
    if (this.gameOver) return;

    // Scroll background
    this.bg.tilePositionX += 1;

    // Rotate player with velocity (feels natural)
    this.player.angle = Phaser.Math.Clamp(this.player.body.velocity.y * 0.06, -25, 70);

    // Score when pipe passes player
    this.pipes.getChildren().forEach(pipe => {
      if (pipe.isTop && !pipe.scored && pipe.x < this.player.x) {
        pipe.scored = true;
        this.addScore();
      }
      if (pipe.x < -100) pipe.destroy();
    });

    // Die if touches top or bottom
    if (this.player.y <= 0 || this.player.y >= this.scale.height) this.die();
  }

  addScore() {
    this.score++;
    this.scoreTxt.setText(this.score);
    this.sound.play('score', { volume: 0.3 });
    this.tweens.add({ targets: this.scoreTxt, scaleX: 1.3, scaleY: 1.3, yoyo: true, duration: 100 });
  }

  die() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.sound.play('die');
    this.cameras.main.shake(250, 0.015);
    this.physics.pause();
    this.tweens.add({ targets: this.player, alpha: 0, duration: 600, onComplete: () => {
      this.scene.start('GameOver', { score: this.score });
    }});
  }
}
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
    this.isSliding = false;
    this.dead = false;

    // Parallax backgrounds
    this.bg1 = this.add.tileSprite(width/2, height/2, width, height, 'bg').setDepth(0);
    this.bg2 = this.add.tileSprite(width/2, height/2, width, height, 'bg2').setDepth(1).setAlpha(0.6);

    // Ground
    this.ground = this.physics.add.staticGroup();
    this.ground.create(width/2, height - 30, 'ground').setDisplaySize(width, 60).refreshBody();

    // Player
    this.player = this.physics.add.sprite(100, height - 100, 'player');
    this.player.setDepth(2);
    this.physics.add.collider(this.player, this.ground);

    // Obstacles
    this.obstacles = this.physics.add.group();
    this.physics.add.overlap(this.player, this.obstacles, () => this.die());

    // Coins
    this.coins = this.physics.add.group();
    this.physics.add.overlap(this.player, this.coins, (_, coin) => this.collectCoin(coin));

    // Spawn timers
    this.time.addEvent({ delay: 1800, callback: this.spawnObstacle, callbackScope: this, loop: true });
    this.time.addEvent({ delay: 900, callback: this.spawnCoin, callbackScope: this, loop: true });

    // Score timer
    this.time.addEvent({ delay: 100, callback: () => {
      this.score++;
      this.speed = Math.min(300 + this.score * 0.5, 600);
    }, loop: true });

    // Swipe detection
    this.input.on('pointerdown', p => { this.dragStart = p.y; });
    this.input.on('pointerup', p => {
      const dy = this.dragStart - p.y;
      if (dy > 40) this.jump();
      else if (dy < -40) this.slide();
      else this.jump(); // tap = jump
    });

    // Score text
    this.scoreTxt = this.add.text(20, 20, 'Score: 0', { fontSize: '28px', color: '#fff' }).setDepth(10);
  }

  jump() {
    if (this.dead) return;
    if (this.player.body.touching.down) {
      this.player.setVelocityY(-600);
      this.sound.play('jump', { volume: 0.4 });
    }
  }

  slide() {
    if (this.dead || this.isSliding) return;
    this.isSliding = true;
    this.player.setScale(1, 0.5).setY(this.player.y + 20);
    this.time.delayedCall(500, () => {
      this.player.setScale(1, 1).setY(this.player.y - 20);
      this.isSliding = false;
    });
  }

  spawnObstacle() {
    const { width, height } = this.scale;
    const obs = this.obstacles.create(width + 50, height - 80, 'obstacle');
    obs.setVelocityX(-this.speed);
    obs.body.allowGravity = false;
  }

  spawnCoin() {
    const { width, height } = this.scale;
    const y = Phaser.Math.Between(height - 250, height - 100);
    const coin = this.coins.create(width + 30, y, 'coin');
    coin.setVelocityX(-this.speed);
    coin.body.allowGravity = false;
  }

  collectCoin(coin) {
    coin.destroy();
    this.score += 10;
    this.sound.play('score', { volume: 0.3 });
  }

  update() {
    if (this.dead) return;
    this.bg1.tilePositionX += 1;
    this.bg2.tilePositionX += 2;
    this.scoreTxt.setText('Score: ' + this.score);

    // Cleanup off-screen objects
    [...this.obstacles.getChildren(), ...this.coins.getChildren()]
      .forEach(obj => { if (obj.x < -100) obj.destroy(); });
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.sound.play('die');
    this.cameras.main.shake(300, 0.012);
    this.time.delayedCall(800, () => this.scene.start('GameOver', { score: this.score }));
  }
}
```
