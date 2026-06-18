import { W, H } from '../main.js';
import { fitText } from '../ui/fitScroll.js';
import { getItem, setItem } from '../storage.js';

const STORAGE_BEST  = 'plunge_best';
const STORAGE_COINS = 'plunge_coins';

// Moody neon palette — matches Menu and Game scenes
const NEON = { cyan: 0x0088bb, pink: 0xcc0077, green: 0x5a8800, gold: 0xddaa00, purple: 0x6611aa };
const NC   = { cyan: '#0088bb', pink: '#cc0077', green: '#5a8800', gold: '#ddaa00', purple: '#6611aa' };

const TIPS = [
  'Gaps alternate sides — stay centered and react early.',
  'Short taps give finer control than holding the button.',
  'Your pressure bar heals slowly when you stop hitting walls.',
  'Shells grant brief invincibility — use them to push through tight spots.',
  'The deeper you go, the faster walls move. Small corrections beat big swings.',
  'Coins spawn in clusters — stay on the same side of the screen to collect them.',
  'Your diver leans toward your direction of movement. Use the tilt to predict your path.',
  'Each biome shifts wall speed and gap width — adjust your rhythm as you descend.',
  'Collected a shell? Dive straight through a cluster and don\'t waste the invincibility.',
  'Lives carry over between runs. Spend them wisely.',
  'The gap center drifts left and right — watch the walls, not the diver.',
  'Pressure recovers the moment you stop hitting walls. Even a second of clean diving helps.',
];

export default class GameOver extends Phaser.Scene {
  constructor() { super('GameOver'); }

  init(data) {
    this.finalDepth    = data.depth         || 0;
    this.biomeName     = data.biome         || 'Coral Reef';
    this.spriteAliveKey = data.spriteAliveKey || 'fishAlive';
  }

