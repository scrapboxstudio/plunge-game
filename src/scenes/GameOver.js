import { W, H } from '../main.js';

const STORAGE_BEST = 'plunge_best';  // meters

export default class GameOver extends Phaser.Scene {
  constructor() { super('GameOver'); }

  init(data) {
    this.finalDepth = data.depth || 0;
    this.biomeName  = data.biome || 'Coral Reef';
  }

  create() {
    this.cameras.main.setBackgroundColor('#010c18');

    for (let i = 0; i < 14; i++) {
      const bub = this.add.image(
        Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 'bubble'
      ).setAlpha(0.18).setScale(Phaser.Math.FloatBetween(0.5, 2.2));
      this.tweens.add({
        targets: bub, y: bub.y - H - 60,
        duration: Phaser.Math.Between(5000, 10000), repeat: -1,
      });
    }

    const prev  = parseInt(localStorage.getItem(STORAGE_BEST) || '0', 10);
    const isNew = this.finalDepth > prev;
    if (isNew) localStorage.setItem(STORAGE_BEST, this.finalDepth);

    this.add.text(W / 2, H * 0.17, isNew ? 'NEW RECORD!' : 'SURFACED', {
      fontSize: isNew ? '44px' : '36px', fontFamily: 'Arial Black',
      color: isNew ? '#ffd700' : '#ff4455', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.32, `${this.finalDepth}m`, {
      fontSize: '78px', fontFamily: 'Arial Black',
      color: '#00aaff', stroke: '#002244', strokeThickness: 7,
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.44, 'DEPTH REACHED', {
      fontSize: '14px', fontFamily: 'Arial', color: '#334455',
    }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.52, `Reached: ${this.biomeName}`, {
      fontSize: '21px', fontFamily: 'Arial', color: '#7aaabb',
    }).setOrigin(0.5);

    const best = isNew ? this.finalDepth : prev;
    this.add.text(W / 2, H * 0.60, `BEST:  ${best}m`, {
      fontSize: '24px', fontFamily: 'Arial Black', color: '#ffd700',
    }).setOrigin(0.5);

    this._makeButton(W / 2, H * 0.73, 'DIVE AGAIN', 260, 68, 0x0055bb, 0x0077ff, 30, () => {
      this.cameras.main.fadeOut(250);
      this.time.delayedCall(250, () => this.scene.start('Game'));
    });

    const menu = this.add.text(W / 2, H * 0.86, '← Main Menu', {
      fontSize: '20px', fontFamily: 'Arial', color: '#334455',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    menu.on('pointerover', () => menu.setColor('#6688aa'));
    menu.on('pointerout',  () => menu.setColor('#334455'));
    menu.on('pointerdown', () => {
      this.cameras.main.fadeOut(250);
      this.time.delayedCall(250, () => this.scene.start('Menu'));
    });

    this.cameras.main.fadeIn(400);
  }

  _makeButton(x, y, label, w, h, color, hoverColor, fontSize, callback) {
    const btn = this.add.rectangle(x, y, w, h, color).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, {
      fontSize: `${fontSize}px`, fontFamily: 'Arial Black', color: '#ffffff',
    }).setOrigin(0.5);
    btn.on('pointerover',  () => btn.setFillStyle(hoverColor));
    btn.on('pointerout',   () => btn.setFillStyle(color));
    btn.on('pointerdown',  callback);
    return btn;
  }
}
