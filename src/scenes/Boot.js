import { W, H } from '../main.js';

export default class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    this._makeDiver();
    this._makeBubble();
    this._makeGlow();
    this._makeDot();
    this._makeVignette();
    this.scene.start('Menu');
  }

  _makeDiver() {
    // Diving mask silhouette — head + visor + tank
    const g = this.make.graphics({ add: false });
    // Head
    g.fillStyle(0x2299dd); g.fillCircle(24, 21, 18);
    // Mask frame
    g.fillStyle(0x003355); g.fillRoundedRect(9, 15, 30, 14, 5);
    // Visor shine
    g.fillStyle(0x88deff, 0.55); g.fillRoundedRect(11, 16, 26, 11, 4);
    // Tank connector
    g.fillStyle(0x1166aa); g.fillRect(19, 35, 10, 8);
    // Snorkel/regulator dot
    g.fillStyle(0x001a33); g.fillCircle(37, 20, 4);
    g.generateTexture('diver', 48, 48);
    g.destroy();
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
