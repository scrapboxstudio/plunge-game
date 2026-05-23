import {
  W, H, BIOMES, getBiomeIndex,
  DIVER_Y, DIVER_ACCEL, DIVER_DRAG, DIVER_MAX_VX, DIVER_TILT, DIVER_MAX_TILT, DIVER_MARGIN,
  PRESSURE_DECAY, PRESSURE_HIT,
} from '../main.js';

const STORAGE_BEST  = 'plunge_best_time';  // seconds
const STORAGE_COINS = 'plunge_coins';

export default class Game extends Phaser.Scene {
  constructor() { super('Game'); }

  // ── LIFECYCLE ─────────────────────────────────────────────────────────────

  create() {
    // State
    this.depth      = 0;
    this.pressure   = 0;       // 0.0 → 1.0 → death
    this.dead       = false;
    this.invincible = false;
    this.biomeIdx   = 0;
    this.gamePaused = false;
    this.coins      = parseInt(localStorage.getItem(STORAGE_COINS) || '0', 10);

    // Input flags
    this.steerLeft  = false;
    this.steerRight = false;

    this.decorations = [];

    // ── WORLD ────────────────────────────────────────────────────────────────
    this.physics.world.gravity.y = 0;
    this.bg = this.add.rectangle(W / 2, H / 2, W, H, BIOMES[0].bg).setDepth(0);
    this._initAmbientBubbles();

    // ── DIVER ────────────────────────────────────────────────────────────────
    this.diver = this.physics.add.image(W / 2, DIVER_Y, 'diver')
      .setDepth(10).setCollideWorldBounds(false);
    this.diver.setMaxVelocity(DIVER_MAX_VX, 0);

    this.diverGlow = this.add.circle(W / 2, DIVER_Y, 32, 0x44bbff, 0.30)
      .setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: this.diverGlow,
      alpha: 0.10, scaleX: 1.5, scaleY: 1.5,
      yoyo: true, repeat: -1, duration: 900,
    });

    // ── WALLS ────────────────────────────────────────────────────────────────
    this.walls = this.physics.add.staticGroup();
    this.physics.add.overlap(this.diver, this.walls, () => this.onHit(), null, this);

    // ── BUBBLE TRAIL ─────────────────────────────────────────────────────────
    this.trail      = [];
    this.trailTimer = 0;

    // ── VIGNETTE ─────────────────────────────────────────────────────────────
    this.vigSprite = this.add.image(W / 2, H / 2, 'vignette').setDepth(22).setAlpha(0);

    // ── UI ───────────────────────────────────────────────────────────────────
    this._buildUI();
    this._buildPauseOverlay();
    this._buildContinueOverlay();

    // ── INPUT ────────────────────────────────────────────────────────────────
    this.input.on('pointerdown', p => this._handlePointer(p, true));
    this.input.on('pointerup',   () => { this.steerLeft = false; this.steerRight = false; });
    this.input.on('pointermove', p => { if (this.input.activePointer.isDown) this._handlePointer(p, true); });

    // ── TIMERS ───────────────────────────────────────────────────────────────
    this.spawnEvent = this.time.addEvent({
      delay: BIOMES[0].spawnMs,
      callback: this.spawnWallPair,
      callbackScope: this,
      loop: true,
    });

    this.time.addEvent({
      delay: 120,
      callback: this._tick,
      callbackScope: this,
      loop: true,
    });

    this.cameras.main.fadeIn(350);
  }

  // ── INPUT ──────────────────────────────────────────────────────────────────

  _handlePointer(p, down) {
    if (this.gamePaused) return;
    // Ignore taps in the pause button zone (top-right corner of header)
    if (p.x > W - 55 && p.y < 70) return;
    this.steerLeft  = down && p.x < W / 2;
    this.steerRight = down && p.x >= W / 2;
  }

  // ── TICK (every 120ms) ────────────────────────────────────────────────────

  _tick() {
    if (this.dead || this.gamePaused) return;
    const b = BIOMES[this.biomeIdx];
    this.depth    += Math.round(b.fallSpeed / 38);
    this.pressure  = Math.max(this.pressure - PRESSURE_DECAY, 0);
    this._refreshBiome();
  }

  // ── BIOME LOGIC ───────────────────────────────────────────────────────────

  _refreshBiome() {
    const newIdx = getBiomeIndex(this.depth);
    if (newIdx !== this.biomeIdx) {
      this.biomeIdx = newIdx;
      this.spawnEvent.delay   = BIOMES[newIdx].spawnMs;
      this.spawnEvent.elapsed = 0;

      const newVelY = -BIOMES[newIdx].fallSpeed;
      this.walls.getChildren().forEach(w => w.setData('velY', newVelY));
      this.decorations.forEach(e => { if (e.obj?.active) e.obj.setData('velY', newVelY); });

      if (this._biomeTween) this._biomeTween.stop();
      this._biomeTween = this.tweens.add({
        targets: this.biomeTxt, scaleX: 1.5, scaleY: 1.5, yoyo: true, duration: 200,
      });
      const b = BIOMES[newIdx];
      this.bg.setFillStyle(b.bg);
      this.biomeTxt.setText(`▼  ${b.name.toUpperCase()}  ▼`);
      this.tweens.add({ targets: this.vigSprite, alpha: b.lightFade, duration: 1500 });
    }
  }

  // ── OBSTACLE SPAWNING ─────────────────────────────────────────────────────

  spawnWallPair() {
    if (this.dead || this.gamePaused) return;
    const b = BIOMES[this.biomeIdx];

    const halfGap   = b.gapWidth / 2;
    const margin    = halfGap + 15;
    const gapCenter = Phaser.Math.Between(Math.ceil(margin), Math.floor(W - margin));
    const gapStart  = gapCenter - halfGap;
    const gapEnd    = gapCenter + halfGap;
    const wallH     = Phaser.Math.Between(35, 65);
    const spawnY    = H + wallH / 2 + 5;
    const speed     = -b.fallSpeed;
    const pieces    = Phaser.Math.Between(b.minPieces, b.maxPieces);

    this._spawnObstacleZone(0, gapStart, pieces, spawnY, wallH, speed, b.obsColor);
    this._spawnObstacleZone(gapEnd, W, pieces, spawnY, wallH, speed, b.obsColor);

    if (this.biomeIdx >= 2) {
      const count = this.biomeIdx === 3 ? 6 : 3;
      for (let i = 0; i < count; i++) this._addGlowDot(speed);
    }
  }

  _spawnObstacleZone(xStart, xEnd, numPieces, spawnY, wallH, speed, color) {
    const totalW = xEnd - xStart;
    if (totalW < 10) return;

    const crackW = 10, minChunk = 18;
    const obsSpace = totalW - (numPieces - 1) * crackW;

    if (numPieces <= 1 || obsSpace < numPieces * minChunk) {
      this._addWall(xStart, xEnd, spawnY, wallH, speed, color);
      return;
    }

    let x = xStart, remaining = obsSpace;
    for (let i = 0; i < numPieces; i++) {
      const isLast = i === numPieces - 1;
      const chunksLeft = numPieces - i;
      const chunkW = isLast ? remaining : Math.round(
        Phaser.Math.FloatBetween(remaining / chunksLeft * 0.4, remaining / chunksLeft * 1.6)
      );
      const clamped = Phaser.Math.Clamp(chunkW, minChunk, remaining - (chunksLeft - 1) * minChunk);
      this._addWall(x, x + clamped, spawnY, wallH, speed, color);
      x += clamped + (isLast ? 0 : crackW);
      remaining -= clamped;
    }
  }

  _addWall(xStart, xEnd, cy, wallH, velY, color) {
    const w = xEnd - xStart;
    if (w <= 2) return;

    const rect = this.add.rectangle(xStart + w / 2, cy, w, wallH, color).setDepth(6);
    this.physics.add.existing(rect, true);
    this.walls.add(rect);

    const edgeColor = Phaser.Display.Color.IntegerToColor(color).lighten(22).color;
    const edge = this.add.rectangle(xStart + w / 2, cy - wallH / 2 + 5, w, 9, edgeColor).setDepth(7);
    this.physics.add.existing(edge, true);
    this.decorations.push({ obj: edge });

    rect.setData('velY', velY);
    edge.setData('velY', velY);
  }

  _addGlowDot(velY) {
    if (this.decorations.length > 150) return;
    const gd = this.add.image(
      Phaser.Math.Between(10, W - 10),
      H + Phaser.Math.Between(0, 80),
      'glow'
    ).setScale(Phaser.Math.FloatBetween(0.4, 1.9)).setAlpha(0.7).setDepth(4);
    gd.setData('velY', velY);
    this.tweens.add({ targets: gd, alpha: 0.05, yoyo: true, repeat: -1, duration: Phaser.Math.Between(250, 750) });
    this.decorations.push({ obj: gd, isDecor: true });
  }

  // ── HIT / DEATH ───────────────────────────────────────────────────────────

  onHit() {
    if (this.invincible || this.dead) return;
    this.invincible = true;
    this.pressure = Math.min(this.pressure + PRESSURE_HIT, 1.0);

    this.cameras.main.shake(210, 0.018);
    this.hitFlash.setAlpha(0.5);
    this.tweens.add({ targets: this.hitFlash, alpha: 0, duration: 300 });
    this.tweens.add({
      targets: this.diver, alpha: 0, yoyo: true, repeat: 4, duration: 65,
      onComplete: () => { this.diver.alpha = 1; },
    });

    this.time.delayedCall(850, () => { this.invincible = false; });

    if (this.pressure >= 1.0) this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;

    this.cameras.main.shake(380, 0.024);
    this.hitFlash.setAlpha(0.8);
    this.tweens.add({ targets: this.hitFlash, alpha: 0, duration: 700 });

    for (let i = 0; i < 16; i++) {
      const bub = this.add.image(this.diver.x, this.diver.y, 'bubble')
        .setAlpha(0.9).setDepth(15);
      this.tweens.add({
        targets: bub,
        x: this.diver.x + Phaser.Math.Between(-100, 100),
        y: this.diver.y + Phaser.Math.Between(-100, 40),
        alpha: 0, scale: 2.8, duration: 750, ease: 'Power2Out',
      });
    }
    this.diver.setVisible(false);
    this.diverGlow.setVisible(false);

    // Show "Continue?" screen after death animation
    this.time.delayedCall(1000, () => this._showContinue());
  }

  // ── CONTINUE SCREEN ───────────────────────────────────────────────────────

  _showContinue() {
    this._updateCoinLabel();
    this.contObjs.forEach(o => o.setVisible(true));
    this.contCountdown = 10;
    this.contTxt.setText('10');
    this.contEvt = this.time.addEvent({
      delay: 1000,
      callback: () => {
        this.contCountdown--;
        this.contTxt.setText(String(this.contCountdown));
        if (this.contCountdown <= 0) {
          this.contEvt.remove();
          this._goToGameOver();
        }
      },
      loop: true,
    });
  }

  _revive() {
    this.contEvt?.remove();
    this.contObjs.forEach(o => o.setVisible(false));

    // Reset pressure and show diver — keep dead=true so the world stays frozen
    this.pressure   = 0;
    this.invincible = true;
    this.diver.setVisible(true);
    this.diverGlow.setVisible(true);
    this.diver.y    = DIVER_Y;
    this.diver.alpha = 1;

    // Clear all walls + decorations so the player can't respawn inside a barrier
    this.walls.getChildren().slice().forEach(w => w.destroy());
    this.decorations.forEach(e => { if (e.obj?.active) e.obj.destroy(); });
    this.decorations = [];
    this.trail.forEach(e => e.img?.destroy());
    this.trail = [];
    // Give the player a full spawn-interval gap before the first new wall arrives
    this.spawnEvent.elapsed = 0;

    this.cameras.main.flash(300, 0, 100, 255);

    // Blink diver to signal invincibility during countdown
    const blinkTween = this.tweens.add({
      targets: this.diver, alpha: 0.15, yoyo: true, repeat: -1, duration: 160,
    });

    // Countdown overlay — sits over the frozen game so player sees their position
    const d = 65;
    const countBg = this.add.rectangle(W / 2, H / 2, W, 160, 0x000000, 0.65).setDepth(d);
    const readyTxt = this.add.text(W / 2, H / 2 - 68, 'GET READY!', {
      fontSize: '22px', fontFamily: 'Arial Black',
      color: '#aaccff', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(d + 1);
    const countTxt = this.add.text(W / 2, H / 2 + 16, '3', {
      fontSize: '90px', fontFamily: 'Arial Black',
      color: '#00aaff', stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(d + 1);

    const bump = () => this.tweens.add({
      targets: countTxt, scaleX: 1.45, scaleY: 1.45, yoyo: true, duration: 180,
    });
    bump();

    let count = 3;
    const tick = () => {
      count--;
      if (count > 0) {
        countTxt.setText(String(count));
        bump();
        this.time.delayedCall(1000, tick);
      } else {
        countTxt.setText('GO!').setColor('#ffd700');
        bump();
        blinkTween.stop();
        this.diver.alpha = 1;
        this.dead = false;  // unfreeze — obstacles scroll, physics resumes
        this.tweens.add({
          targets: [countBg, readyTxt, countTxt], alpha: 0, duration: 500,
          onComplete: () => { countBg.destroy(); readyTxt.destroy(); countTxt.destroy(); },
        });
        this.time.delayedCall(2000, () => { this.invincible = false; });
      }
    };

    this.time.delayedCall(1000, tick);
  }

  _watchAd() {
    // Pause the countdown while "ad" runs
    this.contEvt?.remove();
    this.contObjs.forEach(o => o.setVisible(false));

    const adTxt = this.add.text(W / 2, H / 2, 'LOADING AD...', {
      fontSize: '20px', fontFamily: 'Arial', color: '#aaccff',
    }).setOrigin(0.5).setDepth(65);

    // TODO: replace with AdMob.showRewardVideo() — call _revive() in the success callback
    this.time.delayedCall(1500, () => { adTxt.destroy(); this._revive(); });
  }

  _useCoins() {
    if (this.coins < 1) return;
    this.coins--;
    localStorage.setItem(STORAGE_COINS, this.coins);
    this._revive();
  }

  _goToGameOver() {
    this.contObjs.forEach(o => o.setVisible(false));
    this.cameras.main.fadeOut(300);
    this.time.delayedCall(300, () => {
      this.scene.start('GameOver', {
        depth: this.depth,
        biome: BIOMES[this.biomeIdx].name,
      });
    });
  }

  // ── PAUSE ─────────────────────────────────────────────────────────────────

  _pause() {
    if (this.dead) return;
    this.gamePaused = true;
    this.steerLeft  = false;
    this.steerRight = false;
    this.time.paused    = true;
    this.physics.pause();
    this._updateCoinLabel();
    this.pauseObjs.forEach(o => o.setVisible(true));
  }

  _resume() {
    this.gamePaused = false;
    this.time.paused    = false;
    this.physics.resume();
    this.pauseObjs.forEach(o => o.setVisible(false));
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  update(time, delta) {
    if (this.gamePaused || this.dead) return;
    const dt = delta / 1000;

    // ── DIVER PHYSICS ─────────────────────────────────────────────
    let vx = this.diver.body.velocity.x;

    if      (this.steerLeft)  vx -= DIVER_ACCEL * dt;
    else if (this.steerRight) vx += DIVER_ACCEL * dt;
    else                      vx *= DIVER_DRAG;

    vx = Phaser.Math.Clamp(vx, -DIVER_MAX_VX, DIVER_MAX_VX);

    this.diver.setVelocityX(vx);
    this.diver.setVelocityY(0);
    this.diver.y = DIVER_Y;

    this.diver.x = Phaser.Math.Clamp(this.diver.x, DIVER_MARGIN, W - DIVER_MARGIN);
    this.diverGlow.x = this.diver.x;

    this.diver.angle = Phaser.Math.Clamp(vx * DIVER_TILT, -DIVER_MAX_TILT, DIVER_MAX_TILT);

    // ── SCROLL OBSTACLES + DECORATIONS ────────────────────────────
    this._scrollGroup(this.walls, dt);
    this._scrollDecorations(dt);

    // ── BUBBLE TRAIL ──────────────────────────────────────────────
    this.trailTimer += delta;
    if (this.trailTimer > 165) {
      this.trailTimer = 0;
      const bub = this.add.image(
        this.diver.x + Phaser.Math.Between(-7, 7),
        this.diver.y + 20, 'bubble'
      ).setAlpha(0.4).setScale(Phaser.Math.FloatBetween(0.25, 0.9)).setDepth(9);
      this.trail.push({ img: bub, life: 1.0 });
    }
    this.trail = this.trail.filter(e => {
      e.life -= dt * 1.5;
      e.img.y -= 30 * dt;
      e.img.alpha = e.life * 0.4;
      if (e.life <= 0) { e.img.destroy(); return false; }
      return true;
    });

    // ── AMBIENT BUBBLES ───────────────────────────────────────────
    this.ambients.forEach(a => {
      a.y -= a.spd * dt;
      if (a.y < -15) { a.y = H + 15; a.x = Phaser.Math.Between(0, W); }
    });

    // ── DAMAGE BAR ───────────────────────────────────────────────
    const pct = Phaser.Math.Clamp(this.pressure, 0, 1);
    this.pBar.width = (W - 40) * pct;
    this.pBar.setFillStyle(
      pct < 0.5  ? 0x00cc66 :
      pct < 0.78 ? 0xff9900 :
                   0xff2200
    );

    // ── DEPTH DISPLAY ────────────────────────────────────────────
    this.depthTxt.setText(this.depth + 'm');

    if (this.pressure >= 1.0) this.die();
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────

  _fmt(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  _updateCoinLabel() {
    if (this.coinLbl) this.coinLbl.setText(`⬡ ${this.coins} coins`);
    if (this.useCoinBtn) {
      const hasCoins = this.coins > 0;
      this.useCoinBtn.setFillStyle(hasCoins ? 0x0055bb : 0x222222);
      if (this.useCoinTxt) this.useCoinTxt.setColor(hasCoins ? '#ffffff' : '#555555');
    }
  }

  _scrollGroup(group, dt) {
    const toDestroy = [];
    group.getChildren().forEach(child => {
      const velY = child.getData('velY');
      if (velY !== undefined) {
        child.y += velY * dt;
        if (child.body) child.body.reset(child.x, child.y);
      }
      if (child.y < -200) toDestroy.push(child);
    });
    toDestroy.forEach(c => c.destroy());
  }

  _scrollDecorations(dt) {
    this.decorations = this.decorations.filter(entry => {
      const obj = entry.obj;
      if (!obj || !obj.active) return false;
      obj.y += (obj.getData('velY') || 0) * dt;
      if (obj.body) obj.body.reset(obj.x, obj.y);
      if (obj.y < -200) { obj.destroy(); return false; }
      return true;
    });
  }

  _initAmbientBubbles() {
    this.ambients = [];
    for (let i = 0; i < 18; i++) {
      const a = this.add.image(
        Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 'bubble'
      ).setAlpha(0.22).setScale(Phaser.Math.FloatBetween(0.3, 1.8)).setDepth(1);
      a.spd = Phaser.Math.FloatBetween(18, 60);
      this.ambients.push(a);
    }
  }

  // ── UI BUILDERS ───────────────────────────────────────────────────────────

  _buildUI() {
    // Header strip
    this.add.rectangle(W / 2, 0, W, 92, 0x000000, 0.5).setOrigin(0.5, 0).setDepth(28);

    // Damage bar
    this.add.rectangle(20, 14, W - 40, 13, 0x000d1a).setOrigin(0, 0).setDepth(29);
    this.pBar = this.add.rectangle(20, 14, 0, 13, 0x00cc66).setOrigin(0, 0).setDepth(30);
    this.add.text(W / 2, 20, 'DAMAGE', {
      fontSize: '9px', fontFamily: 'Arial', color: '#334455',
    }).setOrigin(0.5).setDepth(31);

    // Depth counter
    this.depthTxt = this.add.text(W / 2, 40, '0m', {
      fontSize: '30px', fontFamily: 'Arial Black',
      color: '#ffffff', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(30);

    // Biome label
    this.biomeTxt = this.add.text(W / 2, 70, `▼  ${BIOMES[0].name.toUpperCase()}  ▼`, {
      fontSize: '12px', fontFamily: 'Arial', color: '#4488aa',
    }).setOrigin(0.5).setDepth(30);

    // Pause button — top right, 44×44 touch target
    const pauseBtn = this.add.rectangle(W - 30, 46, 44, 44, 0xffffff, 0).setDepth(35).setInteractive();
    this.add.text(W - 30, 46, 'II', {
      fontSize: '18px', fontFamily: 'Arial Black', color: '#aabbcc',
    }).setOrigin(0.5).setDepth(36);
    pauseBtn.on('pointerdown', () => this._pause());

    // Hit flash
    this.hitFlash = this.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 0).setDepth(50);
  }

  _buildPauseOverlay() {
    const d = 55;
    const bg   = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75).setDepth(d);
    const title = this.add.text(W / 2, H * 0.28, 'PAUSED', {
      fontSize: '52px', fontFamily: 'Arial Black', color: '#ffffff',
    }).setOrigin(0.5).setDepth(d + 1);

    this.coinLbl = this.add.text(W / 2, H * 0.42, `⬡ ${this.coins} coins`, {
      fontSize: '20px', fontFamily: 'Arial', color: '#ffcc00',
    }).setOrigin(0.5).setDepth(d + 1);

    const resumeBtn = this._makeBtn(W / 2, H * 0.54, 'RESUME', 240, 60, 0x0055bb, 0x0077ff, 28, d + 1,
      () => this._resume());

    const quitBtn = this._makeBtn(W / 2, H * 0.68, 'QUIT TO MENU', 240, 55, 0x220000, 0x440000, 22, d + 1,
      () => {
        this._resume();
        this.cameras.main.fadeOut(250);
        this.time.delayedCall(250, () => this.scene.start('Menu'));
      });

    this.pauseObjs = [bg, title, this.coinLbl, ...resumeBtn, ...quitBtn];
    this.pauseObjs.forEach(o => o.setVisible(false));
  }

  _buildContinueOverlay() {
    const d = 60;
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.85).setDepth(d);

    const title = this.add.text(W / 2, H * 0.17, 'CONTINUE?', {
      fontSize: '46px', fontFamily: 'Arial Black', color: '#ffffff',
    }).setOrigin(0.5).setDepth(d + 1);

    this.contTxt = this.add.text(W / 2, H * 0.31, '10', {
      fontSize: '72px', fontFamily: 'Arial Black', color: '#ff4444',
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(d + 1);

    const secLbl = this.add.text(W / 2, H * 0.42, 'seconds remaining', {
      fontSize: '14px', fontFamily: 'Arial', color: '#667788',
    }).setOrigin(0.5).setDepth(d + 1);

    // Watch Ad button (free revive)
    const adBtns = this._makeBtn(W / 2, H * 0.54, 'WATCH AD  —  FREE', 280, 62, 0x007700, 0x00aa00, 24, d + 1,
      () => this._watchAd());

    // Use Coin button
    this.useCoinBtn = this.add.rectangle(W / 2, H * 0.67, 280, 62, 0x0055bb).setDepth(d + 1).setInteractive();
    this.useCoinTxt = this.add.text(W / 2, H * 0.67, `USE COIN  (${this.coins} left)`, {
      fontSize: '22px', fontFamily: 'Arial Black', color: '#ffffff',
    }).setOrigin(0.5).setDepth(d + 2);
    this.useCoinBtn.on('pointerover',  () => this.useCoinBtn.setFillStyle(this.coins > 0 ? 0x0077ff : 0x222222));
    this.useCoinBtn.on('pointerout',   () => this.useCoinBtn.setFillStyle(this.coins > 0 ? 0x0055bb : 0x222222));
    this.useCoinBtn.on('pointerdown',  () => this._useCoins());

    // TODO: "BUY COINS" IAP button — wire up @capacitor/purchases or RevenueCat here
    const buyLbl = this.add.text(W / 2, H * 0.77, 'Buy coins  •  4 for $0.99', {
      fontSize: '15px', fontFamily: 'Arial', color: '#445566',
      align: 'center',
    }).setOrigin(0.5).setDepth(d + 1);

    const giveUp = this.add.text(W / 2, H * 0.87, 'Give Up', {
      fontSize: '18px', fontFamily: 'Arial', color: '#334455',
    }).setOrigin(0.5).setDepth(d + 1).setInteractive({ useHandCursor: true });
    giveUp.on('pointerover',  () => giveUp.setColor('#6688aa'));
    giveUp.on('pointerout',   () => giveUp.setColor('#334455'));
    giveUp.on('pointerdown',  () => { this.contEvt?.remove(); this._goToGameOver(); });

    this.contObjs = [bg, title, this.contTxt, secLbl, this.useCoinBtn, this.useCoinTxt, buyLbl, giveUp, ...adBtns];
    this.contObjs.forEach(o => o.setVisible(false));
  }

  // Generic button factory — returns array of created objects for overlay tracking
  _makeBtn(x, y, label, w, h, color, hoverColor, fontSize, depth, callback) {
    const btn = this.add.rectangle(x, y, w, h, color).setDepth(depth).setInteractive({ useHandCursor: true });
    const txt = this.add.text(x, y, label, {
      fontSize: `${fontSize}px`, fontFamily: 'Arial Black', color: '#ffffff',
    }).setOrigin(0.5).setDepth(depth + 1);
    btn.on('pointerover',  () => btn.setFillStyle(hoverColor));
    btn.on('pointerout',   () => btn.setFillStyle(color));
    btn.on('pointerdown',  callback);
    return [btn, txt];
  }
}