  create() {
    // ── BACKGROUND ────────────────────────────────────────────────────────────
    this.cameras.main.setBackgroundColor('#000000');
    this.add.tileSprite(W / 2, H / 2, W, H, 'grid').setAlpha(0.12).setTint(0x220044);

    // Rising bubbles
    for (let i = 0; i < 16; i++) {
      const bub = this.add.image(
        Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 'bubble'
      ).setAlpha(Phaser.Math.FloatBetween(0.06, 0.22))
       .setScale(Phaser.Math.FloatBetween(0.4, 2.0));
      this.tweens.add({
        targets: bub, y: bub.y - H - 60,
        duration: Phaser.Math.Between(5000, 12000), repeat: -1,
      });
    }

    // Flickering sparkle stars
    const palette = [NEON.cyan, NEON.pink, NEON.green, NEON.gold, NEON.purple, 0x445566];
    for (let i = 0; i < 10; i++) {
      const s = this.add.image(
        Phaser.Math.Between(15, W - 15), Phaser.Math.Between(10, H - 10), 'star'
      ).setAlpha(Phaser.Math.FloatBetween(0.15, 0.50))
       .setScale(Phaser.Math.FloatBetween(0.5, 1.6))
       .setTint(Phaser.Utils.Array.GetRandom(palette));
      const schedFlicker = () => {
        this.time.delayedCall(Phaser.Math.Between(800, 2500), () => {
          this.tweens.add({
            targets: s, alpha: Phaser.Math.FloatBetween(0.02, 0.08),
            yoyo: true, duration: Phaser.Math.Between(100, 320),
            onComplete: schedFlicker,
          });
        });
      };
      schedFlicker();
    }

    // Ghost diver drifting upward
    const ghost = this.add.image(
      Phaser.Math.Between(80, W - 80), H * 0.75, this.spriteAliveKey
    ).setAlpha(0.06).setScale(1.1)
     .setBlendMode(Phaser.BlendModes.ADD)
     .setAngle(Phaser.Math.Between(-8, 8));
    this.tweens.add({ targets: ghost, y: -80, duration: 8000, ease: 'Sine.In' });

    // Corner star bursts
    this._drawStarBurst(18,     28,      14, NEON.cyan,   0.60);
    this._drawStarBurst(W - 18, 28,      14, NEON.pink,   0.60);
    this._drawStarBurst(22,     H * 0.6, 10, NEON.green,  0.45);

    // ── SCORE DATA ────────────────────────────────────────────────────────────
    const prev  = parseInt(getItem(STORAGE_BEST) || '0', 10);
    const isNew = this.finalDepth > prev;
    if (isNew) setItem(STORAGE_BEST, this.finalDepth);
    const best = isNew ? this.finalDepth : prev;

    // ── HEADING ───────────────────────────────────────────────────────────────
    const headColor = isNew ? NC.gold : NC.pink;
    const headLabel = isNew ? 'NEW RECORD!' : 'SURFACED';
    const headSize  = isNew ? '48px' : '40px';
    const head = this.add.text(W / 2, H * 0.16, headLabel, {
      fontSize: headSize, fontFamily: 'Arial Black',
      color: headColor, stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5);

    if (isNew) {
      this.tweens.add({
        targets: head, scaleX: 1.08, scaleY: 1.08,
        yoyo: true, repeat: -1, duration: 620, ease: 'Sine.InOut',
      });
    }

    // Thin horizontal rule
    this.add.rectangle(W / 2, H * 0.215, W * 0.72, 1, isNew ? NEON.gold : NEON.pink, 0.25);

    // ── DEPTH ─────────────────────────────────────────────────────────────────
    fitText(this.add.text(W / 2, H * 0.285, `${this.finalDepth}m`, {
      fontSize: '78px', fontFamily: 'Arial Black',
      color: '#cccccc', stroke: NC.cyan, strokeThickness: 4,
    }).setOrigin(0.5), W * 0.86);

    this.add.text(W / 2, H * 0.395, 'DEPTH REACHED', {
      fontSize: '13px', fontFamily: 'Arial Black',
      color: NC.cyan, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);

    // ── BIOME + BEST ──────────────────────────────────────────────────────────
    // Wobbly circle behind stats block
    this._drawWobblyCircle(W / 2, H * 0.505, 68);

    fitText(this.add.text(W / 2, H * 0.465, `▼  ${this.biomeName.toUpperCase()}  ▼`, {
      fontSize: '14px', fontFamily: 'Arial Black',
      color: NC.green, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5), W * 0.86);

    this.add.text(W / 2, H * 0.515, 'BEST', {
      fontSize: '13px', fontFamily: 'Arial Black',
      color: isNew ? NC.gold : '#334455', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);

    fitText(this.add.text(W / 2, H * 0.555, `${best}m`, {
      fontSize: '36px', fontFamily: 'Arial Black',
      color: isNew ? NC.gold : '#5a6a7a', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5), W * 0.7);

    // ── TIP ───────────────────────────────────────────────────────────────────
    this.add.rectangle(W / 2, H * 0.605, W * 0.72, 1, NEON.cyan, 0.15);
    this.add.text(W / 2, H * 0.625, 'TIP', {
      fontSize: '10px', fontFamily: 'Arial Black',
      color: NC.cyan, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.657, Phaser.Utils.Array.GetRandom(TIPS), {
      fontSize: '13px', fontFamily: 'Arial',
      color: '#556677', stroke: '#000', strokeThickness: 1,
      wordWrap: { width: W * 0.78 }, align: 'center',
    }).setOrigin(0.5);

    // ── BUTTONS ───────────────────────────────────────────────────────────────
    this._makeBtn(W / 2, H * 0.700, 'DIVE AGAIN', 260, 64, 0x001122, 0x0099cc, 28, () => {
      this.cache.audio.has('buttonSFX') && this.sound.play('buttonSFX', { volume: 0.7 });
      this.cameras.main.fadeOut(250);
      this.time.delayedCall(250, () => this.scene.start('Game'));
    });

    const menu = this.add.text(W / 2, H * 0.820, '← Main Menu', {
      fontSize: '20px', fontFamily: 'Arial', color: '#2a3a44',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    menu.on('pointerover', () => menu.setColor('#6688aa'));
    menu.on('pointerout',  () => menu.setColor('#2a3a44'));
    menu.on('pointerdown', () => {
      this.cache.audio.has('buttonSFX') && this.sound.play('buttonSFX', { volume: 0.7 });
      this.cameras.main.fadeOut(250);
      this.time.delayedCall(250, () => this.scene.start('Menu', { skipAbyss: true }));
    });

    // Coin tally reminder
    const coins = parseInt(getItem(STORAGE_COINS) || '0', 10);
    this.add.text(W / 2, H * 0.910, `⬡ ${coins} coins remaining`, {
      fontSize: '14px', fontFamily: 'Arial', color: '#44350a',
    }).setOrigin(0.5);

    this.cameras.main.fadeIn(400);
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────

  _makeBtn(x, y, label, w, h, fillColor, strokeColor, fontSize, callback) {
    const colorHex = '#' + strokeColor.toString(16).padStart(6, '0');
    const btn = this.add.rectangle(x, y, w, h, fillColor)
      .setStrokeStyle(1.5, strokeColor, 0.75)
      .setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, {
      fontSize: `${fontSize}px`, fontFamily: 'Arial Black',
      color: colorHex, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);
    btn.on('pointerover',  () => btn.setStrokeStyle(2.5, strokeColor, 1.0));
    btn.on('pointerout',   () => btn.setStrokeStyle(1.5, strokeColor, 0.75));
    btn.on('pointerdown',  callback);
    return btn;
  }

  _drawStarBurst(x, y, size, color, alpha) {
    const g = this.add.graphics().setAlpha(alpha);
    g.lineStyle(2, color, 1);
    g.beginPath(); g.moveTo(x, y - size); g.lineTo(x, y + size); g.strokePath();
    g.beginPath(); g.moveTo(x - size, y); g.lineTo(x + size, y); g.strokePath();
    const d = size * 0.6;
    g.lineStyle(1.1, color, 0.5);
    g.beginPath(); g.moveTo(x - d, y - d); g.lineTo(x + d, y + d); g.strokePath();
    g.beginPath(); g.moveTo(x + d, y - d); g.lineTo(x - d, y + d); g.strokePath();
    const schedFlicker = () => {
      this.time.delayedCall(Phaser.Math.Between(900, 2400), () => {
        this.tweens.add({
          targets: g, alpha: 0.06, yoyo: true,
          duration: Phaser.Math.Between(120, 280),
          onComplete: schedFlicker,
        });
      });
    };
    schedFlicker();
  }

  _drawWobblyCircle(cx, cy, r) {
    const g = this.add.graphics();
    g.lineStyle(1.5, NEON.cyan, 0.22);
    g.beginPath();
    const steps = 44;
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const wobR  = r + (Math.random() - 0.5) * r * 0.14;
      const px = cx + Math.cos(angle) * wobR;
      const py = cy + Math.sin(angle) * wobR;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.strokePath();
  }

}
