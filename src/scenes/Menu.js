import { W, H, BIOMES } from '../main.js';

const STORAGE_BEST  = 'plunge_best';
const STORAGE_COINS = 'plunge_coins';

// Darker, moodier neon — bioluminescent deep-sea palette
const NEON = { cyan: 0x0088bb, pink: 0xcc0077, green: 0x5a8800, orange: 0xbb4400, purple: 0x6611aa };
const NC   = { cyan: '#0088bb', pink: '#cc0077', green: '#5a8800', orange: '#bb4400', purple: '#6611aa' };
const LETTER_COLORS = [NC.cyan, NC.pink, NC.green, NC.orange, NC.purple];

const PACKAGES = [
  { coins: 4,  label: '4 Coins',  price: '$0.99' },
  { coins: 10, label: '10 Coins', price: '$1.99' },
  { coins: 20, label: '20 Coins', price: '$3.99' },
];

export default class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    this.storeOpen = false;
    this.bgFish    = [];
    this.floaters  = [];

    // ── BACKGROUND ────────────────────────────────────────────────────────────
    this.cameras.main.setBackgroundColor('#000000');
    this.gridTile = this.add.tileSprite(W / 2, H / 2, W, H, 'grid')
      .setAlpha(0.12).setTint(0x220044);

    this._spawnBgFish();
    this._spawnBubbles();
    this._spawnSparkles();

    // ── CORNER STAR BURSTS ────────────────────────────────────────────────────
    this._drawStarBurst(20,      30,       15, NEON.cyan,   0.65);
    this._drawStarBurst(W - 20,  30,       15, NEON.pink,   0.65);
    this._drawStarBurst(22,      H * 0.58, 11, NEON.green,  0.50);

    // ── TITLE ─────────────────────────────────────────────────────────────────
    this.letterObjs = this._buildTitle(H * 0.215);

    // ── SUBTITLE ──────────────────────────────────────────────────────────────
    this._buildSubtitle(H * 0.300);

    // ── BEST DEPTH ────────────────────────────────────────────────────────────
    this._buildBestDepth(H * 0.500);

    // ── TAP TO DIVE ───────────────────────────────────────────────────────────
    this._buildTapButton(H * 0.700);

    // ── COIN STORE BUTTON ─────────────────────────────────────────────────────
    this._buildStoreButton(H * 0.845);

    // ── STORE OVERLAY ─────────────────────────────────────────────────────────
    this._buildStoreOverlay();

    // ── INPUT ─────────────────────────────────────────────────────────────────
    this.input.on('pointerdown', (p) => {
      if (this.storeOpen) return;
      if (p.y > H * 0.820) return; // coin store zone
      this._flashAndDive();
    });

    this.cameras.main.fadeIn(400);
  }

  // ── TITLE ──────────────────────────────────────────────────────────────────

  _buildTitle(centerY) {
    const letters = 'PLUNGE'.split('');
    const objs = letters.map((ch, i) => this.add.text(0, 0, ch, {
      fontSize: '88px', fontFamily: 'Arial Black',
      color: LETTER_COLORS[i % LETTER_COLORS.length],
      stroke: '#cccccc', strokeThickness: 5,
    }).setOrigin(0, 0.5));

    // Scale down if total width would overflow the screen
    const totalW   = objs.reduce((s, t) => s + t.width, 0);
    const fitScale = Math.min(1.0, (W - 14) / totalW);
    let curX = (W - totalW * fitScale) / 2;

    objs.forEach((t, i) => {
      t.setScale(fitScale);
      t.setPosition(curX, centerY);
      t.setAngle(Phaser.Math.Between(-8, 8));
      curX += t.width * fitScale;

      const breathAmt = Phaser.Math.FloatBetween(0.025, 0.055);
      this.tweens.add({
        targets: t,
        scaleX: fitScale * (1 + breathAmt),
        scaleY: fitScale * (1 + breathAmt),
        yoyo: true, repeat: -1,
        duration: Phaser.Math.Between(1700, 2400),
        ease: 'Sine.InOut',
        delay: i * 140,
      });
    });

    return objs;
  }

  // ── SUBTITLE ───────────────────────────────────────────────────────────────

  _buildSubtitle(y) {
    const sub = this.add.text(W / 2, y, 'HOW DEEP CAN YOU GO?', {
      fontSize: '18px', fontFamily: 'Arial', color: '#aaaaaa',
    }).setOrigin(0.5);

    const lineY = y + 14;
    const x0    = W / 2 - sub.width / 2 - 4;
    const x1    = W / 2 + sub.width / 2 + 4;
    const g = this.add.graphics();
    g.lineStyle(1.5, NEON.pink, 0.6);
    g.beginPath();
    g.moveTo(x0, lineY);
    for (let x = x0; x <= x1; x += 6) {
      g.lineTo(x, lineY + Math.sin(x * 0.22) * 2.2);
    }
    g.strokePath();
  }

  // ── BEST DEPTH ─────────────────────────────────────────────────────────────

  _buildBestDepth(centerY) {
    const best    = parseInt(localStorage.getItem(STORAGE_BEST) || '0', 10);
    const hasBest = best > 0;

    this.add.text(W / 2, centerY - 40, 'BEST DEPTH', {
      fontSize: '13px', fontFamily: 'Arial Black',
      color: NC.green, stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);

    const numTxt = this.add.text(W / 2, centerY, hasBest ? best.toString() : '---', {
      fontSize: '52px', fontFamily: 'Arial Black',
      color: hasBest ? '#cccccc' : '#2a3a44',
      stroke: hasBest ? NC.cyan : '#000',
      strokeThickness: hasBest ? 3 : 2,
    }).setOrigin(0.5);

    this.add.text(W / 2 + numTxt.width / 2 + 8, centerY + 5, 'm', {
      fontSize: '26px', fontFamily: 'Arial Black',
      color: hasBest ? NC.pink : '#2a3a44',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0, 0.5);

    this._drawWobblyCircle(W / 2, centerY, 62);
  }

  // ── TAP TO DIVE ────────────────────────────────────────────────────────────

  _buildTapButton(centerY) {
    const bx = W / 2 - 120, bw = 240, bh = 58;
    const borderG = this.add.graphics().setAlpha(0.4);
    this._drawSketchRect(borderG, bx, centerY - bh / 2, bw, bh, NEON.pink);
    this.tweens.add({ targets: borderG, alpha: 1.0, yoyo: true, repeat: -1, duration: 600 });

    this.add.text(W / 2, centerY, 'TAP TO DIVE ▼', {
      fontSize: '32px', fontFamily: 'Arial Black',
      color: NC.pink, stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(W / 2, centerY + 44, 'tap left · tap right to steer', {
      fontSize: '13px', fontFamily: 'Arial', color: '#2a3a44',
    }).setOrigin(0.5);
  }

  // ── COIN STORE BUTTON ──────────────────────────────────────────────────────

  _buildStoreButton(centerY) {
    const bw = 250, bh = 56, bx = W / 2 - bw / 2;

    // Filled background rect for the button
    const bg = this.add.rectangle(W / 2, centerY, bw, bh, 0x110800, 0.85)
      .setInteractive({ useHandCursor: true });

    // Sketchy gold border
    const borderG = this.add.graphics();
    this._drawSketchRect(borderG, bx, centerY - bh / 2, bw, bh, 0xddaa00);

    const txt = this.add.text(W / 2, centerY, '⬡  COIN STORE', {
      fontSize: '24px', fontFamily: 'Arial Black',
      color: '#ddaa00', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);

    // Subtle gold glow pulse on border
    this.tweens.add({ targets: borderG, alpha: 0.5, yoyo: true, repeat: -1, duration: 900 });

    bg.on('pointerover',  () => { bg.setFillStyle(0x221100, 0.95); txt.setColor('#ffcc00'); });
    bg.on('pointerout',   () => { bg.setFillStyle(0x110800, 0.85); txt.setColor('#ddaa00'); });
    bg.on('pointerdown',  () => this._openStore());
  }

  // ── DECORATIVE ─────────────────────────────────────────────────────────────

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
      this.time.delayedCall(Phaser.Math.Between(800, 2200), () => {
        this.tweens.add({
          targets: g, alpha: 0.06, yoyo: true,
          duration: Phaser.Math.Between(120, 300),
          onComplete: schedFlicker,
        });
      });
    };
    schedFlicker();
  }

  _drawWobblyCircle(cx, cy, r) {
    const g = this.add.graphics();
    g.lineStyle(1.5, NEON.cyan, 0.30);
    g.beginPath();
    const steps = 44;
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const wobR  = r + (Math.random() - 0.5) * r * 0.14;
      const x = cx + Math.cos(angle) * wobR;
      const y = cy + Math.sin(angle) * wobR;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    g.strokePath();
  }

  _drawSketchRect(g, x, y, w, h, color) {
    const wob = () => (Math.random() - 0.5) * 3.5;
    g.lineStyle(1.9, color, 0.95);
    g.beginPath(); g.moveTo(x + 5 + wob(), y + wob()); g.lineTo(x + w - 5 + wob(), y + wob()); g.strokePath();
    g.beginPath(); g.moveTo(x + 5 + wob(), y + h + wob()); g.lineTo(x + w - 5 + wob(), y + h + wob()); g.strokePath();
    g.beginPath(); g.moveTo(x + wob(), y + 5 + wob()); g.lineTo(x + wob(), y + h - 5 + wob()); g.strokePath();
    g.beginPath(); g.moveTo(x + w + wob(), y + 5 + wob()); g.lineTo(x + w + wob(), y + h - 5 + wob()); g.strokePath();
  }

  // ── AMBIENT OBJECTS ────────────────────────────────────────────────────────

  _spawnBgFish() {
    for (let i = 0; i < 4; i++) {
      const f = this.add.image(
        Phaser.Math.Between(30, W - 30), Phaser.Math.Between(0, H), 'diver'
      ).setAlpha(Phaser.Math.FloatBetween(0.06, 0.11))
       .setScale(Phaser.Math.FloatBetween(0.55, 1.45))
       .setBlendMode(Phaser.BlendModes.ADD)
       .setAngle(Phaser.Math.Between(-15, 15));
      f.spd = Phaser.Math.FloatBetween(7, 20);
      this.bgFish.push(f);
    }
  }

  _spawnBubbles() {
    for (let i = 0; i < 18; i++) {
      const img = this.add.image(
        Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 'bubble'
      ).setAlpha(Phaser.Math.FloatBetween(0.06, 0.28))
       .setScale(Phaser.Math.FloatBetween(0.4, 2.0));
      img.spd = Phaser.Math.FloatBetween(18, 60);
      this.floaters.push(img);
    }
  }

  _spawnSparkles() {
    const palette = [NEON.cyan, NEON.pink, NEON.green, NEON.orange, NEON.purple, 0x445566];
    for (let i = 0; i < 8; i++) {
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
  }

  // ── INTERACTION ────────────────────────────────────────────────────────────

  _flashAndDive() {
    this.input.off('pointerdown');
    this.letterObjs.forEach(t => t.setColor('#ffffff'));
    this.time.delayedCall(50, () => {
      this.letterObjs.forEach((t, i) => t.setColor(LETTER_COLORS[i % LETTER_COLORS.length]));
    });
    this.cameras.main.fadeOut(250);
    this.time.delayedCall(250, () => this.scene.start('Game'));
  }

  // ── STORE ──────────────────────────────────────────────────────────────────

  _buildStoreOverlay() {
    const depth = 10;
    const oy = H * 0.07;
    const oh = H * 0.84;

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.90)
      .setDepth(depth).setVisible(false).setInteractive();

    const panel = this.add.rectangle(W / 2, oy + oh / 2, W - 28, oh, 0x050005)
      .setStrokeStyle(1.5, NEON.purple, 0.7).setDepth(depth).setVisible(false);

    const title = this.add.text(W / 2, oy + 38, '⬡  COIN STORE', {
      fontSize: '26px', fontFamily: 'Arial Black',
      color: '#ddaa00', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(depth).setVisible(false);

    const coins = parseInt(localStorage.getItem(STORAGE_COINS) || '0', 10);
    this._coinBalTxt = this.add.text(W / 2, oy + 75, `You have  ⬡ ${coins}  coins`, {
      fontSize: '16px', fontFamily: 'Arial', color: '#889aaa',
    }).setOrigin(0.5).setDepth(depth).setVisible(false);

    const simNote = this.add.text(W / 2, oy + 100, '(simulated — free for testing)', {
      fontSize: '11px', fontFamily: 'Arial', color: '#2a3a44',
    }).setOrigin(0.5).setDepth(depth).setVisible(false);

    this._pkgObjs = [];
    PACKAGES.forEach((pkg, i) => {
      const cardY = oy + 178 + i * 140;

      const card = this.add.rectangle(W / 2, cardY, W - 68, 120, 0x0a0010)
        .setStrokeStyle(1, NEON.purple, 0.4).setDepth(depth).setVisible(false)
        .setInteractive({ useHandCursor: true });

      const lbl = this.add.text(W / 2, cardY - 25, pkg.label, {
        fontSize: '22px', fontFamily: 'Arial Black', color: '#cccccc',
      }).setOrigin(0.5).setDepth(depth).setVisible(false);

      const sub = this.add.text(W / 2, cardY + 6, pkg.price, {
        fontSize: '18px', fontFamily: 'Arial', color: '#6688aa',
      }).setOrigin(0.5).setDepth(depth).setVisible(false);

      const buyBtn = this.add.rectangle(W / 2, cardY + 38, 140, 34, 0x220044)
        .setDepth(depth).setVisible(false).setInteractive({ useHandCursor: true });
      const buyTxt = this.add.text(W / 2, cardY + 38, 'BUY', {
        fontSize: '16px', fontFamily: 'Arial Black', color: NC.purple,
      }).setOrigin(0.5).setDepth(depth).setVisible(false);

      card.on('pointerover',   () => card.setFillStyle(0x160022));
      card.on('pointerout',    () => card.setFillStyle(0x0a0010));
      buyBtn.on('pointerover', () => buyBtn.setFillStyle(0x440088));
      buyBtn.on('pointerout',  () => buyBtn.setFillStyle(0x220044));
      buyBtn.on('pointerdown', () => this._purchase(pkg.coins));

      this._pkgObjs.push(card, lbl, sub, buyBtn, buyTxt);
    });

    const closeBtn = this.add.text(W / 2, oy + oh - 28, '✕  CLOSE', {
      fontSize: '18px', fontFamily: 'Arial Black', color: '#2a3a44',
    }).setOrigin(0.5).setDepth(depth).setVisible(false)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#6688aa'));
    closeBtn.on('pointerout',  () => closeBtn.setColor('#2a3a44'));
    closeBtn.on('pointerdown', () => this._closeStore());

    this._storeObjs = [dim, panel, title, this._coinBalTxt, simNote, closeBtn, ...this._pkgObjs];
  }

  _openStore() {
    this.storeOpen = true;
    this._storeObjs.forEach(o => o.setVisible(true));
    const coins = parseInt(localStorage.getItem(STORAGE_COINS) || '0', 10);
    this._coinBalTxt.setText(`You have  ⬡ ${coins}  coins`);
  }

  _closeStore() {
    this._storeObjs.forEach(o => o.setVisible(false));
    this.time.delayedCall(50, () => { this.storeOpen = false; });
  }

  _purchase(amount) {
    const current = parseInt(localStorage.getItem(STORAGE_COINS) || '0', 10);
    const updated = current + amount;
    localStorage.setItem(STORAGE_COINS, updated);
    this._coinBalTxt.setText(`You have  ⬡ ${updated}  coins`);
    this._coinBalTxt.setColor('#ddaa00');
    this.time.delayedCall(800, () => this._coinBalTxt.setColor('#889aaa'));
  }

  // ── UPDATE ─────────────────────────────────────────────────────────────────

  update() {
    this.gridTile.tilePositionY -= 0.18;
    this.floaters.forEach(f => {
      f.y -= f.spd / 60;
      if (f.y < -15) { f.y = H + 15; f.x = Phaser.Math.Between(0, W); }
    });
    this.bgFish.forEach(f => {
      f.y -= f.spd / 60;
      if (f.y < -60) { f.y = H + 60; f.x = Phaser.Math.Between(30, W - 30); }
    });
  }
}
