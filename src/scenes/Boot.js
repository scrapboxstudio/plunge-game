import { W, H, BIOMES } from '../main.js';

export default class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    ['fish', 'star', 'octo', 'shark', 'kraken'].forEach(k => {
      this.load.image(k + 'Alive', `assets/${k}Alive.png`);
      this.load.image(k + 'Dead',  `assets/${k}Dead.png`);
    });
    this.load.audio('mainMenu',  'assets/mainMenu.mp3');
    this.load.audio('buttonSFX', 'assets/buttonSFX.mp3');
    this.load.audio('wooshSFX',  'assets/wooshSFX.wav');
    this.load.audio('hitSFX',    'assets/hitSFX.wav');
    this.load.audio('coinSFX',       'assets/coinSFX.wav');
    this.load.audio('invincibleSFX', 'assets/invincibleSFX.wav');
    this.load.audio('1upSFX',        'assets/1upSFX.wav');

    // All biome assets are declared in main.js BIOMES — adding a new biome there
    // automatically loads its background, skin sprites, and music tracks here.
    BIOMES.forEach(b => {
      this.load.image(b.bgKey, `assets/${b.bgKey.slice(3)}.png`);
      [...b.bgSkins, ...b.fillSkins].forEach(s => this.load.image(s.key, s.path ?? `assets/${s.key}.png`));
      b.music.forEach(key => this.load.audio(key, `assets/${key}.mp3`));
    });
  }

  create() {
    this._makeBubble();
    this._makeGlow();
    this._makeDot();
    this._makeGrid();
    this._makeStar();
    this._makeVignette();
    this._makeCoin();
    this._makeShell();
    this.scene.start('Menu');
  }

  _makeBubble() {
    const g = this.make.graphics({ add: false });
    g.lineStyle(1.5, 0xaaeeff, 0.85);
    g.strokeCircle(5, 5, 4);
    // Small glint
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(3, 3, 1.5);
    g.generateTexture('bubble', 10, 10);
    g.destroy();
  }

  _makeGlow() {
    // Bioluminescent particle for deep zones
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x55ffbb, 0.9);
    g.fillCircle(5, 5, 5);
    g.generateTexture('glow', 10, 10);
    g.destroy();
  }

  _makeDot() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(3, 3, 3);
    g.generateTexture('dot', 6, 6);
    g.destroy();
  }

  _makeGrid() {
    // Single grid cell — tiles seamlessly as a graph-paper overlay
    const canvas = document.createElement('canvas');
    const s = 22;
    canvas.width = s; canvas.height = s;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(s, 0); ctx.lineTo(s, s); // right edge
    ctx.moveTo(0, s); ctx.lineTo(s, s); // bottom edge
    ctx.stroke();
    this.textures.addCanvas('grid', canvas);
  }

  _makeStar() {
    // 4-point sparkle matching the reference art style
    const g = this.make.graphics({ add: false });
    g.lineStyle(1.2, 0xffffff, 1);
    g.moveTo(4, 0); g.lineTo(4, 8);
    g.moveTo(0, 4); g.lineTo(8, 4);
    g.strokePath();
    g.lineStyle(0.7, 0xffffff, 0.5);
    g.moveTo(1.2, 1.2); g.lineTo(6.8, 6.8);
    g.moveTo(6.8, 1.2); g.lineTo(1.2, 6.8);
    g.strokePath();
    g.generateTexture('star', 8, 8);
    g.destroy();
  }

  _makeCoin() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(10, 10, 10);
    g.fillStyle(0x000000, 0.25);
    g.fillCircle(10, 10, 5);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(10, 10, 3);
    g.generateTexture('coinTex', 20, 20);
    g.destroy();
  }

  _makeShell() {
    const g = this.make.graphics({ add: false });
    const cx = 14, cy = 14, r = 12;
    // Outer glow halo
    g.fillStyle(0xffffff, 0.25);
    g.fillCircle(cx, cy, r + 2);
    // Main shell body
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx, cy, r);
    // Ridge lines radiating from centre
    g.lineStyle(1.8, 0x000000, 0.18);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      g.lineBetween(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    // Dark inner ring + bright nucleus
    g.fillStyle(0x000000, 0.20);
    g.fillCircle(cx, cy, 5);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(cx, cy, 3);
    g.generateTexture('shellTex', 28, 28);
    g.destroy();
  }

  _makeVignette() {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const cx = W / 2, cy = H / 2;
    const r = Math.sqrt(cx * cx + cy * cy);
    // Transparent center, pure black at corners
    const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    grad.addColorStop(0,   'rgba(0,0,0,0)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.15)');
    grad.addColorStop(1,   'rgba(0,0,0,1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    this.textures.addCanvas('vignette', canvas);
  }
}
