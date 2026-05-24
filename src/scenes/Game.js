import {
  W, H, SAFE_TOP, BIOMES, getBiomeIndexByTime, BIOME_DURATION_SCALE,
  DIVER_Y, DIVER_ACCEL, DIVER_DRAG, DIVER_MAX_VX, DIVER_TILT, DIVER_MAX_TILT, DIVER_MARGIN,
  PRESSURE_DECAY, PRESSURE_HIT,
} from '../main.js';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const STORAGE_COINS = 'plunge_coins';

const WALL_H    = 110;
const FADE_MS   = 7000;  // biome crossfade — bg images, vignette, and music all use this

export default class Game extends Phaser.Scene {
  constructor() { super('Game'); }

  // ── LIFECYCLE ─────────────────────────────────────────────────────────────

  create() {
    // State
    this.depth      = 0;
    this.gameTime   = 0;       // elapsed ms (excludes pause/death), drives biome + music
    this.pressure   = 0;       // 0.0 → 1.0 → death
    this.dead       = false;
    this.invincible = false;
    this.biomeIdx   = 0;
    this._eff       = { ...BIOMES[0] };  // interpolated difficulty values, updated each tick
    this.gamePaused = false;
    this.coins      = parseInt(localStorage.getItem(STORAGE_COINS) || '0', 10);

    // Input flags
    this.steerLeft  = false;
    this.steerRight = false;

    this.decorations = [];

    // Pre-create one reusable instance per SFX — safe: returns null if file wasn't loaded.
    // All play calls use optional chaining so a missing file never crashes the game.
    const _snd = (key, vol) =>
      this.cache.audio.has(key) ? this.sound.add(key, { volume: vol }) : null;
    this._sfx = {
      button: _snd('buttonSFX', 0.7),
      woosh:  _snd('wooshSFX',  1.0),
      hit:    _snd('hitSFX',    0.9),
    };

    // ── WORLD ────────────────────────────────────────────────────────────────
    this.physics.world.gravity.y = 0;
    this.bg = this.add.rectangle(W / 2, H / 2, W, H, BIOMES[0].bg).setDepth(0);

    // Two bg image slots — slot 0 is active, slot 1 kept at alpha 0 (unused until swap)
    this.bgLayers = [
      this.add.image(W / 2, H / 2, 'bg_coral').setDepth(1).setDisplaySize(W * 1.15, H * 1.15).setAlpha(0.38),
      this.add.image(W / 2, H / 2, 'bg_coral').setDepth(2).setDisplaySize(W * 1.15, H * 1.15).setAlpha(0),
    ];
    this.bgSlot = 0;

    // Shimmer overlay — pulses the current biome's neon color at low opacity.
    // Use setAlpha(0) on the game object (not fillAlpha) so setFillStyle() on biome
    // transitions doesn't accidentally reset fillAlpha to 1 and cause a full-screen flash.
    this.bgShimmer = this.add.rectangle(W / 2, H / 2, W, H, BIOMES[0].obsColor)
      .setAlpha(0).setDepth(3).setBlendMode(Phaser.BlendModes.ADD);

    this.gridTile = this.add.tileSprite(W / 2, H / 2, W, H, 'grid').setDepth(4).setAlpha(0.25);
    this._initAmbientBubbles();
    this._initAmbientStars();
    this._initBgAnimations();

    // ── DIVER ────────────────────────────────────────────────────────────────
    // Fish image faces RIGHT — rotate 90° so nose points straight down by default.
    // BlendMode.ADD makes the black background invisible and neon colors glow.
    this.diver = this.physics.add.image(W / 2, DIVER_Y, 'diver')
      .setDepth(10)
      .setCollideWorldBounds(false)
      .setDisplaySize(88, 88)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.diver.setMaxVelocity(DIVER_MAX_VX, 0);
    this.diver.body.setSize(88, 88);

    // Idle breathing — gentle scale pulse so the fish never looks frozen
    const _bsx = this.diver.scaleX, _bsy = this.diver.scaleY;
    this.tweens.add({
      targets: this.diver,
      scaleX: _bsx * 1.055, scaleY: _bsy * 1.055,
      yoyo: true, repeat: -1, duration: 860, ease: 'Sine.InOut',
    });

    this.diverGlow = this.add.circle(W / 2, DIVER_Y, 38, 0x00eeff, 0.22)
      .setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: this.diverGlow,
      alpha: 0.08, scaleX: 1.6, scaleY: 1.6,
      yoyo: true, repeat: -1, duration: 900,
    });

    // Dead sprite — same size/blend, hidden until hit or death
    this.diverDead = this.add.image(W / 2, DIVER_Y, 'diverDead')
      .setDepth(11)
      .setDisplaySize(88, 88)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);

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
    this.input.on('pointerdown', p => {
      this._handlePointer(p, true);
      if (!this.gamePaused && !(p.x > W - 55 && p.y < 70 + SAFE_TOP)) {
        this._sfx.woosh?.stop();
        this._sfx.woosh?.play();
      }
    });
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

    // All music Sound objects (current + any that are still fading out).
    // The shutdown handler below stops them immediately if the scene is torn down before
    // a fade-out tween completes — prevents game music leaking into the menu.
    this._musicSounds = [];
    this.events.once('shutdown', () => {
      this._musicSounds.forEach(s => { try { s.stop(); s.destroy(); } catch (_) {} });
      this._musicSounds = [];
    });

    this._initMusic();
    this.cameras.main.fadeIn(350);
  }

  // ── INPUT ──────────────────────────────────────────────────────────────────

  _handlePointer(p, down) {
    if (this.gamePaused) return;
    // Ignore taps in the pause button zone (top-right corner of header)
    if (p.x > W - 55 && p.y < 70 + SAFE_TOP) return;
    this.steerLeft  = down && p.x < W / 2;
    this.steerRight = down && p.x >= W / 2;
  }

  // ── TICK (every 120ms) ────────────────────────────────────────────────────

  _tick() {
    if (this.dead || this.gamePaused) return;
    this.gameTime += 120;
    this._updateEffectiveDifficulty();
    this.depth   += Math.round(this._eff.fallSpeed / 38);
    this.pressure = Math.max(this.pressure - PRESSURE_DECAY, 0);
    this._refreshBiome();
    this.spawnEvent.delay = Math.round(this._eff.spawnMs);
  }

  // ── BIOME LOGIC ───────────────────────────────────────────────────────────

  _refreshBiome() {
    const newIdx = getBiomeIndexByTime(this.gameTime);
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
      const b        = BIOMES[newIdx];
      const nextSlot = 1 - this.bgSlot;

      // Crossfade bg image layers — duration matches music crossfade (FADE_MS)
      if (this._bgFadeInTween)  this._bgFadeInTween.stop();
      if (this._bgFadeOutTween) this._bgFadeOutTween.stop();
      this.bgLayers[nextSlot].setTexture(b.bgKey).setDisplaySize(W * 1.15, H * 1.15).setAlpha(0);
      this._bgFadeInTween  = this.tweens.add({ targets: this.bgLayers[nextSlot],    alpha: 0.38, duration: FADE_MS });
      this._bgFadeOutTween = this.tweens.add({ targets: this.bgLayers[this.bgSlot], alpha: 0,    duration: FADE_MS });
      this.bgSlot = nextSlot;

      // Switch solid bg color at the midpoint so neither layer carries the wrong tint alone
      this.time.delayedCall(FADE_MS / 2, () => this.bg.setFillStyle(b.bg));

      this.bgShimmer.setFillStyle(b.obsColor);

      this.biomeTxt.setText(`▼  ${b.name.toUpperCase()}  ▼`);
      this.biomeTxt.setColor('#' + b.obsColor.toString(16).padStart(6, '0'));
      this.tweens.add({ targets: this.vigSprite, alpha: b.lightFade, duration: FADE_MS });
    }
  }

  // ── PROGRESSIVE DIFFICULTY ───────────────────────────────────────────────

  _updateEffectiveDifficulty() {
    const bi = this.biomeIdx;
    const b  = BIOMES[bi];

    // Last biome: fixed endurance difficulty — tweak BIOMES[last] values in main.js.
    if (bi === BIOMES.length - 1) {
      this._eff = { ...b };
      return;
    }

    // How far through this biome we are (0 = just entered, 1 = at the next boundary).
    let biomeStartMs = 0;
    for (let i = 0; i < bi; i++) biomeStartMs += BIOMES[i].duration * 1000 * BIOME_DURATION_SCALE;
    const t = Math.min(1, Math.max(0,
      (this.gameTime - biomeStartMs) / (b.duration * 1000 * BIOME_DURATION_SCALE)
    ));
    const tgt = BIOMES[bi + 1];
    this._eff = {
      ...b,
      fallSpeed: b.fallSpeed + (tgt.fallSpeed - b.fallSpeed) * t,
      spawnMs:   b.spawnMs   + (tgt.spawnMs   - b.spawnMs)   * t,
      gapWidth:  b.gapWidth  + (tgt.gapWidth  - b.gapWidth)  * t,
    };
  }

  // ── MUSIC ─────────────────────────────────────────────────────────────────

  _initMusic() {
    // Flat ordered track list: [coralBGM, kelpBGM01, kelpBGM02, midnightBGM01, ...]
    this._songList = BIOMES.flatMap(b => b.music);
    // Index where Hadal songs start — used to loop back when Hadal exhausts its tracks.
    this._hadalStartIdx = this._songList.length - BIOMES[BIOMES.length - 1].music.length;
    this._currentMusic  = null;

    // iOS (WKWebView) suspends the AudioContext until the first user gesture.
    // Phaser emits 'unlocked' on its sound manager after that touch event.
    // On desktop the context is never locked, so we start immediately.
    if (this.sound.locked) {
      this.sound.once('unlocked', () => this._playMusicTrack(0));
    } else {
      this._playMusicTrack(0);
    }
  }

  _getMusicKey(trackIdx) {
    if (trackIdx < this._songList.length) return this._songList[trackIdx];
    // Past the end of the list: loop within Hadal tracks only.
    const hadalLen = BIOMES[BIOMES.length - 1].music.length;
    return this._songList[this._hadalStartIdx + ((trackIdx - this._hadalStartIdx) % hadalLen)];
  }

  _playMusicTrack(trackIdx) {
    const SONG_MS  = 120000;  // each song is exactly 2 minutes

    const key   = this._getMusicKey(trackIdx);
    const music = this.sound.add(key, { volume: 0, loop: false });
    this._musicSounds.push(music);
    music.play();
    this.tweens.add({ targets: music, volume: 0.7, duration: FADE_MS });

    // Fade out and destroy the outgoing track.
    const prev = this._currentMusic;
    if (prev) {
      this.tweens.add({
        targets: prev, volume: 0, duration: FADE_MS,
        onComplete: () => {
          prev.stop(); prev.destroy();
          this._musicSounds = this._musicSounds.filter(s => s !== prev);
        },
      });
    }
    this._currentMusic = music;

    // Schedule next track so it starts FADE_MS before this one ends — 7 s of overlap.
    this.time.delayedCall(SONG_MS - FADE_MS, () => this._playMusicTrack(trackIdx + 1));
  }

  _stopMusic() {
    if (!this._currentMusic) return;
    const m = this._currentMusic;
    this._currentMusic = null;
    this.tweens.add({
      targets: m, volume: 0, duration: 400,
      onComplete: () => { m.stop(); m.destroy(); },
    });
  }

  // ── OBSTACLE SPAWNING ─────────────────────────────────────────────────────

  spawnWallPair() {
    if (this.dead || this.gamePaused) return;
    const spawnY = H + 80;
    const speed  = -this._eff.fallSpeed;

    this._spawnWallRow(this._eff, spawnY, speed);

    if (this.biomeIdx >= 2) {
      const count = this.biomeIdx === 3 ? 6 : 3;
      for (let i = 0; i < count; i++) this._addGlowDot(speed);
    }
  }

  // ── GAP-BASED WALL SPAWNING ───────────────────────────────────────────────

  _spawnWallRow(b, spawnY, speed) {
    const numGaps = Phaser.Math.Between(b.minGaps, b.maxGaps);
    const gaps    = this._generateGaps(numGaps, b.gapWidth, 0, W);
    const zones   = this._getObstacleZones(gaps, 0, W);
    const skins   = BIOMES[this.biomeIdx].fillSkins;
    const bgPool  = BIOMES[this.biomeIdx].bgSkins;

    zones.forEach(zone => {
      const { x1, x2 } = zone;
      const zoneW = x2 - x1;
      if (zoneW <= 2) return;

      // Outer zones (touching screen edges) get the landmark sprite.
      // The landmark is anchored to its gap-facing edge and extends off-screen,
      // so the canvas clips it and the gap area stays visually clear.
      const isLeft  = x1 <= 2;
      const isRight = x2 >= W - 2;

      if ((isLeft || isRight) && bgPool && bgPool.length) {
        // Physics rect — invisible, full zone
        const rect = this.add.rectangle((x1 + x2) / 2, spawnY, zoneW, WALL_H, 0x000000, 0);
        this.physics.add.existing(rect, true);
        this.walls.add(rect);
        rect.setData('velY', speed);

        // Landmark sprite at natural wallH height.
        // Left zone: right edge of sprite = x2 (gap edge) → extends off screen left.
        // Right zone: left edge of sprite = x1 (gap edge) → extends off screen right.
        const skin = Phaser.Utils.Array.GetRandom(bgPool);
        const natW = skin.pngW * (WALL_H / skin.pngH);
        const imgX = isLeft ? x2 - natW / 2 : x1 + natW / 2;
        const img  = this.add.image(imgX, spawnY, skin.key)
          .setDisplaySize(natW, WALL_H)
          .setFlipX(Math.random() < 0.5)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(6);
        img.setData('velY', speed);
        this.decorations.push({ obj: img, isDecor: true });
      } else {
        // Interior zone or biome with no BG pool: fill with tiled smaller sprites
        this._addSkinWallZone(x1, x2, spawnY, WALL_H, speed, skins);
      }
    });
  }

  _generateGaps(numGaps, gapW, xMin, xMax) {
    const margin = 36;
    const minSeg = 24;

    if (numGaps === 1) {
      const lo = xMin + margin;
      const hi = Math.max(lo, xMax - margin - gapW);
      const x1 = lo + Math.random() * (hi - lo);
      return [{ x1, x2: x1 + gapW }];
    }

    const minTotal = 2 * margin + 2 * gapW + minSeg;
    if ((xMax - xMin) < minTotal) return this._generateGaps(1, gapW, xMin, xMax);

    const lo1 = xMin + margin;
    const hi1 = xMax - margin - 2 * gapW - minSeg;
    const x1  = lo1 + Math.random() * Math.max(0, hi1 - lo1);

    const lo2 = x1 + gapW + minSeg;
    const hi2 = Math.max(lo2, xMax - margin - gapW);
    const x2  = lo2 + Math.random() * (hi2 - lo2);

    return [
      { x1, x2: x1 + gapW },
      { x1: x2, x2: x2 + gapW },
    ];
  }

  _getObstacleZones(gaps, xMin, xMax) {
    const zones = [];
    let cursor = xMin;
    for (const gap of gaps) {
      if (gap.x1 > cursor) zones.push({ x1: cursor, x2: gap.x1 });
      cursor = gap.x2;
    }
    if (cursor < xMax) zones.push({ x1: cursor, x2: xMax });
    return zones;
  }

  _addSkinWallZone(x1, x2, cy, wallH, velY, skins) {
    const zoneW = x2 - x1;
    if (zoneW <= 2) return;

    const cx   = (x1 + x2) / 2;
    const rect = this.add.rectangle(cx, cy, zoneW, wallH, 0x000000, 0);
    this.physics.add.existing(rect, true);
    this.walls.add(rect);
    rect.setData('velY', velY);

    // Sprites are pre-rotated in their asset files — no code rotation applied.
    // Natural width when uniformly scaled to height = wallH (preserves aspect ratio).
    const natW = sk => sk.pngW * (wallH / sk.pngH);

    // Exclude skins whose natural width is more than 2× the zone — those would scale
    // down below 50% height and look tiny. Fall back to full list if all are too wide.
    const viable = skins.filter(sk => natW(sk) <= zoneW * 2.0);
    const pool   = viable.length > 0 ? viable : skins;

    const avgNatW = pool.reduce((s, sk) => s + natW(sk), 0) / pool.length;
    let count     = Math.max(1, Math.round(zoneW / avgNatW));

    // Ensure adj (uniform fill scale) stays ≤ 1.4 to avoid oversized sprites.
    // If too few sprites, add more and re-sample.
    let picked, natWs, adj;
    for (let iter = 0; iter < 6; iter++) {
      picked = Array.from({ length: count }, () => Phaser.Utils.Array.GetRandom(pool));
      natWs  = picked.map(natW);
      adj    = zoneW / natWs.reduce((a, b) => a + b, 0);
      if (adj <= 1.4) break;
      count++;
    }

    const MIN_SPRITE_W = W / 3;
    let cursor = x1;
    picked.forEach((skin, i) => {
      // Minimum display width = W/3. If zone-fill adj would go smaller, scale this sprite up.
      // Uniform scale on both axes — no distortion.
      const useAdj = Math.max(adj, MIN_SPRITE_W / natWs[i]);
      const dispW  = natWs[i] * useAdj;
      const dispH  = wallH    * useAdj;
      const sx     = cursor + dispW / 2;

      const img = this.add.image(sx, cy, skin.key)
        .setDisplaySize(dispW, dispH)
        .setFlipX(Math.random() < 0.5)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(6);
      img.setData('velY', velY);
      this.decorations.push({ obj: img, isDecor: true });

      cursor += dispW;
    });
  }

  _addGlowDot(velY) {
    if (this.decorations.length > 150) return;
    const gd = this.add.image(
      Phaser.Math.Between(10, W - 10),
      H + Phaser.Math.Between(0, 80),
      'glow'
    ).setScale(Phaser.Math.FloatBetween(0.4, 1.9)).setAlpha(0.7).setDepth(5);
    gd.setData('velY', velY);
    this.tweens.add({ targets: gd, alpha: 0.05, yoyo: true, repeat: -1, duration: Phaser.Math.Between(250, 750) });
    this.decorations.push({ obj: gd, isDecor: true });
  }

  // ── HIT / DEATH ───────────────────────────────────────────────────────────

  onHit() {
    if (this.invincible || this.dead) return;
    this.invincible = true;
    this.pressure = Math.min(this.pressure + PRESSURE_HIT, 1.0);
    if (this.cache.audio.has('hitSFX')) this.sound.play('hitSFX', { volume: 0.9 });
    navigator.vibrate?.(40);  // Android / web fallback
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});

    this.cameras.main.shake(210, 0.018);
    this.hitFlash.setAlpha(0.5);
    this.tweens.add({ targets: this.hitFlash, alpha: 0, duration: 300 });

    // Brief biome-color flash on wall hit
    this.bgShimmer.setAlpha(0.22);
    this.tweens.add({ targets: this.bgShimmer, alpha: 0, duration: 450, ease: 'Power2Out' });

    // Swap to dead sprite and blink it; swap back when done
    this.diver.setVisible(false);
    this.diverDead.setFlipX(this.diver.flipX);
    this.diverDead.angle = this.diver.angle;
    this.diverDead.x     = this.diver.x;
    this.diverDead.setVisible(true).setAlpha(1);
    this.tweens.add({
      targets: this.diverDead, alpha: 0.1, yoyo: true, repeat: 4, duration: 65,
      onComplete: () => {
        if (!this.dead) {
          this.diverDead.setVisible(false).setAlpha(1);
          this.diver.setVisible(true).setAlpha(1);
        }
      },
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
    this.tweens.killTweensOf(this.diverDead);
    this.diver.setVisible(false);
    this.diverGlow.setVisible(false);

    // Show dead sprite at the diver's last position and spin it away
    this.diverDead.setPosition(this.diver.x, DIVER_Y);
    this.diverDead.setFlipX(this.diver.flipX);
    this.diverDead.angle = this.diver.angle;
    this.diverDead.setVisible(true).setAlpha(1);
    this.tweens.add({
      targets: this.diverDead,
      angle:   this.diver.angle + (this.diver.flipX ? -270 : 270),
      y:       DIVER_Y - 90,
      alpha:   0,
      duration: 900,
      ease: 'Power2Out',
      onComplete: () => {
        this.diverDead.setVisible(false).setAlpha(1);
        this.diverDead.y = DIVER_Y;
      },
    });

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
    this.tweens.killTweensOf(this.diverDead);
    this.diverDead.setVisible(false).setAlpha(1).setAngle(90).setY(DIVER_Y);
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
    const countBg = this.add.rectangle(W / 2, H / 2, W, 160, 0x000000, 0.82).setDepth(d);
    const readyTxt = this.add.text(W / 2, H / 2 - 68, 'GET READY!', {
      fontSize: '22px', fontFamily: 'Arial Black',
      color: '#0088bb', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(d + 1);
    const countTxt = this.add.text(W / 2, H / 2 + 16, '3', {
      fontSize: '90px', fontFamily: 'Arial Black',
      color: '#cc0077', stroke: '#000', strokeThickness: 7,
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
        countTxt.setText('GO!').setColor('#ddaa00');
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
      fontSize: '20px', fontFamily: 'Arial', color: '#0088bb',
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
    this._stopMusic();
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
    this.time.paused = true;
    this.physics.pause();
    this._currentMusic?.pause();
    this._updateCoinLabel();
    this.pauseObjs.forEach(o => o.setVisible(true));
  }

  _resume() {
    this.gamePaused = false;
    this.time.paused = false;
    this.physics.resume();
    this._currentMusic?.resume();
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

    // Flip sprite to face whichever side the player is steering toward
    if      (vx >  10) this.diver.setFlipX(false);
    else if (vx < -10) this.diver.setFlipX(true);
    // flipX mirrors the rotation direction in Phaser, so negate the angle when flipped.
    // No flip:  90° → nose down,  45° → nose down-right
    // FlipX: -90° → nose down, -45° → nose down-left  (same visual, mirrored)
    const tilt = Phaser.Math.Clamp(Math.abs(vx) * DIVER_TILT, 0, DIVER_MAX_TILT);
    // Tail waggle fades out as speed picks up — fish looks alive when coasting
    const idleT  = 1 - Math.min(Math.abs(vx) / 65, 1);
    const waggle = Math.sin(time * 0.005) * 4 * idleT;
    this.diver.angle = (this.diver.flipX ? -(90 - tilt) : (90 - tilt)) + waggle;

    // Keep dead sprite locked to diver during hit-flash (visible but world still running)
    if (this.diverDead.visible) {
      this.diverDead.x     = this.diver.x;
      this.diverDead.flipX = this.diver.flipX;
      this.diverDead.angle = this.diver.angle;
    }

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

    // ── AMBIENT STARS ─────────────────────────────────────────────
    this.stars.forEach(s => {
      s.y -= s.spd * dt;
      if (s.y < -10) { s.y = H + 10; s.x = Phaser.Math.Between(0, W); }
    });

    // ── GRID PARALLAX ─────────────────────────────────────────────
    this.gridTile.tilePositionY -= this._eff.fallSpeed * dt * 0.22;

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

  _updateCoinLabel() {
    if (this.coinLbl) this.coinLbl.setText(`⬡ ${this.coins} coins`);
    if (this.useCoinBtn) {
      const hasCoins = this.coins > 0;
      this.useCoinBtn.setFillStyle(hasCoins ? 0x120d00 : 0x0f0f0f);
      this.useCoinBtn.setStrokeStyle(1.5, hasCoins ? 0xddaa00 : 0x333333, hasCoins ? 0.8 : 0.35);
      if (this.useCoinTxt) {
        this.useCoinTxt.setColor(hasCoins ? '#ddaa00' : '#333333');
        this.useCoinTxt.setText(`USE COIN  (${this.coins} left)`);
      }
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

  _initAmbientStars() {
    this.stars = [];
    const palette = [0xffffff, 0x00ccff, 0xff44aa, 0xffcc00, 0x00ff66, 0xaa88ff];
    for (let i = 0; i < 28; i++) {
      const s = this.add.image(
        Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 'star'
      ).setAlpha(Phaser.Math.FloatBetween(0.15, 0.65))
       .setScale(Phaser.Math.FloatBetween(0.4, 1.6))
       .setDepth(5)
       .setTint(Phaser.Utils.Array.GetRandom(palette));
      s.spd = Phaser.Math.FloatBetween(10, 35);
      this.tweens.add({
        targets: s, alpha: Phaser.Math.FloatBetween(0.02, 0.12),
        yoyo: true, repeat: -1,
        duration: Phaser.Math.Between(600, 2400),
      });
      this.stars.push(s);
    }
  }

  _initBgAnimations() {
    this.bgLayers.forEach((layer, i) => {
      // Gentle horizontal sway
      this.tweens.add({ targets: layer, x: W / 2 + 16, yoyo: true, repeat: -1, duration: 5500 + i * 700, ease: 'Sine.InOut' });
      // Slow vertical drift
      this.tweens.add({ targets: layer, y: H / 2 + 12, yoyo: true, repeat: -1, duration: 6200 + i * 300, ease: 'Sine.InOut' });
    });
  }

  _initAmbientBubbles() {
    this.ambients = [];
    for (let i = 0; i < 18; i++) {
      const a = this.add.image(
        Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 'bubble'
      ).setAlpha(0.22).setScale(Phaser.Math.FloatBetween(0.3, 1.8)).setDepth(5);
      a.spd = Phaser.Math.FloatBetween(18, 60);
      this.ambients.push(a);
    }
  }

  // ── UI BUILDERS ───────────────────────────────────────────────────────────

  _buildUI() {
    const ST = SAFE_TOP; // shorthand — shifts all header elements below the notch/status bar

    // Header strip — tall enough to cover the safe area + the 92px UI band
    this.add.rectangle(W / 2, 0, W, 92 + ST, 0x000000, 0.72).setOrigin(0.5, 0).setDepth(28);
    this.add.rectangle(W / 2, 92 + ST, W, 1.5, 0x00ccff, 0.35).setDepth(28);

    // Damage bar — neon-bordered track
    this.add.rectangle(W / 2, 21 + ST, W - 36, 15, 0x000000, 0.8).setDepth(29);
    this.add.rectangle(W / 2, 21 + ST, W - 34, 17, 0x000000, 0)
      .setStrokeStyle(1, 0xff0088, 0.4).setDepth(29);
    this.pBar = this.add.rectangle(20, 14 + ST, 0, 13, 0x00cc66).setOrigin(0, 0).setDepth(30);
    this.add.text(W / 2, 21 + ST, 'DAMAGE', {
      fontSize: '8px', fontFamily: 'Arial', color: '#ff0088',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(31);

    // Depth counter — electric cyan stroke
    this.depthTxt = this.add.text(W / 2, 52 + ST, '0m', {
      fontSize: '30px', fontFamily: 'Arial Black',
      color: '#ffffff', stroke: '#00ccff', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(30);

    // Biome label — color tracks current biome's neon obsColor
    this.biomeTxt = this.add.text(W / 2, 76 + ST, `▼  ${BIOMES[0].name.toUpperCase()}  ▼`, {
      fontSize: '11px', fontFamily: 'Arial Black',
      color: '#' + BIOMES[0].obsColor.toString(16).padStart(6, '0'),
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(30);

    // Pause button — neon-bordered square
    const pauseBg = this.add.rectangle(W - 28, 52 + ST, 36, 30, 0x000000, 0.7)
      .setStrokeStyle(1.2, 0x00ccff, 0.6).setDepth(34);
    const pauseHit = this.add.rectangle(W - 28, 52 + ST, 44, 44, 0xffffff, 0).setDepth(35).setInteractive();
    this.add.text(W - 28, 52 + ST, 'II', {
      fontSize: '14px', fontFamily: 'Arial Black', color: '#00ccff',
    }).setOrigin(0.5).setDepth(36);
    pauseHit.on('pointerover',  () => pauseBg.setStrokeStyle(1.5, 0x00eeff, 1));
    pauseHit.on('pointerout',   () => pauseBg.setStrokeStyle(1.2, 0x00ccff, 0.6));
    pauseHit.on('pointerdown',  () => { this._sfx.button?.stop(); this._sfx.button?.play(); this._pause(); });

    // Hit flash
    this.hitFlash = this.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 0).setDepth(50);
  }

  _buildPauseOverlay() {
    const d = 55;
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.88).setDepth(d);

    // Thin neon rule under title
    const rule = this.add.rectangle(W / 2, H * 0.215, W * 0.80, 1, 0x0088bb, 0.30).setDepth(d + 1);

    const title = this.add.text(W / 2, H * 0.295, 'PAUSED', {
      fontSize: '52px', fontFamily: 'Arial Black',
      color: '#0088bb', stroke: '#fff', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(d + 1);

    this.coinLbl = this.add.text(W / 2, H * 0.415, `⬡ ${this.coins} coins`, {
      fontSize: '18px', fontFamily: 'Arial', color: '#ddaa00',
    }).setOrigin(0.5).setDepth(d + 1);

    const resumeBtn = this._makeBtn(W / 2, H * 0.530, 'RESUME', 240, 56, 0x001122, 0x0099cc, 26, d + 1,
      () => this._resume());

    const quitBtn = this._makeBtn(W / 2, H * 0.660, 'QUIT TO MENU', 240, 52, 0x120008, 0xdd0077, 21, d + 1,
      () => {
        this._resume();
        this.cameras.main.fadeOut(250);
        this.time.delayedCall(250, () => this.scene.start('Menu'));
      });

    this.pauseObjs = [bg, rule, title, this.coinLbl, ...resumeBtn, ...quitBtn];
    this.pauseObjs.forEach(o => o.setVisible(false));
  }

  _buildContinueOverlay() {
    const d = 60;
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.90).setDepth(d);

    const title = this.add.text(W / 2, H * 0.17, 'CONTINUE?', {
      fontSize: '46px', fontFamily: 'Arial Black',
      color: '#cc0077', stroke: '#fff', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(d + 1);

    this.contTxt = this.add.text(W / 2, H * 0.31, '10', {
      fontSize: '72px', fontFamily: 'Arial Black',
      color: '#cc0077', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(d + 1);

    const secLbl = this.add.text(W / 2, H * 0.415, 'seconds remaining', {
      fontSize: '13px', fontFamily: 'Arial', color: '#2a3a44',
    }).setOrigin(0.5).setDepth(d + 1);

    // Watch Ad button — green neon (free action)
    const adBtns = this._makeBtn(W / 2, H * 0.525, 'WATCH AD  —  FREE', 280, 56, 0x001100, 0x88bb00, 22, d + 1,
      () => this._watchAd());

    // Use Coin button — gold neon, dynamic enabled/disabled state
    this.useCoinBtn = this.add.rectangle(W / 2, H * 0.650, 280, 56, 0x120d00)
      .setStrokeStyle(1.5, 0xddaa00, 0.8)
      .setDepth(d + 1).setInteractive({ useHandCursor: true });
    this.useCoinTxt = this.add.text(W / 2, H * 0.650, `USE COIN  (${this.coins} left)`, {
      fontSize: '21px', fontFamily: 'Arial Black',
      color: '#ddaa00', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(d + 2);
    this.useCoinBtn.on('pointerover',  () => this.useCoinBtn.setStrokeStyle(2.5, this.coins > 0 ? 0xddaa00 : 0x333333, 1.0));
    this.useCoinBtn.on('pointerout',   () => this.useCoinBtn.setStrokeStyle(1.5, this.coins > 0 ? 0xddaa00 : 0x333333, 0.8));
    this.useCoinBtn.on('pointerdown',  () => { this._sfx.button?.stop(); this._sfx.button?.play(); this._useCoins(); });

    const buyLbl = this.add.text(W / 2, H * 0.755, 'Buy coins  •  4 for $0.99', {
      fontSize: '14px', fontFamily: 'Arial', color: '#2a3a44',
    }).setOrigin(0.5).setDepth(d + 1);

    const giveUp = this.add.text(W / 2, H * 0.860, 'Give Up', {
      fontSize: '17px', fontFamily: 'Arial', color: '#1e2e38',
    }).setOrigin(0.5).setDepth(d + 1).setInteractive({ useHandCursor: true });
    giveUp.on('pointerover',  () => giveUp.setColor('#4a6a7a'));
    giveUp.on('pointerout',   () => giveUp.setColor('#1e2e38'));
    giveUp.on('pointerdown',  () => {
      this._sfx.button?.stop(); this._sfx.button?.play();
      this.contEvt?.remove();
      this._stopMusic();
      this.cameras.main.fadeOut(250);
      this.time.delayedCall(250, () => this.scene.start('Menu', { skipAbyss: true }));
    });

    this.contObjs = [bg, title, this.contTxt, secLbl, this.useCoinBtn, this.useCoinTxt, buyLbl, giveUp, ...adBtns];
    this.contObjs.forEach(o => o.setVisible(false));
  }

  // Generic button factory — dark fill + neon stroke. fillColor = bg, strokeColor = border + text.
  _makeBtn(x, y, label, w, h, fillColor, strokeColor, fontSize, depth, callback) {
    const btn = this.add.rectangle(x, y, w, h, fillColor)
      .setStrokeStyle(1.5, strokeColor, 0.75)
      .setDepth(depth).setInteractive({ useHandCursor: true });
    const txt = this.add.text(x, y, label, {
      fontSize: `${fontSize}px`, fontFamily: 'Arial Black',
      color: '#' + strokeColor.toString(16).padStart(6, '0'),
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(depth + 1);
    btn.on('pointerover',  () => btn.setStrokeStyle(2.5, strokeColor, 1.0));
    btn.on('pointerout',   () => btn.setStrokeStyle(1.5, strokeColor, 0.75));
    btn.on('pointerdown',  () => { this._sfx.button?.stop(); this._sfx.button?.play(); callback(); });
    return [btn, txt];
  }
}
