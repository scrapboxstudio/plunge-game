import {
  W, H, SAFE_TOP, BIOMES, getBiomeIndexByTime, BIOME_DURATION_SCALE,
  DIVER_Y, DIVER_ACCEL, DIVER_DRAG, DIVER_MAX_VX, DIVER_TILT, DIVER_MAX_TILT, DIVER_MARGIN,
  PRESSURE_DECAY, PRESSURE_HIT,
} from '../main.js';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
  SKINS, TRAILS, OBJ_SKINS, BG_SKINS, SKIN_TINTS,
  STORAGE_ACTIVE_SKIN, STORAGE_OWNED_SKINS,
  STORAGE_ACTIVE_TRAIL, STORAGE_OWNED_TRAILS,
  STORAGE_ACTIVE_OBJ_SKIN, STORAGE_OWNED_OBJ_SKINS,
  STORAGE_ACTIVE_BG, STORAGE_OWNED_BGS,
} from '../config/cosmetics.js';

const STORAGE_COINS      = 'plunge_coins';
const STORAGE_BEST       = 'plunge_best';
const STORAGE_LIVES      = 'plunge_lives';
const STORAGE_VOL_MUSIC  = 'plunge_vol_music';
const STORAGE_VOL_SFX    = 'plunge_vol_sfx';
const STORAGE_MUTE_MUSIC = 'plunge_mute_music';
const STORAGE_MUTE_SFX   = 'plunge_mute_sfx';
const STORAGE_TRAIL      = 'plunge_particle_trail';

function _readVol(key, def) {
  const v = parseFloat(localStorage.getItem(key));
  return (isNaN(v) || v < 0 || v > 1) ? def : v;
}
function musicVol() {
  return localStorage.getItem(STORAGE_MUTE_MUSIC) === '1' ? 0 : _readVol(STORAGE_VOL_MUSIC, 0.7);
}
function sfxVol() {
  return localStorage.getItem(STORAGE_MUTE_SFX) === '1' ? 0 : _readVol(STORAGE_VOL_SFX, 0.7);
}

const WALL_H    = 110;
const FADE_MS   = 7000;  // biome crossfade — bg images, vignette, and music all use this

export default class Game extends Phaser.Scene {
  constructor() { super('Game'); }

  // ── LIFECYCLE ─────────────────────────────────────────────────────────────

  create() {
    // State
    this.depth      = 0;
    this.gameTime   = 0;
    this._prevBest     = parseInt(localStorage.getItem(STORAGE_BEST) || '0', 10);
    this._newRecord    = false;
    this._lastGapCenter = undefined;  // used to alternate gap sides and force movement
    this._recentSkins   = {};         // biomeIdx → recently-used skin keys (avoids repeats)       // elapsed ms (excludes pause/death), drives biome + music
    this.pressure   = 0;       // 0.0 → 1.0 → death
    this.dead       = false;
    this.invincible = false;
    this.biomeIdx   = 0;
    this._eff       = { ...BIOMES[0] };  // interpolated difficulty values, updated each tick
    this.gamePaused = false;
    this.coins        = parseInt(localStorage.getItem(STORAGE_COINS) || '0', 10);
    this.lives        = parseInt(localStorage.getItem(STORAGE_LIVES) || '0', 10);
    this._trailEnabled  = localStorage.getItem(STORAGE_TRAIL) !== '0';
    this._activeObjSkin = localStorage.getItem(STORAGE_ACTIVE_OBJ_SKIN) || 'default';
    this._activeBgSkin  = localStorage.getItem(STORAGE_ACTIVE_BG)       || 'default';
    this._objSkinTint   = OBJ_SKINS.find(s => s.key === this._activeObjSkin)?.tint ?? 0xffffff;
    this._bgSkinTint    = BG_SKINS.find(s => s.key === this._activeBgSkin)?.tint  ?? 0xffffff;

    // Input flags
    this.steerLeft  = false;
    this.steerRight = false;

    this.decorations = [];

    // Shell (invincibility) state
    this._shellsThisBiome     = 0;   // shells spawned in current biome/batch (max 1)
    this._nextShellIn         = this._shellSpawnDelay();
    this._hadalShellBatchDepth = 0;
    this._shellInvincible     = false;
    this._invincibleSFX       = null;

    // Coin state — depth-based batches: 30 coins per 5000m, infinite
    this._coinsThisBatch      = 0;   // coins spawned in the current 5000m batch
    this._coinBatchStartDepth = 0;   // depth at which the current batch began
    this._nextCoinDepth       = 100; // depth threshold before the next coin may spawn
    this._coinsCollectedTotal = 0;   // total collected this run
    this._lastGaps            = null;

    // Pre-create one reusable instance per SFX — safe: returns null if file wasn't loaded.
    // All play calls use optional chaining so a missing file never crashes the game.
    const sv = sfxVol();
    const _snd = (key, vol) =>
      this.cache.audio.has(key) ? this.sound.add(key, { volume: vol * sv }) : null;
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
      this.add.image(W / 2, H / 2, 'bg_coral').setDepth(1).setDisplaySize(W * 1.15, H * 1.15).setAlpha(0.38).setTint(this._bgSkinTint),
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

    this.diverGlow = this.add.circle(W / 2, DIVER_Y, 38, SKIN_TINTS[this._activeSkin] ?? 0x00eeff, 0.22)
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

    // Apply active skin tint to both diver sprites
    // SPRITE SWAP POINT — replace setTint() with setTexture(spriteKey) when real sprites are ready
    this._activeSkin  = localStorage.getItem(STORAGE_ACTIVE_SKIN)  || 'default';
    this._activeTrail = localStorage.getItem(STORAGE_ACTIVE_TRAIL) || 'default';
    const _skinTint = SKIN_TINTS[this._activeSkin] ?? 0xffffff;
    this.diver.setTint(_skinTint);
    this.diverDead.setTint(_skinTint);

    // ── WALLS ────────────────────────────────────────────────────────────────
    this.walls = this.physics.add.staticGroup();
    this.physics.add.overlap(this.diver, this.walls, () => this.onHit(), null, this);

    // ── COINS ─────────────────────────────────────────────────────────────────
    this.coinPickups = this.physics.add.staticGroup();
    this.physics.add.overlap(this.diver, this.coinPickups, (d, coin) => this._collectCoin(coin), null, this);

    // ── SHELLS ────────────────────────────────────────────────────────────────
    this.shellPickups = this.physics.add.staticGroup();
    this.physics.add.overlap(this.diver, this.shellPickups, (d, shell) => this._collectShell(shell), null, this);

    // Persistent aura rendered during invincibility — hidden until shell collected
    this.shellAura = this.add.circle(W / 2, DIVER_Y, 54, 0xbbddff, 0)
      .setDepth(9).setBlendMode(Phaser.BlendModes.ADD);

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
      try { this._invincibleSFX?.stop(); this._invincibleSFX?.destroy(); } catch (_) {}
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
    if (!this._newRecord && this._prevBest > 0 && this.depth > this._prevBest) {
      this._newRecord = true;
      this._onNewRecord();
    }
    this.pressure = Math.max(this.pressure - PRESSURE_DECAY, 0);
    this._refreshBiome();
    this.spawnEvent.delay = Math.round(this._eff.spawnMs);

    // New coin batch every 5000m — infinite, applies across all biomes
    if (this.depth - this._coinBatchStartDepth >= 5000) {
      this._coinsThisBatch      = 0;
      this._coinBatchStartDepth = this.depth;
      this._nextCoinDepth       = this.depth + Phaser.Math.Between(50, 120);
    }
    // Hadal: new shell every ~5000m (independent of coin batch)
    if (this.biomeIdx === BIOMES.length - 1 && this.depth - this._hadalShellBatchDepth >= 5000) {
      this._shellsThisBiome      = 0;
      this._hadalShellBatchDepth = this.depth;
      this._nextShellIn          = this._shellSpawnDelay();
    }
  }

