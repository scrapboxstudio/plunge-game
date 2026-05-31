import { W, H, SAFE_TOP, BIOMES } from '../main.js';
import {
  PLAYER_SPRITES, SKINS, TRAILS, THEMES,
  STORAGE_ACTIVE_SPRITE, STORAGE_OWNED_SPRITES,
  STORAGE_ACTIVE_SKIN, STORAGE_OWNED_SKINS,
  STORAGE_ACTIVE_TRAIL, STORAGE_OWNED_TRAILS,
  STORAGE_ACTIVE_THEME, STORAGE_OWNED_THEMES,
} from '../config/cosmetics.js';

const STORAGE_BEST       = 'plunge_best';
const STORAGE_COINS      = 'plunge_coins';
const STORAGE_LIVES      = 'plunge_lives';
const STORAGE_VOL_MUSIC  = 'plunge_vol_music';
const STORAGE_VOL_SFX    = 'plunge_vol_sfx';
const STORAGE_MUTE_MUSIC = 'plunge_mute_music';
const STORAGE_MUTE_SFX   = 'plunge_mute_sfx';
const STORAGE_TRAIL      = 'plunge_particle_trail';

const NEON = { cyan: 0x0088bb, pink: 0xcc0077, green: 0x5a8800, orange: 0xbb4400, purple: 0x6611aa };
const NC   = { cyan: '#0088bb', pink: '#cc0077', green: '#5a8800', orange: '#bb4400', purple: '#6611aa' };
const LETTER_COLORS = [NC.cyan, NC.pink, NC.green, NC.orange, NC.purple];

export default class Menu extends Phaser.Scene {
  constructor() { super('Menu'); }

  init(data) {
    this.skipAbyss = !!(data && data.skipAbyss);
  }

  create() {
    this.storeOpen    = false;
    this.settingsOpen = false;
    this.abyssOpen    = !this.skipAbyss;
    this.bgFish       = [];
    this.floaters     = [];

    // ── BACKGROUND ────────────────────────────────────────────────────────────
    this.cameras.main.setBackgroundColor('#000000');
    this.gridTile = this.add.tileSprite(W / 2, H / 2, W, H, 'grid')
      .setAlpha(0.12).setTint(0x220044);

    this._spawnBgFish();
    this._spawnBubbles();
    this._spawnSparkles();

    this._drawStarBurst(20,      30,       15, NEON.cyan,   0.65);
    this._drawStarBurst(W - 20,  30,       15, NEON.pink,   0.65);
    this._drawStarBurst(22,      H * 0.58, 11, NEON.green,  0.50);

    // ── TITLE ─────────────────────────────────────────────────────────────────
    this.letterObjs = this._buildTitle(H * 0.185);

    // ── TAGLINE ───────────────────────────────────────────────────────────────
    this._buildTagline(H * 0.270);

    // ── BEST SCORE ────────────────────────────────────────────────────────────
    this._buildBestDepth(H * 0.400);

    // ── COIN BALANCE ──────────────────────────────────────────────────────────
    const initCoins = parseInt(localStorage.getItem(STORAGE_COINS) || '0', 10);
    this._menuCoinTxt = this.add.text(W / 2, H * 0.478, `⬡ ${initCoins.toLocaleString()} coins`, {
      fontSize: '16px', fontFamily: 'Arial', color: '#44350a',
    }).setOrigin(0.5);

    // ── BUTTONS ───────────────────────────────────────────────────────────────
    this._buildPlayButton(H * 0.575);
    this._buildStoreButton(H * 0.690);
    this._buildSettingsButton(H * 0.790);

    // ── OVERLAYS ──────────────────────────────────────────────────────────────
    this._buildStoreOverlay();
    this._buildSettingsOverlay();

    // ── MUSIC ─────────────────────────────────────────────────────────────────
    this._menuMusic = null;
    this.events.once('shutdown', () => { this._menuMusic?.stop(); this._menuMusic?.destroy(); });

    // ── ENTER THE ABYSS SPLASH (first open only) ──────────────────────────────
    if (this.skipAbyss) {
      this._startMenuMusic();
    } else {
      this._buildAbyssPanel();
    }

    this.cameras.main.fadeIn(400);
  }

  // ── TITLE ──────────────────────────────────────────────────────────────────

