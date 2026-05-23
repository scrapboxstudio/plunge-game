import { W, H, BIOMES } from '../main.js';

const STORAGE_BEST  = 'plunge_best';
const STORAGE_COINS = 'plunge_coins';

const PACKAGES = [
  { coins: 4,  label: '4 Coins',  price: '$0.99' },
  { coins: 10, label: '10 Coins', price: '$1.99' },
  { coins: 20, label: '20 Coins', price: '$3.99' },
];

export default class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    this.storeOpen = false;
    this.cameras.main.setBackgroundColor('#010c18');
    this._spawnBubbles();

    // Title
    this.add.text(W / 2, H * 0.24, 'PLUNGE', {
      fontSize: '80px', fontFamily: 'Arial Black',
      color: '#ffffff', stroke: '#002244', strokeThickness: 10,
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.36, 'HOW DEEP CAN YOU GO?', {
      fontSize: '18px', fontFamily: 'Arial', color: '#5599cc',
    }).setOrigin(0.5);

    // Biome dots preview
    this._drawBiomePreview();

    // Best depth (meters)
    const best = parseInt(localStorage.getItem(STORAGE_BEST) || '0', 10);
    this.add.text(W / 2, H * 0.62, `BEST  ${best > 0 ? best + 'm' : '---'}`, {
      fontSize: '22px', fontFamily: 'Arial Black', color: '#ffcc00',
    }).setOrigin(0.5);

    // Store button
    const storeBg = this.add.rectangle(W / 2, H * 0.70, 190, 48, 0x1a3344)
      .setInteractive({ useHandCursor: true });
    const coinIcon = this.add.text(W / 2 - 70, H * 0.70, '🪙', { fontSize: '20px' }).setOrigin(0.5);
    const storeLabel = this.add.text(W / 2 + 8, H * 0.70, 'COIN STORE', {
      fontSize: '20px', fontFamily: 'Arial Black', color: '#ffd700',
    }).setOrigin(0.5);

    storeBg.on('pointerover',  () => storeBg.setFillStyle(0x224466));
    storeBg.on('pointerout',   () => storeBg.setFillStyle(0x1a3344));
    storeBg.on('pointerdown',  () => this._openStore());

    // Tap to start (pulsing)
    const tap = this.add.text(W / 2, H * 0.80, '▼  TAP TO DIVE  ▼', {
      fontSize: '28px', fontFamily: 'Arial Black',
      color: '#00aaff', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.tweens.add({ targets: tap, alpha: 0.1, yoyo: true, repeat: -1, duration: 750 });

    this.add.text(W / 2, H * 0.90, 'tap left / right side to steer', {
      fontSize: '15px', fontFamily: 'Arial', color: '#2a3d4f',
    }).setOrigin(0.5);

    this.input.on('pointerdown', (p) => {
      if (this.storeOpen) return;
      // ignore taps on the store button area
      if (p.y > H * 0.66 && p.y < H * 0.74 && Math.abs(p.x - W / 2) < 100) return;
      this.input.off('pointerdown');
      this.cameras.main.fadeOut(280);
      this.time.delayedCall(280, () => this.scene.start('Game'));
    });

    this._buildStoreOverlay();
    this.cameras.main.fadeIn(350);
  }

  _buildStoreOverlay() {
    const depth = 10;
    const oy = H * 0.12;
    const oh = H * 0.76;

    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75)
      .setDepth(depth).setVisible(false).setInteractive(); // blocks clicks behind

    const panel = this.add.rectangle(W / 2, oy + oh / 2, W - 40, oh, 0x020e1c)
      .setStrokeStyle(2, 0x0055aa).setDepth(depth).setVisible(false);

    const title = this.add.text(W / 2, oy + 36, 'COIN STORE', {
      fontSize: '28px', fontFamily: 'Arial Black', color: '#ffd700',
    }).setOrigin(0.5).setDepth(depth).setVisible(false);

    const coins = parseInt(localStorage.getItem(STORAGE_COINS) || '0', 10);
    this._coinBalTxt = this.add.text(W / 2, oy + 72, `You have  🪙 ${coins}  coins`, {
      fontSize: '16px', fontFamily: 'Arial', color: '#aaccdd',
    }).setOrigin(0.5).setDepth(depth).setVisible(false);

    const simNote = this.add.text(W / 2, oy + 96, '(simulated — free for testing)', {
      fontSize: '11px', fontFamily: 'Arial', color: '#334455',
    }).setOrigin(0.5).setDepth(depth).setVisible(false);

    // Package cards
    this._pkgObjs = [];
    PACKAGES.forEach((pkg, i) => {
      const cardY = oy + 160 + i * 130;
      const card  = this.add.rectangle(W / 2, cardY, W - 80, 110, 0x061828)
        .setStrokeStyle(1, 0x0044aa).setDepth(depth).setVisible(false).setInteractive({ useHandCursor: true });

      const lbl = this.add.text(W / 2, cardY - 22, pkg.label, {
        fontSize: '22px', fontFamily: 'Arial Black', color: '#ffffff',
      }).setOrigin(0.5).setDepth(depth).setVisible(false);

      const sub = this.add.text(W / 2, cardY + 10, pkg.price, {
        fontSize: '18px', fontFamily: 'Arial', color: '#88aacc',
      }).setOrigin(0.5).setDepth(depth).setVisible(false);

      const buyBtn = this.add.rectangle(W / 2, cardY + 38, 140, 34, 0x005599)
        .setDepth(depth).setVisible(false).setInteractive({ useHandCursor: true });
      const buyTxt = this.add.text(W / 2, cardY + 38, 'BUY', {
        fontSize: '16px', fontFamily: 'Arial Black', color: '#ffffff',
      }).setOrigin(0.5).setDepth(depth).setVisible(false);

      card.on('pointerover',   () => card.setFillStyle(0x0a2438));
      card.on('pointerout',    () => card.setFillStyle(0x061828));
      buyBtn.on('pointerover', () => buyBtn.setFillStyle(0x0077cc));
      buyBtn.on('pointerout',  () => buyBtn.setFillStyle(0x005599));
      buyBtn.on('pointerdown', () => this._purchase(pkg.coins));

      this._pkgObjs.push(card, lbl, sub, buyBtn, buyTxt);
    });

    // Close button
    const closeBtn = this.add.text(W / 2, oy + oh - 30, '✕  CLOSE', {
      fontSize: '18px', fontFamily: 'Arial Black', color: '#334455',
    }).setOrigin(0.5).setDepth(depth).setVisible(false).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover',  () => closeBtn.setColor('#6688aa'));
    closeBtn.on('pointerout',   () => closeBtn.setColor('#334455'));
    closeBtn.on('pointerdown',  () => this._closeStore());

    this._storeObjs = [dim, panel, title, this._coinBalTxt, simNote, closeBtn, ...this._pkgObjs];
  }

  _openStore() {
    this.storeOpen = true;
    this._storeObjs.forEach(o => o.setVisible(true));
    // Refresh balance
    const coins = parseInt(localStorage.getItem(STORAGE_COINS) || '0', 10);
    this._coinBalTxt.setText(`You have  🪙 ${coins}  coins`);
  }

  _closeStore() {
    this._storeObjs.forEach(o => o.setVisible(false));
    // Delay clearing the flag so this same tap doesn't also trigger "start game"
    this.time.delayedCall(50, () => { this.storeOpen = false; });
  }

  _purchase(amount) {
    const current = parseInt(localStorage.getItem(STORAGE_COINS) || '0', 10);
    const updated = current + amount;
    localStorage.setItem(STORAGE_COINS, updated);
    this._coinBalTxt.setText(`You have  🪙 ${updated}  coins`);

    // Brief flash feedback
    this._coinBalTxt.setColor('#ffd700');
    this.time.delayedCall(800, () => this._coinBalTxt.setColor('#aaccdd'));
  }

  _spawnBubbles() {
    this.floaters = [];
    for (let i = 0; i < 22; i++) {
      const img = this.add.image(
        Phaser.Math.Between(0, W),
        Phaser.Math.Between(0, H),
        'bubble'
      ).setAlpha(Phaser.Math.FloatBetween(0.1, 0.45))
       .setScale(Phaser.Math.FloatBetween(0.4, 2.2));
      img.spd = Phaser.Math.FloatBetween(22, 70);
      this.floaters.push(img);
    }
  }

  _drawBiomePreview() {
    const biomeColors = [0x1a9eff, 0x1aaf4e, 0x9944ff, 0x00ffaa];
    this.add.text(W / 2, H * 0.46, 'DISCOVER 4 BIOMES', {
      fontSize: '12px', fontFamily: 'Arial', color: '#334455',
    }).setOrigin(0.5);

    BIOMES.forEach((b, i) => {
      const x = 60 + i * 90;
      const y = H * 0.53;
      this.add.circle(x, y, 9, biomeColors[i]);
      this.add.text(x, y + 18, b.name.split(' ')[0], {
        fontSize: '10px', fontFamily: 'Arial', color: '#557788',
      }).setOrigin(0.5);
    });
  }

  update() {
    this.floaters.forEach(f => {
      f.y -= f.spd / 60;
      if (f.y < -15) { f.y = H + 15; f.x = Phaser.Math.Between(0, W); }
    });
  }
}