  // ── NEW RECORD ────────────────────────────────────────────────────────────

  _onNewRecord() {
    // Turn the depth counter gold for the rest of the run
    this.depthTxt.setColor('#ddaa00').setStroke('#aa7700', 4);
    this.tweens.add({
      targets: this.depthTxt, scaleX: 1.6, scaleY: 1.6,
      yoyo: true, duration: 260, ease: 'Power2Out',
    });

    // Badge that pops in then floats away
    const ST    = SAFE_TOP;
    const badge = this.add.text(W / 2, H * 0.32, '★  NEW RECORD  ★', {
      fontSize: '24px', fontFamily: 'Arial Black',
      color: '#ddaa00', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(38).setAlpha(0).setScale(0.5);

    this.tweens.add({
      targets: badge, alpha: 1, scaleX: 1, scaleY: 1,
      duration: 380, ease: 'Back.Out',
      onComplete: () => {
        this.time.delayedCall(1600, () => {
          this.tweens.add({
            targets: badge, alpha: 0, y: badge.y - 28,
            duration: 500,
            onComplete: () => badge.destroy(),
          });
        });
      },
    });
  }

  // ── BIOME LOGIC ───────────────────────────────────────────────────────────

  _refreshBiome() {
    const newIdx = getBiomeIndexByTime(this.gameTime);
    if (newIdx !== this.biomeIdx) {
      this.biomeIdx = newIdx;
      this.spawnEvent.delay   = BIOMES[newIdx].spawnMs;
      this.spawnEvent.elapsed = 0;

      // Reset shell batch for the new biome; coin batches are depth-based and continue uninterrupted
      this._shellsThisBiome = 0;
      this._nextShellIn     = this._shellSpawnDelay();
      if (newIdx === BIOMES.length - 1) {
        this._hadalShellBatchDepth = this.depth;
      }

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
      this.bgLayers[nextSlot].setTexture(b.bgKey).setDisplaySize(W * 1.15, H * 1.15).setAlpha(0).setTint(this._bgSkinTint);
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
    this.tweens.add({ targets: music, volume: musicVol(), duration: FADE_MS });

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
    this._maybeSpawnCoin(spawnY, speed);
    this._maybeSpawnShell(spawnY, speed);

    if (this.biomeIdx >= 2) {
      const count = this.biomeIdx === 3 ? 6 : 3;
      for (let i = 0; i < count; i++) this._addGlowDot(speed);
    }
  }

  // ── GAP-BASED WALL SPAWNING ───────────────────────────────────────────────

  _spawnWallRow(b, spawnY, speed) {
    const numGaps = Phaser.Math.Between(b.minGaps, b.maxGaps);
    const gaps    = this._generateGaps(numGaps, b.gapWidth, 0, W);
    this._lastGaps = gaps;
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
        img.setData('velY', speed).setTint(this._objSkinTint);
        this.decorations.push({ obj: img, isDecor: true });
        // Overlay fillSkins for variety — drawn in front of the landmark at depth 7
        if (skins && skins.length) this._addSkinWallZone(x1, x2, spawnY, WALL_H, speed, skins, false);
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
      const lo    = xMin + margin;
      const hi    = Math.max(lo, xMax - margin - gapW);
      const range = hi - lo;
      const mid   = lo + range / 2;

      // 80% of the time alternate to the opposite screen half from the last gap —
      // forces the player to keep moving instead of camping one spot.
      let x1;
      if (this._lastGapCenter !== undefined && range > 40 && Math.random() < 0.8) {
        x1 = this._lastGapCenter < mid
          ? mid   + Math.random() * (hi - mid)   // last was left → go right
          : lo    + Math.random() * (mid - lo);  // last was right → go left
      } else {
        x1 = lo + Math.random() * range;
      }
      x1 = Phaser.Math.Clamp(x1, lo, hi);
      this._lastGapCenter = x1 + gapW / 2;
      return [{ x1, x2: x1 + gapW }];
    }

    // For 2 gaps: require at least 50 px of positional freedom so layouts don't become
    // near-deterministic on typical phone widths. Fall back to 1 gap if too tight.
    const lo1      = xMin + margin;
    const hi1      = xMax - margin - 2 * gapW - minSeg;
    const minTotal = 2 * margin + 2 * gapW + minSeg;
    if ((xMax - xMin) < minTotal || (hi1 - lo1) < 50) {
      return this._generateGaps(1, gapW, xMin, xMax);
    }

    const x1  = lo1 + Math.random() * (hi1 - lo1);
    const lo2 = x1 + gapW + minSeg;
    const hi2 = Math.max(lo2, xMax - margin - gapW);
    const x2  = lo2 + Math.random() * (hi2 - lo2);

    this._lastGapCenter = x1 + gapW / 2;
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

  _addSkinWallZone(x1, x2, cy, wallH, velY, skins, addPhysics = true) {
    const zoneW = x2 - x1;
    if (zoneW <= 2) return;

    const cx = (x1 + x2) / 2;
    if (addPhysics) {
      const rect = this.add.rectangle(cx, cy, zoneW, wallH, 0x000000, 0);
      this.physics.add.existing(rect, true);
      this.walls.add(rect);
      rect.setData('velY', velY);
    }

    // Natural width at wall height, with optional per-sprite scale boost for small sprites.
    const natW = sk => sk.pngW * (wallH / sk.pngH) * (sk.scale || 1);

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
      picked = Array.from({ length: count }, () => this._pickSkin(pool));
      natWs  = picked.map(natW);
      adj    = zoneW / natWs.reduce((a, b) => a + b, 0);
      if (adj <= 1.4) break;
      count++;
    }

    let cursor = x1;
    picked.forEach((skin, i) => {
      const useAdj = adj;
      const dispW  = natWs[i] * useAdj;
      const dispH  = wallH    * useAdj;
      const sx     = cursor + dispW / 2;

      const img = this.add.image(sx, cy, skin.key)
        .setDisplaySize(dispW, dispH)
        .setFlipX(Math.random() < 0.5)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(addPhysics ? 6 : 7);
      img.setData('velY', velY).setTint(this._objSkinTint);
      this.decorations.push({ obj: img, isDecor: true });

      cursor += dispW;
    });
  }

  // Pick a skin from pool, avoiding recently used ones (window = half the pool size).
  // Ensures all skins rotate through before repeating — critical for coral's 25 sprites.
  _pickSkin(pool) {
    const key    = this.biomeIdx;
    const recent = this._recentSkins[key] ?? (this._recentSkins[key] = []);
    const window = Math.max(1, Math.floor(pool.length / 2));
    const fresh  = pool.filter(sk => !recent.includes(sk.key));
    const sk     = Phaser.Utils.Array.GetRandom(fresh.length > 0 ? fresh : pool);
    recent.push(sk.key);
    if (recent.length > window) recent.shift();
    return sk;
  }

  // ── COIN SPAWNING ──────────────────────────────────────────────────────────

  _maybeSpawnCoin(spawnY, speed) {
    if (!this._lastGaps?.length) return;
    if (this._coinsThisBatch >= 30) return;
    if (this.depth < this._nextCoinDepth) return;

    const gap    = Phaser.Utils.Array.GetRandom(this._lastGaps);
    const margin = 22;
    const range  = gap.x2 - gap.x1 - margin * 2;
    if (range <= 0) return;

    const x = gap.x1 + margin + Math.random() * range;
    this._spawnCoin(x, spawnY, speed);
    this._coinsThisBatch++;
    this._nextCoinDepth = this.depth + Phaser.Math.Between(100, 200);
  }

  _spawnCoin(x, y, speed) {
    const color = this._activeObjSkin !== 'default' ? this._objSkinTint : BIOMES[this.biomeIdx].obsColor;
    const coin  = this.add.image(x, y, 'coinTex')
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(8)
      .setScale(1.1);
    this.physics.add.existing(coin, true);
    this.coinPickups.add(coin);
    coin.setData('velY', speed);

    this.tweens.add({
      targets: coin, scaleX: 1.5, scaleY: 1.5,
      yoyo: true, repeat: -1,
      duration: Phaser.Math.Between(480, 720),
      ease: 'Sine.InOut',
    });
  }

  _collectCoin(coin) {
    if (!coin.active) return;
    const cx = coin.x, cy = coin.y;
    this.tweens.killTweensOf(coin);
    coin.destroy();

    if (this.cache.audio.has('coinSFX')) this.sound.play('coinSFX', { volume: 0.75 * sfxVol() });

    this._coinsCollectedTotal++;
    this.coins++;
    localStorage.setItem(STORAGE_COINS, this.coins);
    this._updateCoinProgress();

    const color = '#' + BIOMES[this.biomeIdx].obsColor.toString(16).padStart(6, '0');
    const txt = this.add.text(cx, cy, '+1', {
      fontSize: '18px', fontFamily: 'Arial Black',
      color, stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({
      targets: txt, y: cy - 55, alpha: 0, duration: 700,
      onComplete: () => txt.destroy(),
    });
  }

  // ── SHELL (INVINCIBILITY) ─────────────────────────────────────────────────

  _shellSpawnDelay() {
    // Shell appears in the middle third of each biome so it's reachable but earned.
    // Coral:    97 rows  → Between(35, 60)
    // Kelp:    194 rows  → Between(70, 120)
    // Midnight: 329 rows → Between(120, 180)
    // Hadal:   batch     → Between(40, 80) rows after batch reset
    switch (this.biomeIdx) {
      case 0:  return Phaser.Math.Between(35,  60);
      case 1:  return Phaser.Math.Between(70,  120);
      case 2:  return Phaser.Math.Between(120, 180);
      default: return Phaser.Math.Between(40,  80);
    }
  }

  _maybeSpawnShell(spawnY, speed) {
    if (this._shellsThisBiome >= 1) return;
    if (!this._lastGaps?.length) return;
    if (--this._nextShellIn > 0) return;

    // Place shell inside a gap so it is always in open water and reachable.
    // A small margin (12 px) keeps it clear of the wall edge visually.
    // Placement is fully random across the gap width — near the edges is
    // harder to collect without grazing a wall, near the centre is easier.
    const gap    = Phaser.Utils.Array.GetRandom(this._lastGaps);
    const margin = 12;
    const lo     = gap.x1 + margin;
    const hi     = gap.x2 - margin;
    if (hi <= lo) return;

    const x = lo + Math.random() * (hi - lo);
    this._spawnShell(x, spawnY, speed);
    this._shellsThisBiome++;
  }

  _spawnShell(x, y, speed) {
    const shell = this.add.image(x, y, 'shellTex')
      .setTint(0xbbddff)          // platinum blue-white
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(8)
      .setScale(1.3);
    this.physics.add.existing(shell, true);
    this.shellPickups.add(shell);
    shell.setData('velY', speed);

    // Slow spin + pulse to stand out from coins
    this.tweens.add({ targets: shell, angle: 360, duration: 2800, repeat: -1, ease: 'Linear' });
    this.tweens.add({
      targets: shell, scaleX: 1.7, scaleY: 1.7,
      yoyo: true, repeat: -1, duration: 620, ease: 'Sine.InOut',
    });
  }

  _collectShell(shell) {
    if (!shell.active) return;
    this.tweens.killTweensOf(shell);
    shell.destroy();

    // Pickup chime, then loop the invincibility track
    if (this.cache.audio.has('coinSFX')) this.sound.play('coinSFX', { volume: 0.9 * sfxVol() });
    if (this.cache.audio.has('invincibleSFX')) {
      this._invincibleSFX = this.sound.add('invincibleSFX', { volume: 0.8 * sfxVol(), loop: true });
      this._invincibleSFX.play();
    }

    this._shellInvincible = true;
    this.invincible       = true;

    // Camera flash + banner
    this.cameras.main.flash(200, 180, 220, 255, false);
    const banner = this.add.text(W / 2, H * 0.38, 'PLATINUM SHELL!', {
      fontSize: '26px', fontFamily: 'Arial Black',
      color: '#bbddff', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(40).setAlpha(0).setScale(0.5);
    this.tweens.add({
      targets: banner, alpha: 1, scaleX: 1, scaleY: 1, duration: 320, ease: 'Back.Out',
      onComplete: () => this.time.delayedCall(1200, () => {
        this.tweens.add({ targets: banner, alpha: 0, y: banner.y - 24, duration: 400, onComplete: () => banner.destroy() });
      }),
    });

    // Aura pulse
    this.shellAura.setAlpha(0.40).setScale(1);
    this._shellAuraTween = this.tweens.add({
      targets: this.shellAura, alpha: 0.12, scaleX: 1.4, scaleY: 1.4,
      yoyo: true, repeat: -1, duration: 220, ease: 'Sine.InOut',
    });

    // Diver sprite flicker — rapid alpha blink for the full 5 s
    this._shellFlashTween = this.tweens.add({
      targets: this.diver, alpha: 0.15,
      yoyo: true, repeat: -1, duration: 120, ease: 'Linear',
    });

    // 1 second before expiry: speed up aura flash as warning
    this.time.delayedCall(7000, () => {
      if (!this._shellInvincible) return;
      this._shellAuraTween?.stop();
      this._shellAuraTween = this.tweens.add({
        targets: this.shellAura, alpha: 0.04, scaleX: 1.6, scaleY: 1.6,
        yoyo: true, repeat: -1, duration: 80, ease: 'Sine.InOut',
      });
    });

    this.time.delayedCall(8000, () => this._endShellInvincible());
  }

  _endShellInvincible() {
    this._shellInvincible = false;
    this.invincible       = false;
    this._invincibleSFX?.stop();
    this._invincibleSFX?.destroy();
    this._invincibleSFX = null;
    this._shellAuraTween?.stop();
    this._shellAuraTween = null;
    this.shellAura.setAlpha(0).setScale(1);
    this._shellFlashTween?.stop();
    this._shellFlashTween = null;
    this.diver.setAlpha(1);
  }

  _updateCoinProgress() {
    if (!this.coinProgressTxt) return;
    const n = this._coinsCollectedTotal;
    this.coinProgressTxt
      .setText(`⬡  ${n}`)
      .setColor(n > 0 ? '#ddaa00' : '#554400');
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
    if (this.cache.audio.has('hitSFX')) this.sound.play('hitSFX', { volume: 0.9 * sfxVol() });
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

    this.time.delayedCall(850, () => { if (!this._shellInvincible) this.invincible = false; });

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
    this.lives = parseInt(localStorage.getItem(STORAGE_LIVES) || '0', 10);
    this._updateContinueLives();
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

    // Clear all walls, coins, shells + decorations so the player can't respawn inside a barrier
    this.walls.getChildren().slice().forEach(w => w.destroy());
    this.coinPickups.getChildren().slice().forEach(c => c.destroy());
    this.shellPickups.getChildren().slice().forEach(s => s.destroy());
    if (this._shellInvincible) this._endShellInvincible();
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

  _useLife() {
    if (this.lives <= 0) return;
    const newLives = this.lives - 1;
    localStorage.setItem(STORAGE_LIVES, newLives);
    this.lives = newLives;
    this._updateLivesHUD();
    this._revive();
  }

  _watchAd() {
    this.contEvt?.remove();
    this.contObjs.forEach(o => o.setVisible(false));
    const adTxt = this.add.text(W / 2, H / 2, 'LOADING AD...', {
      fontSize: '20px', fontFamily: 'Arial', color: '#0088bb',
    }).setOrigin(0.5).setDepth(65);
    // TODO (publishing): replace stub with AdMob.showRewardVideo({ adId: 'ca-app-pub-...' })
    //   On reward callback: adTxt.destroy(); this._revive();
    //   On dismiss/failure: adTxt.destroy(); show contObjs again
    this.time.delayedCall(1500, () => { adTxt.destroy(); this._revive(); });
  }

  _updateLivesHUD() {
    if (!this.livesTxt) return;
    this.livesTxt.setText(this.lives > 0 ? `♥ ${this.lives}` : '');
  }

  _updateContinueLives() {
    if (!this.contLivesLbl) return;
    const l = this.lives;
    this.contLivesLbl.setText(l > 0 ? `♥  ${l}  ${l === 1 ? 'life' : 'lives'} available` : 'No lives remaining');
    this.contLivesLbl.setColor(l > 0 ? '#cc0077' : '#445566');
    if (this.useLifeBtn) {
      this.useLifeBtn.setFillStyle(l > 0 ? 0x110010 : 0x0f0f0f);
      this.useLifeBtn.setStrokeStyle(1.5, l > 0 ? 0xcc0077 : 0x333333, l > 0 ? 0.8 : 0.35);
    }
    if (this.useLifeTxt) this.useLifeTxt.setColor(l > 0 ? '#cc0077' : '#333333');
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
    this.pauseSettingsObjs?.forEach(o => o.setVisible(false));
    this.pauseCustomizeObjs?.forEach(o => o.setVisible(false));
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
    this._scrollGroup(this.coinPickups, dt);
    this._scrollGroup(this.shellPickups, dt);
    this._scrollDecorations(dt);

    // ── SHELL AURA ────────────────────────────────────────────────
    if (this._shellInvincible) {
      this.shellAura.x = this.diver.x;
      this.shellAura.y = this.diver.y;
    }

    // ── PARTICLE TRAIL ────────────────────────────────────────────
    this.trailTimer += delta;
    if (this._trailEnabled && this.trailTimer > 80) {
      this.trailTimer = 0;
      // Tail position: offset from diver center toward the back end of the fish
      const angleRad = Phaser.Math.DegToRad(this.diver.angle);
      const flipSign = this.diver.flipX ? 1 : -1;
      const tx = this.diver.x + flipSign * 36 * Math.cos(angleRad);
      const ty = this.diver.y + flipSign * 36 * Math.sin(angleRad);
      this._spawnTrailParticles(tx, ty);
    }
    this.trail = this.trail.filter(e => {
      e.life -= dt * e.decay;
      e.img.x   += (e.velX || 0) * dt;
      e.img.y   += (e.velY || -30) * dt;
      e.img.alpha = e.life * (e.maxAlpha || 0.4);
      if (e.rotSpeed) e.img.angle += e.rotSpeed * dt;
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

  // ── TRAIL EMITTERS ────────────────────────────────────────────────────────

  _spawnTrailParticles(x, y) {
    switch (this._activeTrail) {
      case 'neon':      this._trailNeon(x, y);      break;
      case 'crimson':   this._trailCrimson(x, y);   break;
      case 'phantom':   this._trailPhantom(x, y);   break;
      case 'legendary': this._trailLegendary(x, y); break;
      default:          this._trailDefault(x, y);   break;
    }
  }

  // Default — small, subdued white/blue circles that drift straight up
  _trailDefault(x, y) {
    const r = Phaser.Math.FloatBetween(2, 4.5);
    const bub = this.add.circle(
      x + Phaser.Math.Between(-5, 5),
      y + Phaser.Math.Between(0, 8),
      r, 0xaaddff, 0.6
    ).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
    this.trail.push({ img: bub, life: 1.0, velX: Phaser.Math.Between(-8, 8), velY: -28, decay: 1.4, maxAlpha: 0.35 });
  }

  // Neon — electric cyan 4-point spinning stars with fast upward rise
  _trailNeon(x, y) {
    for (let i = 0; i < 2; i++) {
      const star = this.add.star(
        x + Phaser.Math.Between(-10, 10),
        y + Phaser.Math.Between(0, 10),
        4,
        Phaser.Math.FloatBetween(2, 3.5),
        Phaser.Math.FloatBetween(5, 8),
        0x00ccff
      ).setDepth(9).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9);
      this.trail.push({
        img: star, life: 1.0,
        velX: Phaser.Math.FloatBetween(-22, 22),
        velY: Phaser.Math.FloatBetween(-55, -38),
        decay: 1.1, maxAlpha: 0.85,
        rotSpeed: Phaser.Math.FloatBetween(180, 360) * (Math.random() < 0.5 ? 1 : -1),
      });
    }
    // Occasional small outer glow dot
    if (Math.random() < 0.4) {
      const dot = this.add.circle(
        x + Phaser.Math.Between(-14, 14), y,
        Phaser.Math.FloatBetween(1.5, 3), 0x88eeff, 0.5
      ).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
      this.trail.push({ img: dot, life: 1.0, velX: Phaser.Math.Between(-30, 30), velY: -45, decay: 1.8, maxAlpha: 0.5 });
    }
  }

  // Crimson — hot sparks: tiny red/orange scattered shards that burst outward
  _trailCrimson(x, y) {
    const colors = [0xff5544, 0xff8800, 0xffcc22];
    for (let i = 0; i < 3; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const r = Phaser.Math.FloatBetween(1.5, 3.5);
      const spark = this.add.circle(
        x + Phaser.Math.Between(-6, 6),
        y + Phaser.Math.Between(0, 6),
        r, color, 0.9
      ).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
      this.trail.push({
        img: spark, life: 1.0,
        velX: Phaser.Math.FloatBetween(-40, 40),
        velY: Phaser.Math.FloatBetween(-60, -20),
        decay: 2.2, maxAlpha: 0.8,
      });
    }
    // Ember — slightly larger, slower
    if (Math.random() < 0.5) {
      const ember = this.add.circle(
        x, y + Phaser.Math.Between(4, 10),
        Phaser.Math.FloatBetween(3, 5.5), 0xff3300, 0.6
      ).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
      this.trail.push({ img: ember, life: 1.0, velX: Phaser.Math.Between(-12, 12), velY: -18, decay: 1.0, maxAlpha: 0.55 });
    }
  }

  // Phantom — large translucent purple wispy orbs that ghost slowly upward
  _trailPhantom(x, y) {
    const count = Math.random() < 0.4 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const r = Phaser.Math.FloatBetween(7, 14);
      const wisp = this.add.circle(
        x + Phaser.Math.Between(-12, 12),
        y + Phaser.Math.Between(0, 12),
        r, 0xcc88ff, 0.5
      ).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
      this.trail.push({
        img: wisp, life: 1.0,
        velX: Phaser.Math.FloatBetween(-8, 8),
        velY: Phaser.Math.FloatBetween(-20, -10),
        decay: 0.75, maxAlpha: 0.4,
      });
    }
    // Small inner sparkle
    if (Math.random() < 0.6) {
      const sp = this.add.star(
        x + Phaser.Math.Between(-8, 8),
        y + Phaser.Math.Between(0, 8),
        6, 1.5, 4, 0xeeddff
      ).setDepth(9).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7);
      this.trail.push({
        img: sp, life: 1.0,
        velX: Phaser.Math.FloatBetween(-15, 15),
        velY: Phaser.Math.FloatBetween(-35, -20),
        decay: 1.6, maxAlpha: 0.65,
        rotSpeed: Phaser.Math.FloatBetween(60, 120),
      });
    }
  }

  // Legendary — spinning gold 5-point stars with stardust glow trail
  _trailLegendary(x, y) {
    const starCount = Math.random() < 0.5 ? 3 : 2;
    for (let i = 0; i < starCount; i++) {
      const inner = Phaser.Math.FloatBetween(3, 5);
      const outer = Phaser.Math.FloatBetween(7, 12);
      const gold = Math.random() < 0.6 ? 0xffdd00 : 0xffaa00;
      const gs = this.add.star(
        x + Phaser.Math.Between(-14, 14),
        y + Phaser.Math.Between(0, 12),
        5, inner, outer, gold
      ).setDepth(9).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9);
      this.trail.push({
        img: gs, life: 1.0,
        velX: Phaser.Math.FloatBetween(-30, 30),
        velY: Phaser.Math.FloatBetween(-60, -35),
        decay: 0.95, maxAlpha: 0.85,
        rotSpeed: Phaser.Math.FloatBetween(120, 300) * (Math.random() < 0.5 ? 1 : -1),
      });
    }
    // Stardust — tiny golden dots scatter wide
    for (let i = 0; i < 3; i++) {
      const dust = this.add.circle(
        x + Phaser.Math.Between(-18, 18),
        y + Phaser.Math.Between(0, 8),
        Phaser.Math.FloatBetween(1, 2.5), 0xffe066, 0.8
      ).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
      this.trail.push({
        img: dust, life: 1.0,
        velX: Phaser.Math.FloatBetween(-45, 45),
        velY: Phaser.Math.FloatBetween(-70, -25),
        decay: 2.0, maxAlpha: 0.7,
      });
    }
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

    // Top-left coin counter — total collected this run
    this.coinProgressTxt = this.add.text(14, 52 + ST, '⬡  0', {
      fontSize: '22px', fontFamily: 'Arial Black',
      color: '#554400', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(30);

    // Depth counter — electric cyan stroke
    this.depthTxt = this.add.text(W / 2, 52 + ST, '0m', {
      fontSize: '30px', fontFamily: 'Arial Black',
      color: '#ffffff', stroke: '#00ccff', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(30);

    // Lives counter — top-left below coin counter
    this.livesTxt = this.add.text(14, 76 + ST, '', {
      fontSize: '16px', fontFamily: 'Arial Black',
      color: '#cc0077', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0, 0.5).setDepth(30);
    this._updateLivesHUD();

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
    const d  = 55;
    const cx = W / 2;
    const pauseObjs = [];
    const mk = o => { pauseObjs.push(o); return o; };

    mk(this.add.rectangle(cx, H / 2, W, H, 0x000000, 0.88).setDepth(d));
    mk(this.add.rectangle(cx, H * 0.30, W * 0.80, 1, 0x0088bb, 0.30).setDepth(d + 1));

    mk(this.add.text(cx, H * 0.24, 'PAUSED', {
      fontSize: '52px', fontFamily: 'Arial Black',
      color: '#0088bb', stroke: '#fff', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(d + 1));

    const resumeBtn   = this._makeBtn(cx, H * 0.46, 'RESUME', 240, 56, 0x001122, 0x0099cc, 26, d + 1,
      () => this._resume());

    const settingsBtn = this._makeBtn(cx, H * 0.58, '⚙  SETTINGS', 240, 52, 0x080808, 0x445566, 22, d + 1,
      () => this.pauseSettingsObjs?.forEach(o => o.setVisible(true)));

    const quitBtn     = this._makeBtn(cx, H * 0.70, 'QUIT TO MENU', 240, 52, 0x120008, 0xdd0077, 21, d + 1,
      () => {
        this._resume();
        this.cameras.main.fadeOut(250);
        this.time.delayedCall(250, () => this.scene.start('Menu'));
      });

    pauseObjs.push(...resumeBtn, ...settingsBtn, ...quitBtn);
    this.pauseObjs = pauseObjs;
    this.pauseObjs.forEach(o => o.setVisible(false));

    this._buildPauseSettingsPanel(d + 2);
  }

  _buildPauseSettingsPanel(d) {
    const cx = W / 2;
    const objs = [];
    const mk = o => { objs.push(o); return o; };

    mk(this.add.rectangle(cx, H / 2, W, H, 0x000000, 0.94).setDepth(d));
    mk(this.add.rectangle(cx, H * 0.21, W * 0.80, 1, 0x445566, 0.25).setDepth(d + 1));

    mk(this.add.text(cx, H * 0.15, '⚙  SETTINGS', {
      fontSize: '28px', fontFamily: 'Arial Black',
      color: '#6688aa', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(d + 1));

    this._buildPauseSlider(mk, cx, H * 0.38, d + 1, '🎵  MUSIC',
      STORAGE_VOL_MUSIC, STORAGE_MUTE_MUSIC, 0.7,
      (vol, muted) => {
        const v = muted ? 0 : vol;
        this._musicSounds.forEach(s => s.setVolume(v));
      });

    this._buildPauseSlider(mk, cx, H * 0.57, d + 1, '🔊  SFX',
      STORAGE_VOL_SFX, STORAGE_MUTE_SFX, 0.7, () => {});

    // ── PARTICLE TRAIL TOGGLE ─────────────────────────────────────
    const trkW  = W - 100;
    const trkL  = cx - trkW / 2;
    const trkR  = cx + trkW / 2;
    const trlY  = H * 0.678;

    mk(this.add.text(trkL, trlY, '✦  PARTICLE TRAIL', {
      fontSize: '16px', fontFamily: 'Arial Black', color: '#6688aa',
    }).setOrigin(0, 0.5).setDepth(d + 1).setVisible(false));

    const trlBg = mk(this.add.rectangle(trkR - 40, trlY, 82, 34,
      this._trailEnabled ? 0x001122 : 0x111111)
      .setStrokeStyle(1.5, this._trailEnabled ? 0x0088bb : 0x334455, this._trailEnabled ? 0.8 : 0.5)
      .setDepth(d + 1).setVisible(false).setInteractive({ useHandCursor: true }));

    const trlTxt = mk(this.add.text(trkR - 40, trlY, this._trailEnabled ? 'ON' : 'OFF', {
      fontSize: '15px', fontFamily: 'Arial Black',
      color: this._trailEnabled ? '#00ccff' : '#334455',
    }).setOrigin(0.5).setDepth(d + 2).setVisible(false));

    trlBg.on('pointerdown', () => {
      if (!this.gamePaused) return;
      this._trailEnabled = !this._trailEnabled;
      localStorage.setItem(STORAGE_TRAIL, this._trailEnabled ? '1' : '0');
      trlBg.setFillStyle(this._trailEnabled ? 0x001122 : 0x111111);
      trlBg.setStrokeStyle(1.5, this._trailEnabled ? 0x0088bb : 0x334455, this._trailEnabled ? 0.8 : 0.5);
      trlTxt.setText(this._trailEnabled ? 'ON' : 'OFF')
        .setColor(this._trailEnabled ? '#00ccff' : '#334455');
    });

    // ── CUSTOMIZE ─────────────────────────────────────────────────
    mk(this.add.rectangle(cx, H * 0.770, W * 0.80, 1, 0x445566, 0.18).setDepth(d).setVisible(false));

    const [custBtn, custTxt] = this._makeBtn(cx, H * 0.830, '✦  CUSTOMIZE', 240, 48, 0x0a0018, 0x9944dd, 20, d + 1,
      () => {
        this._refreshPauseCustomize();
        this.pauseCustomizeObjs?.forEach(o => o.setVisible(true));
        this._pauseCustNav?.('main');
      });
    objs.push(custBtn, custTxt);
    custBtn.setVisible(false); custTxt.setVisible(false);

    const backBtn = mk(this.add.text(cx, H * 0.912, '‹  BACK', {
      fontSize: '18px', fontFamily: 'Arial Black', color: '#2a3a44',
    }).setOrigin(0.5).setDepth(d + 1).setVisible(false).setInteractive({ useHandCursor: true }));
    backBtn.on('pointerover', () => backBtn.setColor('#6688aa'));
    backBtn.on('pointerout',  () => backBtn.setColor('#2a3a44'));
    backBtn.on('pointerdown', () => objs.forEach(o => o.setVisible(false)));

    this.pauseSettingsObjs = objs;
    this.pauseSettingsObjs.forEach(o => o.setVisible(false));

    this._buildPauseCustomizePanel(d + 2);
  }

  _buildPauseCustomizePanel(d) {
    const cx     = W / 2;
    const cardW  = W - 48;
    const allObjs = [];
    const push = o => { allObjs.push(o); return o; };

    // ── CATEGORY LIST (main view) ─────────────────────────────────────────────
    const catObjs = [];
    const mkC = o => { push(o); catObjs.push(o); return o; };

    mkC(this.add.rectangle(cx, H / 2, W, H, 0x000000, 0.97).setDepth(d));
    mkC(this.add.text(cx, H * 0.10, '✦  CUSTOMIZE', {
      fontSize: '26px', fontFamily: 'Arial Black',
      color: '#9944dd', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(d + 1));
    mkC(this.add.rectangle(cx, H * 0.158, W * 0.80, 1, 0x6611aa, 0.20).setDepth(d + 1));

    const catDefs = [
      { icon: '🤿', label: 'PLAYER SKINS', storageKey: STORAGE_ACTIVE_SKIN,     data: SKINS     },
      { icon: '✨', label: 'PARTICLES',     storageKey: STORAGE_ACTIVE_TRAIL,    data: TRAILS    },
      { icon: '🪸', label: 'OBJECTS',       storageKey: STORAGE_ACTIVE_OBJ_SKIN, data: OBJ_SKINS },
      { icon: '🌊', label: 'BACKGROUNDS',   storageKey: STORAGE_ACTIVE_BG,       data: BG_SKINS  },
    ];
    const pageKeys = ['skin', 'trail', 'obj', 'bg'];

    catDefs.forEach((cat, i) => {
      const py = H * 0.255 + i * 98;
      const card = mkC(this.add.rectangle(cx, py, cardW, 82, 0x0a0018)
        .setStrokeStyle(1, 0x6611aa, 0.40).setDepth(d + 1).setInteractive({ useHandCursor: true }));
      mkC(this.add.text(cx - cardW / 2 + 28, py, cat.icon, {
        fontSize: '26px', fontFamily: 'Arial',
      }).setOrigin(0.5).setDepth(d + 2));
      mkC(this.add.text(cx - cardW / 2 + 62, py - 14, cat.label, {
        fontSize: '16px', fontFamily: 'Arial Black', color: '#9944dd', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0, 0.5).setDepth(d + 2));
      const activeKey = localStorage.getItem(cat.storageKey) || 'default';
      const activeName = cat.data.find(s => s.key === activeKey)?.name ?? 'DEFAULT';
      mkC(this.add.text(cx - cardW / 2 + 62, py + 12, activeName, {
        fontSize: '12px', fontFamily: 'Arial', color: '#445566',
      }).setOrigin(0, 0.5).setDepth(d + 2));
      mkC(this.add.text(cx + cardW / 2 - 14, py, '›', {
        fontSize: '28px', fontFamily: 'Arial Black', color: '#9944dd',
      }).setOrigin(1, 0.5).setDepth(d + 2));
      card.on('pointerover', () => card.setStrokeStyle(2, 0x9944dd, 0.8));
      card.on('pointerout',  () => card.setStrokeStyle(1, 0x6611aa, 0.40));
      card.on('pointerdown', () => { if (this.gamePaused) this._pauseCustNav?.(pageKeys[i]); });
    });

    const catBack = mkC(this.add.text(cx, H * 0.895, '‹  BACK', {
      fontSize: '18px', fontFamily: 'Arial Black', color: '#2a3a44',
    }).setOrigin(0.5).setDepth(d + 1).setInteractive({ useHandCursor: true }));
    catBack.on('pointerover', () => catBack.setColor('#6688aa'));
    catBack.on('pointerout',  () => catBack.setColor('#2a3a44'));
    catBack.on('pointerdown', () => {
      catObjs.forEach(o => o.setVisible(false));
      this.pauseSettingsObjs.forEach(o => o.setVisible(true));
    });

    // ── SUB-PANELS ────────────────────────────────────────────────────────────
    const skinPanel  = this._buildCosmeticSubPanel(d, push, '🤿  PLAYER SKINS',
      SKINS,     STORAGE_OWNED_SKINS,     STORAGE_ACTIVE_SKIN,     s => s.tint,
      item => {
        this._activeSkin = item.key;
        const t = SKIN_TINTS[item.key] ?? 0xffffff;
        // SPRITE SWAP POINT — replace setTint() with setTexture(item.spriteKey) when real sprites are ready
        this.diver.setTint(t); this.diverDead.setTint(t); this.diverGlow.setFillStyle(t, 0.22);
      });

    const trailPanel = this._buildCosmeticSubPanel(d, push, '✨  PARTICLES',
      TRAILS,    STORAGE_OWNED_TRAILS,    STORAGE_ACTIVE_TRAIL,    s => s.tint,
      item => { this._activeTrail = item.key; });

    const objPanel   = this._buildCosmeticSubPanel(d, push, '🪸  OBJECTS',
      OBJ_SKINS, STORAGE_OWNED_OBJ_SKINS, STORAGE_ACTIVE_OBJ_SKIN, s => s.tint,
      item => {
        this._activeObjSkin = item.key;
        this._objSkinTint   = item.tint;
        // SPRITE SWAP POINT — apply new obj skin tint to active walls/decorations
      });

    const bgPanel    = this._buildCosmeticSubPanel(d, push, '🌊  BACKGROUNDS',
      BG_SKINS,  STORAGE_OWNED_BGS,       STORAGE_ACTIVE_BG,       s => s.tint,
      item => {
        this._activeBgSkin = item.key;
        this._bgSkinTint   = item.tint;
        // SPRITE SWAP POINT — replace setTint() with setTexture() for bg layer sprites
        this.bgLayers.forEach(l => l.setTint(item.tint));
      });

    // ── NAV ───────────────────────────────────────────────────────────────────
    const pageMap = { main: catObjs, skin: skinPanel.subObjs, trail: trailPanel.subObjs, obj: objPanel.subObjs, bg: bgPanel.subObjs };
    this._pauseCustNav = page => {
      Object.values(pageMap).forEach(arr => arr.forEach(o => o.setVisible(false)));
      pageMap[page]?.forEach(o => o.setVisible(true));
    };

    this._pauseSkinRefs  = skinPanel.refs;
    this._pauseTrailRefs = trailPanel.refs;
    this._pauseObjRefs   = objPanel.refs;
    this._pauseBgRefs    = bgPanel.refs;

    this.pauseCustomizeObjs = allObjs;
    allObjs.forEach(o => o.setVisible(false));
  }

  _buildCosmeticSubPanel(d, push, title, dataArr, storageOwnedKey, storageActiveKey, getColor, onEquip) {
    const cx    = W / 2;
    const cardW = W - 48;
    const left  = cx - cardW / 2;
    const subObjs = [];
    const mk = o => { push(o); subObjs.push(o); return o; };
    const refs = [];

    mk(this.add.rectangle(cx, H / 2, W, H, 0x000000, 0.97).setDepth(d));
    mk(this.add.text(cx, H * 0.10, title, {
      fontSize: '22px', fontFamily: 'Arial Black',
      color: '#9944dd', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(d + 1));
    mk(this.add.rectangle(cx, H * 0.158, W * 0.80, 1, 0x6611aa, 0.20).setDepth(d + 1));
    mk(this.add.text(cx, H * 0.196, 'Unlock more in the Store', {
      fontSize: '12px', fontFamily: 'Arial', color: '#334455',
    }).setOrigin(0.5).setDepth(d + 1));

    dataArr.forEach((item, i) => {
      const py  = H * 0.285 + i * 72;
      const col = getColor(item);
      const isWhite = col === 0xffffff;

      const card = mk(this.add.rectangle(cx, py, cardW, 60, 0x0a0018)
        .setStrokeStyle(1, 0x6611aa, 0.35).setDepth(d + 1).setInteractive({ useHandCursor: true }));
      mk(this.add.circle(left + 34, py, 22, col, isWhite ? 0.45 : 0.8).setDepth(d + 2));
      mk(this.add.circle(left + 34, py, 22, 0, 0)
        .setStrokeStyle(1.5, col, isWhite ? 0.35 : 0.65).setDepth(d + 3));
      mk(this.add.text(left + 68, py - 9, item.name, {
        fontSize: '14px', fontFamily: 'Arial Black', color: '#cccccc', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0, 0.5).setDepth(d + 2));
      mk(this.add.text(left + 68, py + 11, item.rarity.toUpperCase(), {
        fontSize: '11px', fontFamily: 'Arial Black', color: item.rc,
      }).setOrigin(0, 0.5).setDepth(d + 2));

      const actionBtn = mk(this.add.rectangle(cx + cardW / 2 - 50, py, 84, 32, 0x1a0030)
        .setStrokeStyle(1, 0x6611aa, 0.7).setDepth(d + 2).setInteractive({ useHandCursor: true }));
      const actionTxt = mk(this.add.text(cx + cardW / 2 - 50, py, 'EQUIP', {
        fontSize: '12px', fontFamily: 'Arial Black', color: '#9944dd',
      }).setOrigin(0.5).setDepth(d + 3));

      refs.push({ actionBtn, actionTxt, item, storageOwnedKey, storageActiveKey });

      card.on('pointerover', () => card.setStrokeStyle(1.5, 0x9944dd, 0.7));
      card.on('pointerout',  () => card.setStrokeStyle(1, 0x6611aa, 0.35));
      actionBtn.on('pointerdown', () => {
        if (!this.gamePaused) return;
        const owned = (localStorage.getItem(storageOwnedKey) || 'default').split(',');
        if (!owned.includes(item.key)) return;
        localStorage.setItem(storageActiveKey, item.key);
        onEquip(item);
        this._refreshPauseCustomize();
      });
    });

    const backBtn = mk(this.add.text(cx, H * 0.895, '‹  BACK', {
      fontSize: '18px', fontFamily: 'Arial Black', color: '#2a3a44',
    }).setOrigin(0.5).setDepth(d + 1).setInteractive({ useHandCursor: true }));
    backBtn.on('pointerover', () => backBtn.setColor('#6688aa'));
    backBtn.on('pointerout',  () => backBtn.setColor('#2a3a44'));
    backBtn.on('pointerdown', () => { if (this.gamePaused) this._pauseCustNav?.('main'); });

    return { subObjs, refs };
  }

  _refreshPauseCustomize() {
    [this._pauseSkinRefs, this._pauseTrailRefs, this._pauseObjRefs, this._pauseBgRefs]
      .forEach(refs => this._refreshCosmeticRefs(refs));
  }

  _refreshCosmeticRefs(refs) {
    if (!refs) return;
    refs.forEach(({ actionBtn, actionTxt, item, storageOwnedKey, storageActiveKey }) => {
      const owned    = (localStorage.getItem(storageOwnedKey)  || 'default').split(',');
      const isActive = (localStorage.getItem(storageActiveKey) || 'default') === item.key;
      const isOwned  = owned.includes(item.key);
      if (isActive) {
        actionBtn.setFillStyle(0x002200).setStrokeStyle(1.5, 0x00cc66, 0.9);
        actionTxt.setText('✓ ACTIVE').setColor('#00cc66').setFontSize('10px');
      } else if (isOwned) {
        actionBtn.setFillStyle(0x001100).setStrokeStyle(1, 0x00aa44, 0.7);
        actionTxt.setText('EQUIP').setColor('#00aa44').setFontSize('12px');
      } else {
        actionBtn.setFillStyle(0x0f0f0f).setStrokeStyle(1, 0x222222, 0.4);
        actionTxt.setText('LOCKED').setColor('#333333').setFontSize('11px');
      }
    });
  }


  _buildPauseSlider(mk, cx, cy, d, label, volKey, mutKey, defaultVol, onChange) {
    const trackW     = W - 100;
    const trackLeft  = cx - trackW / 2;
    const trackRight = cx + trackW / 2;

    let vol   = parseFloat(localStorage.getItem(volKey));
    let muted = localStorage.getItem(mutKey) === '1';
    if (isNaN(vol) || vol < 0 || vol > 1) vol = defaultVol;

    const activeColor = 0x0088bb;
    const mutedColor  = 0x334455;
    const thumbActive = 0x00aacc;
    const thumbMuted  = 0x445566;

    const lbl = mk(this.add.text(trackLeft, cy - 38, label, {
      fontSize: '16px', fontFamily: 'Arial Black',
      color: muted ? '#334455' : '#6688aa',
    }).setOrigin(0, 0.5).setDepth(d).setVisible(false));

    const muteIcon = mk(this.add.text(trackRight, cy - 38, muted ? '🔇' : '🔊', {
      fontSize: '22px', fontFamily: 'Arial',
    }).setOrigin(1, 0.5).setDepth(d).setVisible(false)
      .setInteractive({ useHandCursor: true }));

    const pctTxt = mk(this.add.text(cx, cy + 28, `${Math.round(vol * 100)}%`, {
      fontSize: '13px', fontFamily: 'Arial', color: '#445566',
    }).setOrigin(0.5).setDepth(d).setVisible(false));

    mk(this.add.rectangle(cx, cy, trackW, 6, 0x1a2a3a).setDepth(d).setVisible(false));

    const fill = mk(this.add.rectangle(trackLeft, cy, trackW * vol, 6,
      muted ? mutedColor : activeColor).setOrigin(0, 0.5).setDepth(d + 1).setVisible(false));

    const thumb = mk(this.add.circle(trackLeft + trackW * vol, cy, 12,
      muted ? thumbMuted : thumbActive).setDepth(d + 2).setVisible(false)
      .setInteractive({ useHandCursor: true, draggable: true }));

    const zone = mk(this.add.rectangle(cx, cy, trackW, 40, 0x000000, 0)
      .setDepth(d + 1).setVisible(false).setInteractive({ useHandCursor: true }));

    const applyVol = (ratio) => {
      vol = Phaser.Math.Clamp(ratio, 0, 1);
      thumb.x    = trackLeft + trackW * vol;
      fill.width = trackW * vol;
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
      if (!this.gamePaused) return;
      applyVol((Phaser.Math.Clamp(dragX, trackLeft, trackRight) - trackLeft) / trackW);
    });
    zone.on('pointerdown', (ptr) => {
      if (!this.gamePaused) return;
      applyVol((Phaser.Math.Clamp(ptr.x, trackLeft, trackRight) - trackLeft) / trackW);
    });
    muteIcon.on('pointerdown', () => {
      if (!this.gamePaused) return;
      muted = !muted;
      applyMute();
    });
  }

  _buildContinueOverlay() {
    const d  = 60;
    const cx = W / 2;
    const bg = this.add.rectangle(cx, H / 2, W, H, 0x000000, 0.90).setDepth(d);

    const title = this.add.text(cx, H * 0.17, 'CONTINUE?', {
      fontSize: '46px', fontFamily: 'Arial Black',
      color: '#cc0077', stroke: '#fff', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(d + 1);

    this.contTxt = this.add.text(cx, H * 0.31, '10', {
      fontSize: '72px', fontFamily: 'Arial Black',
      color: '#cc0077', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(d + 1);

    const secLbl = this.add.text(cx, H * 0.415, 'seconds remaining', {
      fontSize: '13px', fontFamily: 'Arial', color: '#2a3a44',
    }).setOrigin(0.5).setDepth(d + 1);

    // Lives available display — refreshed in _showContinue()
    this.contLivesLbl = this.add.text(cx, H * 0.498, '', {
      fontSize: '18px', fontFamily: 'Arial Black', color: '#cc0077',
    }).setOrigin(0.5).setDepth(d + 1);

    // Use Life button — pink neon, disabled when lives = 0
    this.useLifeBtn = this.add.rectangle(cx, H * 0.545, 280, 52, 0x110010)
      .setStrokeStyle(1.5, 0xcc0077, 0.8)
      .setDepth(d + 1).setInteractive({ useHandCursor: true });
    this.useLifeTxt = this.add.text(cx, H * 0.545, 'USE A LIFE', {
      fontSize: '22px', fontFamily: 'Arial Black',
      color: '#cc0077', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(d + 2);
    this.useLifeBtn.on('pointerover',  () => this.useLifeBtn.setStrokeStyle(2.5, this.lives > 0 ? 0xcc0077 : 0x333333, 1.0));
    this.useLifeBtn.on('pointerout',   () => this.useLifeBtn.setStrokeStyle(1.5, this.lives > 0 ? 0xcc0077 : 0x333333, 0.8));
    this.useLifeBtn.on('pointerdown',  () => { this._sfx.button?.stop(); this._sfx.button?.play(); this._useLife(); });

    // Watch Ad button — green neon (free action)
    const adBtns = this._makeBtn(cx, H * 0.638, 'WATCH AD  —  FREE', 280, 52, 0x001100, 0x88bb00, 20, d + 1,
      () => this._watchAd());

    const buyHintTxt = this.add.text(cx, H * 0.718, 'Buy lives from the store before diving', {
      fontSize: '13px', fontFamily: 'Arial', color: '#2a3a44',
    }).setOrigin(0.5).setDepth(d + 1);

    const giveUpBtns = this._makeBtn(cx, H * 0.820, '✕  GIVE UP', 200, 44, 0x100000, 0x882222, 18, d + 1,
      () => {
        this.contEvt?.remove();
        const prev = parseInt(localStorage.getItem(STORAGE_BEST) || '0', 10);
        if (this.depth > prev) localStorage.setItem(STORAGE_BEST, this.depth);
        this._stopMusic();
        this.cameras.main.fadeOut(250);
        this.time.delayedCall(250, () => this.scene.start('Menu', { skipAbyss: true }));
      });

    this.contObjs = [bg, title, this.contTxt, secLbl, this.contLivesLbl,
      this.useLifeBtn, this.useLifeTxt, ...adBtns, buyHintTxt, ...giveUpBtns];
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