  _buildTitle(centerY) {
    const letters = 'PLUNGE'.split('');
    const objs = letters.map((ch, i) => this.add.text(0, 0, ch, {
      fontSize: '88px', fontFamily: "'Rubik Glitch', Arial Black",
      color: LETTER_COLORS[i % LETTER_COLORS.length],
      stroke: '#110022', strokeThickness: 6,
      shadow: { offsetX: 3, offsetY: 3, color: '#000011', blur: 8, fill: true },
    }).setOrigin(0, 0.5));

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

  // ── TAGLINE ────────────────────────────────────────────────────────────────

  _buildTagline(y) {
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

  // ── BEST SCORE ─────────────────────────────────────────────────────────────

  _buildBestDepth(centerY) {
    const best    = parseInt(localStorage.getItem(STORAGE_BEST) || '0', 10);
    const hasBest = best > 0;

    this.add.text(W / 2, centerY - 36, 'BEST DEPTH', {
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

    if (hasBest) {
      const biomeName = ([...BIOMES].reverse().find(b => best >= b.minDepth) ?? BIOMES[0]).name;
      this.add.text(W / 2, centerY + 34, `▼  ${biomeName.toUpperCase()}  ▼`, {
        fontSize: '12px', fontFamily: 'Arial Black',
        color: NC.green, stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5);
    }

    this._drawWobblyCircle(W / 2, centerY, 62);
  }

  // ── BUTTONS ────────────────────────────────────────────────────────────────

  _buildPlayButton(centerY) {
    const bw = 260, bh = 64, bx = W / 2 - bw / 2;
    const bg = this.add.rectangle(W / 2, centerY, bw, bh, 0x0a0015, 0.9)
      .setInteractive({ useHandCursor: true });
    const borderG = this.add.graphics();
    this._drawSketchRect(borderG, bx, centerY - bh / 2, bw, bh, NEON.pink);
    this.tweens.add({ targets: borderG, alpha: 0.45, yoyo: true, repeat: -1, duration: 580 });

    const txt = this.add.text(W / 2, centerY, 'PLAY  ▼', {
      fontSize: '34px', fontFamily: 'Arial Black',
      color: NC.pink, stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);

    bg.on('pointerover',  () => { bg.setFillStyle(0x1a0025, 0.95); txt.setColor('#ff44aa'); });
    bg.on('pointerout',   () => { bg.setFillStyle(0x0a0015, 0.90); txt.setColor(NC.pink);   });
    bg.on('pointerdown',  () => this._dive());
  }

  _buildStoreButton(centerY) {
    const bw = 220, bh = 52, bx = W / 2 - bw / 2;
    const bg = this.add.rectangle(W / 2, centerY, bw, bh, 0x110800, 0.85)
      .setInteractive({ useHandCursor: true });
    const borderG = this.add.graphics();
    this._drawSketchRect(borderG, bx, centerY - bh / 2, bw, bh, 0xddaa00);
    this.tweens.add({ targets: borderG, alpha: 0.5, yoyo: true, repeat: -1, duration: 900 });

    const txt = this.add.text(W / 2, centerY, '⬡  STORE', {
      fontSize: '24px', fontFamily: 'Arial Black',
      color: '#ddaa00', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5);

    bg.on('pointerover',  () => { bg.setFillStyle(0x221100, 0.95); txt.setColor('#ffcc00'); });
    bg.on('pointerout',   () => { bg.setFillStyle(0x110800, 0.85); txt.setColor('#ddaa00'); });
    bg.on('pointerdown',  () => { this._sfx(); this._openStore(); });
  }

  _buildSettingsButton(centerY) {
    const bw = 220, bh = 52, bx = W / 2 - bw / 2;
    const bg = this.add.rectangle(W / 2, centerY, bw, bh, 0x080808, 0.85)
      .setInteractive({ useHandCursor: true });
    const borderG = this.add.graphics();
    this._drawSketchRect(borderG, bx, centerY - bh / 2, bw, bh, 0x445566);

    const txt = this.add.text(W / 2, centerY, '⚙  SETTINGS', {
      fontSize: '22px', fontFamily: 'Arial Black',
      color: '#445566', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);

    bg.on('pointerover',  () => { bg.setFillStyle(0x111111, 0.95); txt.setColor('#6688aa'); borderG.setAlpha(0.8); });
    bg.on('pointerout',   () => { bg.setFillStyle(0x080808, 0.85); txt.setColor('#445566'); borderG.setAlpha(1.0); });
    bg.on('pointerdown',  () => { this._sfx(); this._openSettings(); });
  }

  // ── STORE OVERLAY ──────────────────────────────────────────────────────────

  _buildStoreOverlay() {
    const d  = 10;
    // Push overlay below the notch / Dynamic Island on iPhones.
    // SAFE_TOP is at minimum 44px on phones (see main.js), so the panel always
    // starts in the clear-screen area even if env(safe-area-inset-top) misbehaves.
    const oy = H * 0.07 + SAFE_TOP;
    const oh = Math.min(H * 0.84, H - oy - 20);  // shrink to keep a bottom margin
    const cw = W - 28;          // card/panel content width
    const cx = W / 2;

    // Shared backdrop + panel — always visible while store is open
    this._storeDim   = this.add.rectangle(cx, H / 2, W, H, 0x000000, 0.92)
      .setDepth(d).setVisible(false).setInteractive();
    this._storePanel = this.add.rectangle(cx, oy + oh / 2, cw, oh, 0x04000a)
      .setStrokeStyle(1.5, NEON.purple, 0.7).setDepth(d).setVisible(false);

    // Persistent coin badge — always shown on every store page
    this._storeCoinBadge = this.add.text(cx + cw / 2 - 12, oy + 18, '⬡ 0', {
      fontSize: '16px', fontFamily: 'Arial Black', color: '#ddaa00',
    }).setOrigin(1, 0.5).setDepth(d + 2).setVisible(false);

    this._buildStoreMain(d + 1, oy, oh, cw, cx);
    this._buildStoreCoinsPage(d + 1, oy, oh, cw, cx);
    this._buildStoreLivesPage(d + 1, oy, oh, cw, cx);
    this._buildStoreCosmeticsPage(d + 1, oy, oh, cw, cx);
    // Each entry drives _buildStoreCosmeticPage, _handleCosmeticAction, _refreshCosmeticCards
    // and _navTo / _closeStore generically. Add a new cosmetic category here — no other changes needed.
    this._cosmeticPages = [
      { route: 'cosmetics_sprite', title: 'PLAYER SKINS', data: PLAYER_SPRITES, ownedKey: STORAGE_OWNED_SPRITES,   activeKey: STORAGE_ACTIVE_SPRITE   },
      { route: 'cosmetics_player', title: 'AURA',         data: SKINS,          ownedKey: STORAGE_OWNED_SKINS,     activeKey: STORAGE_ACTIVE_SKIN     },
      { route: 'cosmetics_particles', title: 'PARTICLES', data: TRAILS,         ownedKey: STORAGE_OWNED_TRAILS,    activeKey: STORAGE_ACTIVE_TRAIL    },
      { route: 'cosmetics_theme',  title: 'THEMES',       data: THEMES,         ownedKey: STORAGE_OWNED_THEMES,    activeKey: STORAGE_ACTIVE_THEME    },
    ];
    this._cosmeticPages.forEach(p => this._buildStoreCosmeticPage(d + 1, oy, oh, cw, cx, p));
  }

  _buildStoreMain(d, oy, oh, cw, cx) {
    const mk = (o) => { this._storeMainObjs.push(o); return o; };
    this._storeMainObjs = [];

    mk(this.add.text(cx, oy + 36, 'STORE', {
      fontSize: '30px', fontFamily: 'Arial Black',
      color: '#ddaa00', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(d).setVisible(false));

    // Horizontal rule
    mk(this.add.rectangle(cx, oy + 62, cw - 40, 1, 0xddaa00, 0.20).setDepth(d).setVisible(false));

    this._storeMainCoinTxt = mk(this.add.text(cx, oy + 88, '', {
      fontSize: '20px', fontFamily: 'Arial Black', color: '#ddaa00',
    }).setOrigin(0.5).setDepth(d).setVisible(false));

    // ── 3 NAVIGATION PANELS ──────────────────────────────────────────────────
    const panels = [
      {
        y:       oy + 200,
        color:   0xddaa00,
        nc:      '#ddaa00',
        fill:    0x110800,
        icon:    '💰',
        title:   'BUY COINS',
        sub:     '$1.00 = 100 coins',
        action:  () => this._navTo('coins'),
      },
      {
        y:       oy + 360,
        color:   0xcc0077,
        nc:      '#cc0077',
        fill:    0x110018,
        icon:    '♥',
        title:   'BUY LIVES',
        sub:     '1 / 5 / 10 lives  —  100+ coins',
        action:  () => this._navTo('lives'),
      },
      {
        y:       oy + 520,
        color:   0x6611aa,
        nc:      '#9944dd',
        fill:    0x0a0018,
        icon:    '✦',
        title:   'COSMETICS',
        sub:     'Skins · Aura · Particles · Themes',
        action:  () => this._navTo('cosmetics'),
      },
    ];

    panels.forEach(p => {
      const ph = 120, pw = cw - 24;
      const card = mk(this.add.rectangle(cx, p.y, pw, ph, p.fill)
        .setStrokeStyle(1.5, p.color, 0.55).setDepth(d).setVisible(false)
        .setInteractive({ useHandCursor: true }));

      mk(this.add.text(cx - pw / 2 + 32, p.y - 12, p.icon, {
        fontSize: '30px', fontFamily: 'Arial',
      }).setOrigin(0.5).setDepth(d + 1).setVisible(false));

      mk(this.add.text(cx - pw / 2 + 72, p.y - 16, p.title, {
        fontSize: '20px', fontFamily: 'Arial Black', color: p.nc,
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0, 0.5).setDepth(d + 1).setVisible(false));

      mk(this.add.text(cx - pw / 2 + 72, p.y + 10, p.sub, {
        fontSize: '13px', fontFamily: 'Arial', color: '#556677',
      }).setOrigin(0, 0.5).setDepth(d + 1).setVisible(false));

      mk(this.add.text(cx + pw / 2 - 18, p.y, '›', {
        fontSize: '32px', fontFamily: 'Arial Black', color: p.nc,
      }).setOrigin(1, 0.5).setDepth(d + 1).setVisible(false));

      card.on('pointerover', () => card.setStrokeStyle(2.5, p.color, 1.0));
      card.on('pointerout',  () => card.setStrokeStyle(1.5, p.color, 0.55));
      card.on('pointerdown', () => { this._sfx(); p.action(); });
    });

    const closeBtn = mk(this.add.text(cx, oy + oh - 28, '✕  CLOSE', {
      fontSize: '18px', fontFamily: 'Arial Black', color: '#2a3a44',
    }).setOrigin(0.5).setDepth(d).setVisible(false).setInteractive({ useHandCursor: true }));
    closeBtn.on('pointerover', () => closeBtn.setColor('#6688aa'));
    closeBtn.on('pointerout',  () => closeBtn.setColor('#2a3a44'));
    closeBtn.on('pointerdown', () => { this._sfx(); this._closeStore(); });
  }

  _buildStoreCoinsPage(d, oy, oh, cw, cx) {
    const mk = (o) => { this._storeCoinsObjs.push(o); return o; };
    this._storeCoinsObjs = [];

    mk(this._backBtn(cx, oy + 36, d, () => this._navTo('main')));

    mk(this.add.text(cx, oy + 80, 'BUY COINS', {
      fontSize: '26px', fontFamily: 'Arial Black',
      color: '#ddaa00', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(d).setVisible(false));

    mk(this.add.text(cx, oy + 114, '$1.00 = 100 coins', {
      fontSize: '15px', fontFamily: 'Arial', color: '#556677',
    }).setOrigin(0.5).setDepth(d).setVisible(false));

    mk(this.add.rectangle(cx, oy + 136, cw - 40, 1, 0xddaa00, 0.15).setDepth(d).setVisible(false));

    this._coinsPageBalTxt = mk(this.add.text(cx, oy + 162, '', {
      fontSize: '18px', fontFamily: 'Arial Black', color: '#ddaa00',
    }).setOrigin(0.5).setDepth(d).setVisible(false));

    this._coinsPageFeedback = mk(this.add.text(cx, oy + oh - 52, '', {
      fontSize: '14px', fontFamily: 'Arial Black', color: '#00cc77',
    }).setOrigin(0.5).setDepth(d).setVisible(false));

    const pkgs = [
      { label: '$0.99',  coins: 100  },
      { label: '$1.99',  coins: 200  },
      { label: '$4.99',  coins: 500  },
      { label: '$9.99',  coins: 1000 },
    ];

    let _openConfirm;  // assigned after the confirmation overlay is built below

    pkgs.forEach((pkg, i) => {
      const py    = oy + 222 + i * 105;
      const cardW = cw - 32;
      const card = mk(this.add.rectangle(cx, py, cardW, 85, 0x110800)
        .setStrokeStyle(1, 0xddaa00, 0.35).setDepth(d).setVisible(false)
        .setInteractive({ useHandCursor: true }));

      mk(this.add.text(cx - cardW / 2 + 16, py, `⬡ ${pkg.coins.toLocaleString()} coins`, {
        fontSize: '20px', fontFamily: 'Arial Black', color: '#ddaa00',
      }).setOrigin(0, 0.5).setDepth(d + 1).setVisible(false));

      const buyBtn = mk(this.add.rectangle(cx + cardW / 2 - 54, py, 88, 38, 0x221100)
        .setStrokeStyle(1, 0xddaa00, 0.8).setDepth(d + 1).setVisible(false)
        .setInteractive({ useHandCursor: true }));

      mk(this.add.text(cx + cardW / 2 - 54, py, pkg.label, {
        fontSize: '16px', fontFamily: 'Arial Black', color: '#ddaa00',
      }).setOrigin(0.5).setDepth(d + 2).setVisible(false));

      card.on('pointerover', () => card.setStrokeStyle(2, 0xddaa00, 0.8));
      card.on('pointerout',  () => card.setStrokeStyle(1, 0xddaa00, 0.35));
      buyBtn.on('pointerover', () => buyBtn.setFillStyle(0x442200));
      buyBtn.on('pointerout',  () => buyBtn.setFillStyle(0x221100));
      buyBtn.on('pointerdown', () => { this._sfx(); _openConfirm?.(pkg); });
    });

    // ── PURCHASE CONFIRMATION OVERLAY ─────────────────────────────────────────
    const cobjs = [];
    const mkco  = o => { cobjs.push(o); return o; };
    const ccY   = oy + oh * 0.46;
    const ccW   = cw - 44;
    const ccH   = 260;

    mkco(this.add.rectangle(cx, oy + oh * 0.5, cw, oh, 0x000000, 0.92)
      .setDepth(d + 10).setVisible(false).setInteractive());
    mkco(this.add.rectangle(cx, ccY, ccW, ccH, 0x0d0800)
      .setStrokeStyle(2, 0xddaa00, 0.7).setDepth(d + 11).setVisible(false));

    mkco(this.add.text(cx, ccY - ccH / 2 + 30, 'CONFIRM PURCHASE', {
      fontSize: '18px', fontFamily: 'Arial Black', color: '#ddaa00',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(d + 12).setVisible(false));

    const ccCoins = mkco(this.add.text(cx, ccY - ccH / 2 + 68, '', {
      fontSize: '26px', fontFamily: 'Arial Black', color: '#ddaa00',
    }).setOrigin(0.5).setDepth(d + 12).setVisible(false));

    const ccPrice = mkco(this.add.text(cx, ccY - ccH / 2 + 100, '', {
      fontSize: '15px', fontFamily: 'Arial Black', color: '#998855',
    }).setOrigin(0.5).setDepth(d + 12).setVisible(false));

    mkco(this.add.text(cx, ccY - ccH / 2 + 132, 'Are you sure you want to make this purchase?', {
      fontSize: '12px', fontFamily: 'Arial', color: '#778899',
      wordWrap: { width: ccW - 40 }, align: 'center',
    }).setOrigin(0.5).setDepth(d + 12).setVisible(false));

    mkco(this.add.text(cx, ccY - ccH / 2 + 158, 'This will charge your payment method.', {
      fontSize: '11px', fontFamily: 'Arial', color: '#445566',
    }).setOrigin(0.5).setDepth(d + 12).setVisible(false));

    const ccConfirmBtn = mkco(this.add.rectangle(cx - 52, ccY - ccH / 2 + 210, 86, 38, 0x002200)
      .setStrokeStyle(1.5, 0x00cc66, 0.8).setDepth(d + 12).setVisible(false)
      .setInteractive({ useHandCursor: true }));
    mkco(this.add.text(cx - 52, ccY - ccH / 2 + 210, 'CONFIRM', {
      fontSize: '13px', fontFamily: 'Arial Black', color: '#00cc66',
    }).setOrigin(0.5).setDepth(d + 13).setVisible(false));

    const ccCancelBtn = mkco(this.add.rectangle(cx + 52, ccY - ccH / 2 + 210, 86, 38, 0x111111)
      .setStrokeStyle(1.5, 0x556677, 0.6).setDepth(d + 12).setVisible(false)
      .setInteractive({ useHandCursor: true }));
    mkco(this.add.text(cx + 52, ccY - ccH / 2 + 210, 'CANCEL', {
      fontSize: '13px', fontFamily: 'Arial Black', color: '#556677',
    }).setOrigin(0.5).setDepth(d + 13).setVisible(false));

    const _closeConfirm = () => cobjs.forEach(o => o.setVisible(false));

    _openConfirm = (pkg) => {
      ccCoins.setText(`⬡ ${pkg.coins.toLocaleString()} coins`);
      ccPrice.setText(pkg.label);

      ccConfirmBtn.removeAllListeners('pointerdown');
      ccConfirmBtn.on('pointerdown', () => {
        this._sfx();
        _closeConfirm();
        const cur = parseInt(localStorage.getItem(STORAGE_COINS) || '0', 10);
        const updated = cur + pkg.coins;
        localStorage.setItem(STORAGE_COINS, updated);
        this._refreshAllCoinTxt(updated);
        this._coinsPageFeedback.setText(`+${pkg.coins} coins added!`);
        this.time.delayedCall(2000, () => { if (this._coinsPageFeedback?.active) this._coinsPageFeedback.setText(''); });
      });

      cobjs.forEach(o => o.setVisible(true));
    };

    ccCancelBtn.on('pointerdown', () => { this._sfx(); _closeConfirm(); });

    this._storeCoinsConfirmObjs = cobjs;
  }

  _buildStoreLivesPage(d, oy, oh, cw, cx) {
    const mk = (o) => { this._storeLivesObjs.push(o); return o; };
    this._storeLivesObjs = [];

    mk(this._backBtn(cx, oy + 36, d, () => this._navTo('main')));

    mk(this.add.text(cx, oy + 78, 'BUY LIVES', {
      fontSize: '26px', fontFamily: 'Arial Black',
      color: '#cc0077', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(d).setVisible(false));

    mk(this.add.rectangle(cx, oy + 108, cw - 40, 1, 0xcc0077, 0.15).setDepth(d).setVisible(false));

    this._livesCoinsDisplay = mk(this.add.text(cx, oy + 138, '', {
      fontSize: '18px', fontFamily: 'Arial Black', color: '#ddaa00',
    }).setOrigin(0.5).setDepth(d).setVisible(false));

    this._livesDisplay = mk(this.add.text(cx, oy + 166, '', {
      fontSize: '18px', fontFamily: 'Arial Black', color: '#cc0077',
    }).setOrigin(0.5).setDepth(d).setVisible(false));

    // Three purchase tiers
    const tiers = [
      { lives: 1,  cost: 100,  label: '♥  1 Life',   sub: '100 coins'   },
      { lives: 5,  cost: 500,  label: '♥♥  5 Lives',  sub: '500 coins'   },
      { lives: 10, cost: 1000, label: '♥♥♥  10 Lives', sub: '1,000 coins' },
    ];

    tiers.forEach((tier, i) => {
      const py = oy + 248 + i * 148;
      const card = mk(this.add.rectangle(cx, py, cw - 32, 120, 0x110010)
        .setStrokeStyle(1.5, 0xcc0077, 0.45).setDepth(d).setVisible(false)
        .setInteractive({ useHandCursor: true }));

      mk(this.add.text(cx, py - 20, tier.label, {
        fontSize: '22px', fontFamily: 'Arial Black', color: '#cc0077',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(d + 1).setVisible(false));

      mk(this.add.text(cx, py + 12, tier.sub, {
        fontSize: '14px', fontFamily: 'Arial', color: '#556677',
      }).setOrigin(0.5).setDepth(d + 1).setVisible(false));

      const buyBtn = mk(this.add.rectangle(cx, py + 42, 140, 34, 0x330020)
        .setStrokeStyle(1, 0xcc0077, 0.8).setDepth(d + 1).setVisible(false)
        .setInteractive({ useHandCursor: true }));
      mk(this.add.text(cx, py + 42, 'BUY', {
        fontSize: '15px', fontFamily: 'Arial Black', color: '#cc0077',
      }).setOrigin(0.5).setDepth(d + 2).setVisible(false));

      card.on('pointerover', () => card.setStrokeStyle(2.5, 0xcc0077, 1.0));
      card.on('pointerout',  () => card.setStrokeStyle(1.5, 0xcc0077, 0.45));
      buyBtn.on('pointerover', () => buyBtn.setFillStyle(0x550033));
      buyBtn.on('pointerout',  () => buyBtn.setFillStyle(0x330020));
      buyBtn.on('pointerdown', () => { this._sfx(); this._purchaseLife(tier.lives, tier.cost); });
    });

    this._livesNotEnoughTxt = mk(this.add.text(cx, oy + oh - 60, '', {
      fontSize: '14px', fontFamily: 'Arial Black', color: '#cc0077',
    }).setOrigin(0.5).setDepth(d).setVisible(false));
  }

  _buildStoreCosmeticsPage(d, oy, oh, cw, cx) {
    const mk = (o) => { this._storeCosmeticsObjs.push(o); return o; };
    this._storeCosmeticsObjs = [];

    mk(this._backBtn(cx, oy + 36, d, () => this._navTo('main')));

    mk(this.add.text(cx, oy + 80, 'COSMETICS', {
      fontSize: '26px', fontFamily: 'Arial Black',
      color: '#9944dd', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(d).setVisible(false));

    mk(this.add.text(cx, oy + 114, 'Change the look and vibe of the game', {
      fontSize: '13px', fontFamily: 'Arial', color: '#556677',
    }).setOrigin(0.5).setDepth(d).setVisible(false));

    mk(this.add.rectangle(cx, oy + 136, cw - 40, 1, 0x6611aa, 0.15).setDepth(d).setVisible(false));

    const cats = [
      { icon: '🐟', label: 'Player Skins',  sub: 'Choose your creature',     action: () => this._navTo('cosmetics_sprite')    },
      { icon: '🤿', label: 'Aura',           sub: 'Change your diver colour', action: () => this._navTo('cosmetics_player')    },
      { icon: '✨', label: 'Particles',      sub: 'Buy trail effects',        action: () => this._navTo('cosmetics_particles') },
      { icon: '🎨', label: 'Themes',         sub: 'Change the whole game vibe', action: () => this._navTo('cosmetics_theme')    },
      // TODO (post-launch): re-enable when implemented
      // { icon: '🎵', label: 'Music',         sub: 'Swap the soundtrack',      action: null },
      // { icon: '🎁', label: 'Mystery Box',   sub: 'Random rare items',        action: null },
    ];

    cats.forEach((cat, i) => {
      const py = oy + 178 + i * 88;
      const card = mk(this.add.rectangle(cx, py, cw - 32, 82, 0x0a0018)
        .setStrokeStyle(1, 0x6611aa, 0.40).setDepth(d).setVisible(false)
        .setInteractive({ useHandCursor: true }));

      mk(this.add.text(cx - (cw - 32) / 2 + 28, py, cat.icon, {
        fontSize: '28px', fontFamily: 'Arial',
      }).setOrigin(0.5).setDepth(d + 1).setVisible(false));

      mk(this.add.text(cx - (cw - 32) / 2 + 62, py - 12, cat.label, {
        fontSize: '18px', fontFamily: 'Arial Black', color: '#9944dd',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0, 0.5).setDepth(d + 1).setVisible(false));

      mk(this.add.text(cx - (cw - 32) / 2 + 62, py + 12, cat.sub, {
        fontSize: '12px', fontFamily: 'Arial', color: '#445566',
      }).setOrigin(0, 0.5).setDepth(d + 1).setVisible(false));

      mk(this.add.text(cx + (cw - 32) / 2 - 14, py, cat.action ? '›' : 'SOON', {
        fontSize: cat.action ? '28px' : '11px', fontFamily: 'Arial Black',
        color: cat.action ? '#9944dd' : '#2a3a44',
      }).setOrigin(1, 0.5).setDepth(d + 1).setVisible(false));

      card.on('pointerover', () => card.setStrokeStyle(2, 0x6611aa, 0.8));
      card.on('pointerout',  () => card.setStrokeStyle(1, 0x6611aa, 0.40));
      if (cat.action) card.on('pointerdown', () => { this._sfx(); cat.action(); });
    });
  }

  // ── GENERIC COSMETIC PAGE BUILDER ──────────────────────────────────────────
  // Builds a store page for any cosmetic category from a page config object.
  // Adds page.objs, page.cardRefs, page.coinTxt, page.msgTxt to the config —
  // used later by _navTo, _handleCosmeticAction, and _refreshCosmeticCards.
  // To add a new category: add an entry to _cosmeticPages in _buildStoreOverlay.
  _buildStoreCosmeticPage(d, oy, oh, cw, cx, page) {
    const objs = [];
    const cardRefs = [];
    const mk = o => { objs.push(o); return o; };

    mk(this._backBtn(cx, oy + 36, d, () => this._navTo('cosmetics')));

    mk(this.add.text(cx, oy + 78, page.title, {
      fontSize: '26px', fontFamily: 'Arial Black',
      color: '#9944dd', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(d).setVisible(false));

    mk(this.add.rectangle(cx, oy + 106, cw - 40, 1, 0x6611aa, 0.15).setDepth(d).setVisible(false));

    // SPRITE SWAP POINT — replace color disc with sprite thumbnail when real assets exist
    page.coinTxt = mk(this.add.text(cx, oy + 130, '', {
      fontSize: '16px', fontFamily: 'Arial Black', color: '#ddaa00',
    }).setOrigin(0.5).setDepth(d).setVisible(false));

    page.msgTxt = mk(this.add.text(cx, oy + oh - 50, '', {
      fontSize: '14px', fontFamily: 'Arial Black', color: '#00cc77',
    }).setOrigin(0.5).setDepth(d).setVisible(false));

    let _openInfoPanel;  // assigned after the info panel is built below

    page.data.forEach((item, i) => {
      const py    = oy + 166 + i * 108;
      const cardW = cw - 32;
      // Available text width: between the icon on the left and the action button on the right
      const descW = cardW - 180;
      const rcCol   = parseInt(item.rc.slice(1), 16);
      const discCol = item.tint === 0xffffff ? rcCol : item.tint;
      const isGrey  = discCol === 0xaaaaaa;

      const card = mk(this.add.rectangle(cx, py, cardW, 96, 0x0a0018)
        .setStrokeStyle(1, 0x6611aa, 0.40).setDepth(d).setVisible(false)
        .setInteractive({ useHandCursor: true }));

      if (item.spriteKey) {
        mk(this.add.image(cx - cardW / 2 + 36, py, item.spriteKey + 'Alive')
          .setDisplaySize(50, 50).setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(d + 1).setVisible(false));
      } else {
        mk(this.add.circle(cx - cardW / 2 + 36, py, 25, discCol, isGrey ? 0.45 : 0.85)
          .setDepth(d + 1).setVisible(false));
        mk(this.add.circle(cx - cardW / 2 + 36, py, 25, 0x000000, 0)
          .setStrokeStyle(1.5, discCol, isGrey ? 0.35 : 0.7).setDepth(d + 2).setVisible(false));
      }

      mk(this.add.text(cx - cardW / 2 + 74, py - 26, item.name, {
        fontSize: '15px', fontFamily: 'Arial Black', color: '#dddddd',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0, 0.5).setDepth(d + 1).setVisible(false));

      // desc: word-wrapped, top-aligned — expands downward within the card without overflowing
      mk(this.add.text(cx - cardW / 2 + 74, py - 10, item.desc, {
        fontSize: '10px', fontFamily: 'Arial', color: '#8899aa',
        wordWrap: { width: descW, useAdvancedWrap: false },
        lineSpacing: 2,
      }).setOrigin(0, 0).setDepth(d + 1).setVisible(false));

      mk(this.add.rectangle(cx - cardW / 2 + 68, py + 30, 6, 6, parseInt(item.rc.slice(1), 16))
        .setAngle(45).setDepth(d + 2).setVisible(false));
      mk(this.add.text(cx - cardW / 2 + 80, py + 30, item.rarity.toUpperCase(), {
        fontSize: '10px', fontFamily: 'Arial Black', color: item.rc,
      }).setOrigin(0, 0.5).setDepth(d + 1).setVisible(false));

      const actionBtn = mk(this.add.rectangle(cx + cardW / 2 - 52, py, 86, 38, 0x1a0030)
        .setStrokeStyle(1, 0x6611aa, 0.7).setDepth(d + 1).setVisible(false)
        .setInteractive({ useHandCursor: true }));

      const actionTxt = mk(this.add.text(cx + cardW / 2 - 52, py,
        item.price === 0 ? 'EQUIP' : `${item.price.toLocaleString()} ⬡`, {
          fontSize: '12px', fontFamily: 'Arial Black', color: '#aa55ee',
          stroke: '#000', strokeThickness: 1,
        }).setOrigin(0.5).setDepth(d + 2).setVisible(false));

      cardRefs.push({ card, actionBtn, actionTxt });

      card.on('pointerover', () => card.setStrokeStyle(2, 0x9944dd, 0.8));
      card.on('pointerout',  () => card.setStrokeStyle(1, 0x6611aa, 0.40));
      actionBtn.on('pointerdown', () => {
        this._sfx();
        const _owned = (localStorage.getItem(page.ownedKey) || 'default').split(',');
        if (_owned.includes(item.key)) this._handleCosmeticAction(item, page);
        else _openInfoPanel?.(item);
      });
    });

    // ── INFO PANEL OVERLAY ─────────────────────────────────────────────────────
    const iobjs = [];
    const mki   = o => { iobjs.push(o); return o; };
    const ipCY  = oy + oh * 0.50;
    const ipW   = cw - 44;
    const ipH   = 300;

    mki(this.add.rectangle(cx, oy + oh * 0.5, cw, oh, 0x000000, 0.92)
      .setDepth(d + 10).setVisible(false).setInteractive());
    mki(this.add.rectangle(cx, ipCY, ipW, ipH, 0x0a0018)
      .setStrokeStyle(2, 0x9944dd, 0.7).setDepth(d + 11).setVisible(false));

    const ipClose = mki(this.add.text(cx + ipW / 2 - 18, ipCY - ipH / 2 + 22, '✕', {
      fontSize: '16px', fontFamily: 'Arial Black', color: '#887799',
    }).setOrigin(0.5).setDepth(d + 12).setVisible(false).setInteractive({ useHandCursor: true }));

    const ipName = mki(this.add.text(cx, ipCY - ipH / 2 + 46, '', {
      fontSize: '22px', fontFamily: 'Arial Black', color: '#cccccc',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(d + 12).setVisible(false));

    const ipRarity = mki(this.add.text(cx, ipCY - ipH / 2 + 76, '', {
      fontSize: '11px', fontFamily: 'Arial Black',
    }).setOrigin(0.5).setDepth(d + 12).setVisible(false));

    const ipDesc = mki(this.add.text(cx, ipCY - ipH / 2 + 102, '', {
      fontSize: '12px', fontFamily: 'Arial', color: '#667788',
      wordWrap: { width: ipW - 40 }, align: 'center',
    }).setOrigin(0.5).setDepth(d + 12).setVisible(false));

    mki(this.add.text(cx, ipCY - ipH / 2 + 134, '— SPECIAL EFFECTS —', {
      fontSize: '10px', fontFamily: 'Arial Black', color: '#553366',
    }).setOrigin(0.5).setDepth(d + 12).setVisible(false));

    const ipEff1 = mki(this.add.text(cx, ipCY - ipH / 2 + 156, '', {
      fontSize: '14px', fontFamily: 'Arial Black',
    }).setOrigin(0.5).setDepth(d + 12).setVisible(false));

    const ipEff2 = mki(this.add.text(cx, ipCY - ipH / 2 + 179, '', {
      fontSize: '14px', fontFamily: 'Arial Black', color: '#00ddbb',
    }).setOrigin(0.5).setDepth(d + 12).setVisible(false));

    mki(this.add.rectangle(cx, ipCY - ipH / 2 + 204, ipW - 50, 1, 0x553366, 0.5)
      .setDepth(d + 12).setVisible(false));

    const ipPrice = mki(this.add.text(cx, ipCY - ipH / 2 + 224, '', {
      fontSize: '20px', fontFamily: 'Arial Black', color: '#ddaa00',
    }).setOrigin(0.5).setDepth(d + 12).setVisible(false));

    const ipActBtn = mki(this.add.rectangle(cx, ipCY - ipH / 2 + 267, 180, 40, 0x220044)
      .setStrokeStyle(1.5, 0x9944dd, 0.9).setDepth(d + 12).setVisible(false)
      .setInteractive({ useHandCursor: true }));

    const ipActTxt = mki(this.add.text(cx, ipCY - ipH / 2 + 267, '', {
      fontSize: '14px', fontFamily: 'Arial Black', color: '#bb66ee',
    }).setOrigin(0.5).setDepth(d + 13).setVisible(false));

    const _closeInfo = () => iobjs.forEach(o => o.setVisible(false));

    _openInfoPanel = (item) => {
      ipName.setText(item.name);
      ipRarity.setText(`◆  ${item.rarity.toUpperCase()}  ◆`).setColor(item.rc);
      ipDesc.setText(item.desc);

      const effs = [];
      if (item.speedBonus) effs.push(`⚡  +${item.speedBonus}%  Speed`);
      if (item.armorBonus) effs.push(`🛡  +${item.armorBonus}%  Damage Resistance`);
      ipEff1.setText(effs[0] ?? 'No special effects').setColor(effs.length ? '#00ddbb' : '#334455');

      ipPrice.setText(item.price === 0 ? 'FREE' : `${item.price.toLocaleString()} ⬡`);

      const _ownedNow  = (localStorage.getItem(page.ownedKey) || 'default').split(',');
      const _activeNow = localStorage.getItem(page.activeKey) || 'default';
      if (item.key === _activeNow) {
        ipActTxt.setText('✓ EQUIPPED').setColor('#00cc66');
        ipActBtn.setFillStyle(0x002200).setStrokeStyle(1.5, 0x00cc66, 0.9);
      } else if (_ownedNow.includes(item.key)) {
        ipActTxt.setText('EQUIP').setColor('#00aa44');
        ipActBtn.setFillStyle(0x001100).setStrokeStyle(1.5, 0x00aa44, 0.9);
      } else {
        ipActTxt.setText('BUY NOW').setColor('#bb66ee');
        ipActBtn.setFillStyle(0x220044).setStrokeStyle(1.5, 0x9944dd, 0.9);
      }

      ipActBtn.removeAllListeners('pointerdown');
      ipActBtn.on('pointerdown', () => {
        this._sfx();
        this._handleCosmeticAction(item, page);
        const o2 = (localStorage.getItem(page.ownedKey) || 'default').split(',');
        const a2 = localStorage.getItem(page.activeKey) || 'default';
        if (item.key === a2) {
          ipActTxt.setText('✓ EQUIPPED').setColor('#00cc66');
          ipActBtn.setFillStyle(0x002200).setStrokeStyle(1.5, 0x00cc66, 0.9);
        } else if (o2.includes(item.key)) {
          ipActTxt.setText('EQUIP').setColor('#00aa44');
          ipActBtn.setFillStyle(0x001100).setStrokeStyle(1.5, 0x00aa44, 0.9);
        }
      });

      iobjs.forEach(o => o.setVisible(true));
      ipEff2.setText(effs[1] ?? '').setVisible(effs.length > 1);
    };

    ipClose.on('pointerdown', () => { this._sfx(); _closeInfo(); });

    page.infoPanelObjs  = iobjs;
    page.closeInfoPanel = _closeInfo;
    page.objs     = objs;
    page.cardRefs = cardRefs;
  }

  _handleCosmeticAction(item, page) {
    const owned = (localStorage.getItem(page.ownedKey) || 'default').split(',');
    if (owned.includes(item.key)) {
      localStorage.setItem(page.activeKey, item.key);
      this._refreshCosmeticCards(page);
      return;
    }
    const coins = parseInt(localStorage.getItem(STORAGE_COINS) || '0', 10);
    if (coins < item.price) {
      page.msgTxt.setColor('#cc0077').setText('Not enough coins!');
      this.time.delayedCall(1800, () => page.msgTxt?.setText(''));
      return;
    }
    const newCoins = coins - item.price;
    localStorage.setItem(STORAGE_COINS, newCoins);
    owned.push(item.key);
    localStorage.setItem(page.ownedKey, owned.join(','));
    localStorage.setItem(page.activeKey, item.key);
    this._refreshAllCoinTxt(newCoins);
    page.msgTxt.setColor('#00cc77').setText(`${item.name} unlocked & equipped!`);
    this.time.delayedCall(2000, () => page.msgTxt?.setText(''));
    this._refreshCosmeticCards(page);
  }

  _refreshCosmeticCards(page) {
    const owned = (localStorage.getItem(page.ownedKey) || 'default').split(',');
    let active  = localStorage.getItem(page.activeKey) || 'default';
    if (!owned.includes(active)) { active = 'default'; localStorage.setItem(page.activeKey, 'default'); }
    const coins = parseInt(localStorage.getItem(STORAGE_COINS) || '0', 10);
    page.data.forEach((item, i) => {
      const ref = page.cardRefs[i];
      if (!ref) return;
      const isOwned  = owned.includes(item.key);
      const isActive = item.key === active;
      if (isActive) {
        ref.actionBtn.setFillStyle(0x002200).setStrokeStyle(1.5, 0x00cc66, 0.9);
        ref.actionTxt.setText('✓ ACTIVE').setColor('#00cc66').setFontSize('11px');
      } else if (isOwned) {
        ref.actionBtn.setFillStyle(0x001100).setStrokeStyle(1, 0x00aa44, 0.7);
        ref.actionTxt.setText('EQUIP').setColor('#00aa44').setFontSize('13px');
      } else {
        ref.actionBtn.setFillStyle(0x1a0030).setStrokeStyle(1, 0x9944dd, 0.7);
        ref.actionTxt.setText('INFO').setColor('#9944dd').setFontSize('13px');
      }
    });
  }

  // ── STORE NAVIGATION ───────────────────────────────────────────────────────

  _refreshAllCoinTxt(n) {
    const s = n.toLocaleString();
    this._menuCoinTxt?.setText(`⬡ ${s} coins`);
    this._storeCoinBadge?.setText(`⬡ ${s}`);
    this._storeMainCoinTxt?.setText(`⬡ ${s}  coins`);
    this._coinsPageBalTxt?.setText(`Your balance:  ⬡ ${s}`);
    this._livesCoinsDisplay?.setText(`⬡ ${s}  coins`);
    this._cosmeticPages?.forEach(p => p.coinTxt?.setText(`Your balance:  ⬡ ${s}`));
  }

  _navTo(page) {
    this._storeMainObjs.forEach(o => o.setVisible(false));
    this._storeCoinsObjs.forEach(o => o.setVisible(false));
    this._storeCoinsConfirmObjs?.forEach(o => o.setVisible(false));
    this._storeLivesObjs.forEach(o => o.setVisible(false));
    this._storeCosmeticsObjs.forEach(o => o.setVisible(false));
    this._cosmeticPages?.forEach(p => {
      p.objs?.forEach(o => o.setVisible(false));
      p.infoPanelObjs?.forEach(o => o.setVisible(false));
    });

    const coins = parseInt(localStorage.getItem(STORAGE_COINS) || '0', 10);
    this._storeCoinBadge?.setText(`⬡ ${coins.toLocaleString()}`);

    if (page === 'main') {
      this._storeMainCoinTxt.setText(`⬡ ${coins.toLocaleString()}  coins`);
      this._storeMainObjs.forEach(o => o.setVisible(true));
    } else if (page === 'coins') {
      this._coinsPageBalTxt.setText(`Your balance:  ⬡ ${coins.toLocaleString()}`);
      this._storeCoinsObjs.forEach(o => o.setVisible(true));
    } else if (page === 'lives') {
      const lives = parseInt(localStorage.getItem(STORAGE_LIVES) || '0', 10);
      this._livesCoinsDisplay.setText(`⬡ ${coins.toLocaleString()}  coins`);
      this._livesDisplay.setText(`♥  ${lives}  extra lives`);
      this._livesNotEnoughTxt.setText('');
      this._storeLivesObjs.forEach(o => o.setVisible(true));
    } else if (page === 'cosmetics') {
      this._storeCosmeticsObjs.forEach(o => o.setVisible(true));
    } else {
      const cosPage = this._cosmeticPages?.find(p => p.route === page);
      if (cosPage) {
        cosPage.coinTxt.setText(`Your balance:  ⬡ ${coins.toLocaleString()}`);
        cosPage.msgTxt.setText('');
        this._refreshCosmeticCards(cosPage);
        cosPage.objs.forEach(o => o.setVisible(true));
      }
    }
  }

  _purchaseLife(lives, cost) {
    const coins = parseInt(localStorage.getItem(STORAGE_COINS) || '0', 10);
    if (coins < cost) {
      this._livesNotEnoughTxt.setColor('#cc0077').setText('Not enough coins!');
      this.time.delayedCall(1800, () => this._livesNotEnoughTxt.setText(''));
      return;
    }
    const newCoins  = coins - cost;
    const newLives  = parseInt(localStorage.getItem(STORAGE_LIVES) || '0', 10) + lives;
    localStorage.setItem(STORAGE_COINS, newCoins);
    localStorage.setItem(STORAGE_LIVES,  newLives);
    this._refreshAllCoinTxt(newCoins);
    this._livesDisplay.setText(`♥  ${newLives}  extra lives`);
    const msg = lives === 1 ? '♥ Life added!' : `♥ ${lives} Lives added!`;
    this._livesNotEnoughTxt.setColor('#00cc77').setText(msg);
    this.time.delayedCall(1800, () => this._livesNotEnoughTxt.setText(''));
  }

  _backBtn(cx, y, d, action) {
    const btn = this.add.text(cx - (W - 28) / 2 + 16, y, '‹  BACK', {
      fontSize: '17px', fontFamily: 'Arial Black', color: '#2a3a44',
    }).setOrigin(0, 0.5).setDepth(d).setVisible(false).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setColor('#6688aa'));
    btn.on('pointerout',  () => btn.setColor('#2a3a44'));
    btn.on('pointerdown', () => { this._sfx(); action(); });
    return btn;
  }

  _openStore() {
    this.storeOpen = true;
    this._storeDim.setVisible(true);
    this._storePanel.setVisible(true);
    this._storeCoinBadge.setVisible(true);
    this._navTo('main');
  }

  _closeStore() {
    const coins = parseInt(localStorage.getItem(STORAGE_COINS) || '0', 10);
    this._menuCoinTxt?.setText(`⬡ ${coins.toLocaleString()} coins`);
    this._storeDim.setVisible(false);
    this._storePanel.setVisible(false);
    this._storeCoinBadge.setVisible(false);
    this._storeMainObjs.forEach(o => o.setVisible(false));
    this._storeCoinsObjs.forEach(o => o.setVisible(false));
    this._storeCoinsConfirmObjs?.forEach(o => o.setVisible(false));
    this._storeLivesObjs.forEach(o => o.setVisible(false));
    this._storeCosmeticsObjs.forEach(o => o.setVisible(false));
    this._cosmeticPages?.forEach(p => {
      p.objs?.forEach(o => o.setVisible(false));
      p.infoPanelObjs?.forEach(o => o.setVisible(false));
    });
    this.time.delayedCall(50, () => { this.storeOpen = false; });
  }

  // ── SETTINGS OVERLAY ───────────────────────────────────────────────────────

  _buildSettingsOverlay() {
    const d  = 10;
    const oy = H * 0.07;
    const oh = H * 0.84;
    const cw = W - 28;
    const cx = W / 2;
    this._settingsObjs = [];
    const mk = o => { this._settingsObjs.push(o); return o; };

    mk(this.add.rectangle(cx, H / 2, W, H, 0x000000, 0.92)
      .setDepth(d).setVisible(false).setInteractive());
    mk(this.add.rectangle(cx, oy + oh / 2, cw, oh, 0x040408)
      .setStrokeStyle(1.5, 0x445566, 0.7).setDepth(d).setVisible(false));
    mk(this.add.text(cx, oy + 36, '⚙  SETTINGS', {
      fontSize: '26px', fontFamily: 'Arial Black',
      color: '#6688aa', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(d).setVisible(false));
    mk(this.add.rectangle(cx, oy + 64, cw - 40, 1, 0x445566, 0.25).setDepth(d).setVisible(false));

    // Volume sliders
    this._buildVolumeSlider(mk, cx, oy + 175, d + 1, '🎵  MUSIC',
      STORAGE_VOL_MUSIC, STORAGE_MUTE_MUSIC, 0.7,
      (vol, muted) => { this._menuMusic?.setVolume(muted ? 0 : vol); });

    this._buildVolumeSlider(mk, cx, oy + 340, d + 1, '🔊  SFX',
      STORAGE_VOL_SFX, STORAGE_MUTE_SFX, 0.7, () => {});

    // ── PARTICLE TRAIL TOGGLE ─────────────────────────────────────────────────
    const trkW  = W - 100;
    const trkL  = cx - trkW / 2;
    const trkR  = cx + trkW / 2;
    const trlY  = oy + 432;
    let   trlOn = localStorage.getItem(STORAGE_TRAIL) !== '0';

    mk(this.add.text(trkL, trlY, '✦  PARTICLE TRAIL', {
      fontSize: '17px', fontFamily: 'Arial Black', color: '#6688aa',
    }).setOrigin(0, 0.5).setDepth(d + 1).setVisible(false));

    const trlBg = mk(this.add.rectangle(trkR - 40, trlY, 82, 34,
      trlOn ? 0x001122 : 0x111111)
      .setStrokeStyle(1.5, trlOn ? 0x0088bb : 0x334455, trlOn ? 0.8 : 0.5)
      .setDepth(d + 1).setVisible(false).setInteractive({ useHandCursor: true }));

    const trlTxt = mk(this.add.text(trkR - 40, trlY, trlOn ? 'ON' : 'OFF', {
      fontSize: '15px', fontFamily: 'Arial Black',
      color: trlOn ? '#00ccff' : '#334455',
    }).setOrigin(0.5).setDepth(d + 2).setVisible(false));

    trlBg.on('pointerdown', () => {
      if (!this.settingsOpen) return;
      trlOn = !trlOn;
      localStorage.setItem(STORAGE_TRAIL, trlOn ? '1' : '0');
      trlBg.setFillStyle(trlOn ? 0x001122 : 0x111111);
      trlBg.setStrokeStyle(1.5, trlOn ? 0x0088bb : 0x334455, trlOn ? 0.8 : 0.5);
      trlTxt.setText(trlOn ? 'ON' : 'OFF').setColor(trlOn ? '#00ccff' : '#334455');
    });

    // ── CUSTOMIZE ─────────────────────────────────────────────────────────────
    mk(this.add.rectangle(cx, oy + 490, cw - 40, 1, 0x445566, 0.20).setDepth(d).setVisible(false));

    mk(this.add.text(cx - (cw - 40) / 2, oy + 522, '✦  CUSTOMIZE', {
      fontSize: '17px', fontFamily: 'Arial Black', color: '#6611aa',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0, 0.5).setDepth(d).setVisible(false));

    const customizeBtn = mk(this.add.rectangle(cx, oy + 590, cw - 32, 70, 0x0a0018)
      .setStrokeStyle(1.2, 0x6611aa, 0.45).setDepth(d).setVisible(false)
      .setInteractive({ useHandCursor: true }));

    mk(this.add.text(cx, oy + 582, '✦  Manage active cosmetics', {
      fontSize: '16px', fontFamily: 'Arial Black', color: '#9944dd',
    }).setOrigin(0.5).setDepth(d + 1).setVisible(false));

    mk(this.add.text(cx, oy + 604, 'Enable skins, effects & themes', {
      fontSize: '12px', fontFamily: 'Arial', color: '#445566',
    }).setOrigin(0.5).setDepth(d + 1).setVisible(false));

    customizeBtn.on('pointerover', () => customizeBtn.setStrokeStyle(2, 0x9944dd, 0.9));
    customizeBtn.on('pointerout',  () => customizeBtn.setStrokeStyle(1.2, 0x6611aa, 0.45));
    customizeBtn.on('pointerdown', () => { this._sfx(); this._closeSettings(); this._openStore(); this._navTo('cosmetics'); });

    const closeBtn = mk(this.add.text(cx, oy + oh - 28, '✕  CLOSE', {
      fontSize: '18px', fontFamily: 'Arial Black', color: '#2a3a44',
    }).setOrigin(0.5).setDepth(d).setVisible(false).setInteractive({ useHandCursor: true }));
    closeBtn.on('pointerover', () => closeBtn.setColor('#6688aa'));
    closeBtn.on('pointerout',  () => closeBtn.setColor('#2a3a44'));
    closeBtn.on('pointerdown', () => { this._sfx(); this._closeSettings(); });
  }

  _buildVolumeSlider(mk, cx, cy, d, label, volKey, mutKey, defaultVol, onChange) {
    const trackW    = W - 100;
    const trackLeft = cx - trackW / 2;
    const trackRight = cx + trackW / 2;

    let vol   = parseFloat(localStorage.getItem(volKey));
    let muted = localStorage.getItem(mutKey) === '1';
    if (isNaN(vol) || vol < 0 || vol > 1) vol = defaultVol;

    const activeColor  = 0x0088bb;
    const mutedColor   = 0x334455;
    const thumbActive  = 0x00aacc;
    const thumbMuted   = 0x445566;

    const lbl = mk(this.add.text(trackLeft, cy - 38, label, {
      fontSize: '17px', fontFamily: 'Arial Black',
      color: muted ? '#334455' : '#6688aa',
    }).setOrigin(0, 0.5).setDepth(d).setVisible(false));

    const muteIcon = mk(this.add.text(trackRight, cy - 38, muted ? '🔇' : '🔊', {
      fontSize: '24px', fontFamily: 'Arial',
    }).setOrigin(1, 0.5).setDepth(d).setVisible(false)
      .setInteractive({ useHandCursor: true }));

    const pctTxt = mk(this.add.text(cx, cy + 30, `${Math.round(vol * 100)}%`, {
      fontSize: '13px', fontFamily: 'Arial', color: '#445566',
    }).setOrigin(0.5).setDepth(d).setVisible(false));

    mk(this.add.rectangle(cx, cy, trackW, 6, 0x1a2a3a).setDepth(d).setVisible(false));

    const fill = mk(this.add.rectangle(trackLeft, cy, trackW * vol, 6,
      muted ? mutedColor : activeColor).setOrigin(0, 0.5).setDepth(d + 1).setVisible(false));

    const thumb = mk(this.add.circle(trackLeft + trackW * vol, cy, 13,
      muted ? thumbMuted : thumbActive).setDepth(d + 2).setVisible(false)
      .setInteractive({ useHandCursor: true, draggable: true }));

    // Wide invisible zone makes the track easy to click
    const zone = mk(this.add.rectangle(cx, cy, trackW, 40, 0x000000, 0)
      .setDepth(d + 1).setVisible(false).setInteractive({ useHandCursor: true }));

    const applyVol = (ratio) => {
      vol = Phaser.Math.Clamp(ratio, 0, 1);
      thumb.x         = trackLeft + trackW * vol;
      fill.width      = trackW * vol;
      pctTxt.setText(`${Math.round(vol * 100)}%`);
      localStorage.setItem(volKey, vol.toFixed(3));
      onChange(vol, muted);
    };

    const applyMute = () => {
      muteIcon.setText(muted ? '🔇' : '🔊');
      lbl.setColor(muted ? '#334455' : '#6688aa');
      fill.setFillStyle(muted ? mutedColor : activeColor);
      thumb.setFillStyle(muted ? thumbMuted : thumbActive);
      localStorage.setItem(mutKey, muted ? '1' : '0');
      onChange(vol, muted);
    };

    thumb.on('drag', (ptr, dragX) => {
      if (!this.settingsOpen) return;
      applyVol((Phaser.Math.Clamp(dragX, trackLeft, trackRight) - trackLeft) / trackW);
    });

    zone.on('pointerdown', (ptr) => {
      if (!this.settingsOpen) return;
      applyVol((Phaser.Math.Clamp(ptr.x, trackLeft, trackRight) - trackLeft) / trackW);
    });

    muteIcon.on('pointerdown', () => {
      if (!this.settingsOpen) return;
      muted = !muted;
      applyMute();
    });
  }

  _openSettings() {
    this.settingsOpen = true;
    this._settingsObjs.forEach(o => o.setVisible(true));
  }

  _closeSettings() {
    this._settingsObjs.forEach(o => o.setVisible(false));
    this.time.delayedCall(50, () => { this.settingsOpen = false; });
  }

  // ── INTERACTION ────────────────────────────────────────────────────────────

  _buildAbyssPanel() {
    const d = 20;
    const objs = [];
    const mk = o => { objs.push(o); return o; };

    mk(this.add.rectangle(W / 2, H / 2, W, H, 0x000010).setAlpha(0.87).setDepth(d).setInteractive());

    const _activeSprKey = (PLAYER_SPRITES.find(s => s.key === (localStorage.getItem(STORAGE_ACTIVE_SPRITE) || 'default')) ?? PLAYER_SPRITES[0]).spriteKey;
    mk(this.add.image(W / 2, H * 0.42, _activeSprKey + 'Alive')
      .setAlpha(0.07).setScale(2.6).setDepth(d + 1)
      .setBlendMode(Phaser.BlendModes.ADD));

    mk(this.add.text(W / 2, H * 0.345, 'ENTER', {
      fontSize: '40px', fontFamily: 'Arial Black',
      color: '#0088bb', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(d + 2));

    mk(this.add.text(W / 2, H * 0.46, 'THE ABYSS', {
      fontSize: '68px', fontFamily: 'Arial Black',
      color: '#cc0077', stroke: '#0088bb', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(d + 2));

    mk(this.add.rectangle(W / 2, H * 0.56, W * 0.62, 1.5, 0x0088bb).setAlpha(0.35).setDepth(d + 2));

    const hint = mk(this.add.text(W / 2, H * 0.64, '▼  tap to descend  ▼', {
      fontSize: '18px', fontFamily: 'Arial Black',
      color: '#2a3a44', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(d + 2));
    this.tweens.add({ targets: hint, alpha: 0.18, yoyo: true, repeat: -1, duration: 720 });

    objs[0].once('pointerdown', () => {
      this.time.delayedCall(10, () => { this.abyssOpen = false; });
      this._startMenuMusic();
      this.tweens.add({
        targets: objs, alpha: 0, duration: 480,
        onComplete: () => objs.forEach(o => o.destroy()),
      });
    });
  }

  _dive() {
    if (this.storeOpen || this.settingsOpen || this.abyssOpen) return;
    this._sfx();
    this.letterObjs.forEach(t => t.setColor('#ffffff'));
    this.time.delayedCall(50, () => {
      this.letterObjs.forEach((t, i) => t.setColor(LETTER_COLORS[i % LETTER_COLORS.length]));
    });
    this.cameras.main.fadeOut(250);
    this.time.delayedCall(250, () => this.scene.start('Game'));
  }

  _sfx() {
    if (this.cache.audio.has('buttonSFX')) this.sound.play('buttonSFX', { volume: 0.7 });
  }

  // ── MUSIC ──────────────────────────────────────────────────────────────────

  _startMenuMusic() {
    if (this._menuMusic || !this.cache.audio.has('mainMenu')) return;
    this._menuMusic = this.sound.add('mainMenu', { volume: 0.7, loop: true });
    this._menuMusic.play();
    if (this.sound.locked) this.sound.once('unlocked', () => {
      if (!this._menuMusic?.isPlaying) this._menuMusic?.play();
    });
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

  // ── AMBIENT ────────────────────────────────────────────────────────────────

  _spawnBgFish() {
    for (let i = 0; i < 4; i++) {
      const f = this.add.image(
        Phaser.Math.Between(30, W - 30), Phaser.Math.Between(0, H), 'fishAlive'
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
