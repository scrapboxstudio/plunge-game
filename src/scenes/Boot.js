import { W, H } from '../main.js';

export default class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.image('diver',     'assets/fish.png');
    this.load.image('diverDead', 'assets/dead.png');
    this.load.image('bg_coral',    'assets/coral.png');
    this.load.image('bg_kelp',     'assets/kelp.png');
    this.load.image('bg_midnight', 'assets/midnight.png');
    this.load.image('bg_hadal',    'assets/hadal.png');
    for (let i = 1; i <= 6; i++) {
      const n = String(i).padStart(2, '0');
      this.load.image(`coral${n}`,    `assets/coral${n}.png`);
      this.load.image(`kelp${n}`,     `assets/kelp${n}.png`);
      this.load.image(`midnight${n}`, `assets/midnight${n}.png`);
      this.load.image(`hadal${n}`,    `assets/hadal${n}.png`);
    }
  }

  create() {
    this._makeBubble();
    this._makeGlow();
    this._makeDot();
    this._makeGrid();
    this._makeStar();
    this._makeVignette();
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
