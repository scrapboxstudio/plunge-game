import {
  W, H, SAFE_TOP, SAFE_BOTTOM, BIOMES, getBiomeIndexByTime,
  DIVER_Y, DIVER_ACCEL, DIVER_DRAG, DIVER_MAX_VX, DIVER_TILT, DIVER_MAX_TILT, DIVER_MARGIN,
  PRESSURE_DECAY, PRESSURE_HIT,
} from '../main.js';
import { getItem, setItem } from '../storage.js';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
  PLAYER_SPRITES, THEMES, SKIN_TINTS,
  STORAGE_ACTIVE_SPRITE,
  STORAGE_ACTIVE_SKIN,
  STORAGE_ACTIVE_TRAIL,
  STORAGE_ACTIVE_THEME,
} from '../config/cosmetics.js';

const STORAGE_COINS      = 'plunge_coins';
const STORAGE_BEST       = 'plunge_best';
const STORAGE_LIVES      = 'plunge_lives';
const STORAGE_VOL_MUSIC  = 'plunge_vol_music';
const STORAGE_VOL_SFX    = 'plunge_vol_sfx';
const STORAGE_MUTE_MUSIC = 'plunge_mute_music';
const STORAGE_MUTE_SFX   = 'plunge_mute_sfx';
const STORAGE_COSMETICS  = 'plunge_cosmetics';

const TIPS = [
  'Gaps alternate sides — stay centered and react early.',
  'Short taps give finer control than holding the button.',
  'Your pressure bar heals slowly when you stop hitting walls.',
  'Shells grant brief invincibility — use them to push through tight spots.',
  'The deeper you go, the faster walls move. Small corrections beat big swings.',
  'Coins spawn in clusters — stay on the same side of the screen to collect them.',
  'Your diver leans toward your direction of movement. Use the tilt to predict your path.',
  'Each biome shifts wall speed and gap width — adjust your rhythm as you descend.',
  'Collected a shell? Dive straight through a cluster and don\'t waste the invincibility.',
  'Lives carry over between runs. Spend them wisely.',
  'The gap center drifts left and right — watch the walls, not the diver.',
  'Pressure recovers the moment you stop hitting walls. Even a second of clean diving helps.',
];

function _readVol(key, def) {
  const v = parseFloat(getItem(key));
  return (isNaN(v) || v < 0 || v > 1) ? def : v;
}
function musicVol() {
  return getItem(STORAGE_MUTE_MUSIC) === '1' ? 0 : _readVol(STORAGE_VOL_MUSIC, 0.7);
}
function sfxVol() {
  return getItem(STORAGE_MUTE_SFX) === '1' ? 0 : _readVol(STORAGE_VOL_SFX, 0.7);
}

const WALL_H    = 110;
const FADE_MS   = 7000;  // biome crossfade — bg images, vignette, and music all use this

// Converts a 0–1 hue to a packed RGB hex (S=1, L=0.60 — vibrant, not blinding).
function _hueToHex(h) {
  h = ((h % 1) + 1) % 1;  // wrap to [0,1)
  const sector = h * 6;
  const C = 0.80, m = 0.20;
  const X = C * (1 - Math.abs(sector % 2 - 1));
  let r, g, b;
  if      (sector < 1) { r = C; g = X; b = 0; }
  else if (sector < 2) { r = X; g = C; b = 0; }
  else if (sector < 3) { r = 0; g = C; b = X; }
  else if (sector < 4) { r = 0; g = X; b = C; }
  else if (sector < 5) { r = X; g = 0; b = C; }
  else                 { r = C; g = 0; b = X; }
  return (Math.round((r + m) * 255) << 16) | (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255);
}


export default class Game extends Phaser.Scene {
  constructor() { super('Game'); }

  // ── LIFECYCLE ─────────────────────────────────────────────────────────────

  create() {
    // State
    this.depth      = 0;
    this.gameTime   = 0;
    this._prevBest     = parseInt(getItem(STORAGE_BEST) || '0', 10);
    this._newRecord    = false;
    this._lastGapCenter = undefined;  // used to alternate gap sides and force movement
    this._recentSkins   = {};         // biomeIdx → recently-used skin keys (avoids repeats)
    this.pressure   = 0;       // 0.0 → 1.0 → death
    this.dead       = false;
    this.invincible = false;
    this.biomeIdx   = 0;
    this._eff       = { ...BIOMES[0] };  // interpolated difficulty values, updated each tick
    this.gamePaused = false;
    this.coins        = parseInt(getItem(STORAGE_COINS) || '0', 10);
    this.lives        = parseInt(getItem(STORAGE_LIVES) || '0', 10);
    this._cosmeticsEnabled = getItem(STORAGE_COSMETICS) !== '0';
    this._objSkinTint = 0xffffff;
    this._bgSkinTint  = 0xffffff;
    this._syncTints();

    // Input flags
    this.steerLeft  = false;
    this.steerRight = false;

    this.decorations = [];

    // Shell (invincibility) state
    this._shellsThisBiome    = 0;   // shells spawned in current biome/batch (max 1)
    this._nextShellIn        = this._shellSpawnDelay(false);
    this._shellBatchDepth    = 0;   // depth at which the last shell batch began
    this._warpSpeedMult       = 1;   // speed multiplier applied to all obstacle scrolling (>1 during shell warp)
    this._warpTimeLeft        = 0;   // seconds of warp remaining
    this._shellInvincible     = false;
    this._invincibleSFX       = null;

    // Coin state — depth-based batches: 30 coins per 5000m, infinite
    this._coinsThisBatch      = 0;   // coins spawned in the current 5000m batch
    this._coinBatchStartDepth = 0;   // depth at which the current batch began
    this._nextCoinDepth       = 100; // depth threshold before the next coin may spawn
    this._coinsCollectedTotal = 0;   // total collected this run
    this._lastGaps            = null;

    // Shark charge — clean-distance meter that triggers an 8s bust ability
    this._sharkChargeDist  = 0;
    this._sharkBusting     = false;
    this._sharkBustTimer   = 0;

    // Neon theme electricity spark timer
    this._neonSparkTimer   = 0;

    // Pre-create one reusable instance per SFX — safe: returns null if file wasn't loaded.
    // All play calls use optional chaining so a missing file never crashes the game.
    const sv = sfxVol();
    const _snd = (key, vol) =>
      this.cache.audio.has(key) ? this.sound.add(key, { volume: vol * sv }) : null;
    this._sfx = {
      button: _snd('buttonSFX', 0.7),
      woosh:  _snd('wooshSFX',  1.0),
      hit:    _snd('hitSFX',    0.9),
      coin:   _snd('coinSFX',   0.75),
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
    this.diver = this.physics.add.image(W / 2, DIVER_Y, 'fishAlive')
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

    this.diverGlow = this.add.circle(W / 2, DIVER_Y, 38, this._cosmeticsEnabled ? (SKIN_TINTS[this._activeSkin] ?? 0x00eeff) : 0xffffff, 0.22)
      .setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: this.diverGlow,
      alpha: 0.08, scaleX: 1.6, scaleY: 1.6,
      yoyo: true, repeat: -1, duration: 900,
    });

    // Dead sprite — same size/blend, hidden until hit or death
    this.diverDead = this.add.image(W / 2, DIVER_Y, 'fishDead')
      .setDepth(11)
      .setDisplaySize(88, 88)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);

    this._activeSprite = getItem(STORAGE_ACTIVE_SPRITE) || 'default';
    this._activeSkin   = getItem(STORAGE_ACTIVE_SKIN)  || 'default';
    this._activeTrail  = getItem(STORAGE_ACTIVE_TRAIL) || 'default';
    this._activeTheme  = getItem(STORAGE_ACTIVE_THEME) || 'default';
    this._rainbowHue   = Math.random();  // random start so all legendary items don't sync on boot
    const { alive: _aliveKey, dead: _deadKey } = this._spriteTexKeys();
    this.diver.setTexture(_aliveKey);
    this.diverDead.setTexture(_deadKey);
    const _skinTint = this._cosmeticsEnabled ? (SKIN_TINTS[this._activeSkin] ?? 0xffffff) : 0xffffff;
    this.diver.setTint(_skinTint);
    this.diverDead.setTint(_skinTint);

    const _spriteEntry  = PLAYER_SPRITES.find(s => s.key === this._activeSprite) ?? PLAYER_SPRITES[0];
    this._speedMult = 1 + (_spriteEntry.speedBonus ?? 0) / 100;
    this._armorMult = 1 - (_spriteEntry.armorBonus ?? 0) / 100;
    this.diver.setMaxVelocity(DIVER_MAX_VX * this._speedMult, 0);

    // ── WALLS ────────────────────────────────────────────────────────────────
    this.walls = this.physics.add.staticGroup();
    this.physics.add.overlap(this.diver, this.walls, (d, wall) => this._onWallOverlap(d, wall), null, this);

    // ── COINS ─────────────────────────────────────────────────────────────────
    this.coinPickups = this.physics.add.staticGroup();
    this.physics.add.overlap(this.diver, this.coinPickups, (d, coin) => this._collectCoin(coin), null, this);

    // ── SHELLS ────────────────────────────────────────────────────────────────
    this.shellPickups = this.physics.add.staticGroup();
    this.physics.add.overlap(this.diver, this.shellPickups, (d, shell) => this._collectShell(shell), null, this);

    // ── OCTO REACH HITBOX ─────────────────────────────────────────────────────
    // Larger invisible zone that follows the diver; only active for Octo skin.
    // Participates in coin/shell overlaps only — wall collision uses the normal diver body.
    this.diverOctoReach = this.add.rectangle(W / 2, DIVER_Y, 140, 140).setVisible(false).setDepth(0);
    this.physics.add.existing(this.diverOctoReach, false);
    this.diverOctoReach.body.setAllowGravity(false);
    this.diverOctoReach.body.enable = false;
    this.physics.add.overlap(this.diverOctoReach, this.coinPickups,  (d, coin)  => this._collectCoin(coin),   null, this);
    this.physics.add.overlap(this.diverOctoReach, this.shellPickups, (d, shell) => this._collectShell(shell), null, this);

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
    this._buildTapTutorial();

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
      try { this._sharkBustSFX?.stop(); this._sharkBustSFX?.destroy(); } catch (_) {}
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
    const _depthGain = Math.round(this._eff.fallSpeed / 38 * this._warpSpeedMult);
    this.depth += _depthGain;
    // Shark charge — accumulate clean depth; hitting a wall resets this in _onWallOverlap
    if ((this._activeSprite === 'shark' || this._activeSprite === 'kraken') && !this._sharkBusting) {
      this._sharkChargeDist += _depthGain;
      if (this._sharkChargeDist >= 5000) this._activateSharkBust();
    }
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
    // New shell every ~5000m — short countdown after batch reset so it actually fires
    if (this.depth - this._shellBatchDepth >= 5000) {
      this._shellsThisBiome = 0;
      this._shellBatchDepth = this.depth;
      this._nextShellIn     = this._shellSpawnDelay(true);
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
      this._syncTints();
      this.spawnEvent.delay   = BIOMES[newIdx].spawnMs;
      this.spawnEvent.elapsed = 0;

      // Reset shell batch for the new biome; coin batches are depth-based and continue uninterrupted
      this._shellsThisBiome = 0;
      this._shellBatchDepth = this.depth;
      this._nextShellIn     = this._shellSpawnDelay(false);

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

      // The Void: start cycling backgrounds every 2 minutes
      if (newIdx === BIOMES.length - 1 && b.bgCycles) {
        this._voidBgIdx = 0;
        if (this._voidBgTimer) this._voidBgTimer.remove();
        this._voidBgTimer = this.time.addEvent({
          delay: 120_000,
          callback: this._voidBgTick,
          callbackScope: this,
          loop: true,
        });
      }
    }
  }

  _voidBgTick() {
    const b = BIOMES[this.biomeIdx];
    if (!b?.bgCycles) return;
    this._voidBgIdx = ((this._voidBgIdx ?? 0) + 1) % b.bgCycles.length;
    const cycle    = b.bgCycles[this._voidBgIdx];
    const nextSlot = 1 - this.bgSlot;

    if (this._bgFadeInTween)  this._bgFadeInTween.stop();
    if (this._bgFadeOutTween) this._bgFadeOutTween.stop();
    this.bgLayers[nextSlot].setTexture(cycle.key).setDisplaySize(W * 1.15, H * 1.15).setAlpha(0).setTint(this._bgSkinTint);
    this._bgFadeInTween  = this.tweens.add({ targets: this.bgLayers[nextSlot],    alpha: 0.38, duration: FADE_MS });
    this._bgFadeOutTween = this.tweens.add({ targets: this.bgLayers[this.bgSlot], alpha: 0,    duration: FADE_MS });
    this.bgSlot = nextSlot;
    this.time.delayedCall(FADE_MS / 2, () => { if (this.bg?.active) this.bg.setFillStyle(cycle.bg); });
  }

  // Compute the effective obj/bg tint for the current biome + active theme.
  // Themes can define biomeTints: { biomeIdx: 0xRRGGBB } to override specific biomes.
  _syncTints() {
    if (!this._cosmeticsEnabled) {
      this._objSkinTint = 0xffffff;
      this._bgSkinTint  = 0xffffff;
      return;
    }
    const themeKey = getItem(STORAGE_ACTIVE_THEME) || 'default';
    const theme    = THEMES.find(t => t.key === themeKey);
    const override = theme?.biomeTints?.[this.biomeIdx];
    const tint     = (override != null) ? override : (theme?.tint ?? 0xffffff);
    this._objSkinTint = tint;
    this._bgSkinTint  = tint;
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
    for (let i = 0; i < bi; i++) biomeStartMs += BIOMES[i].duration * 1000;
    const t = Math.min(1, Math.max(0,
      (this.gameTime - biomeStartMs) / (b.duration * 1000)
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
    const key = this._getMusicKey(trackIdx);

    // If this track isn't cached yet, start fetching it and poll until ready.
    // The previous track keeps playing during the load so there's no hard cut.
    if (!this.cache.audio.exists(key)) {
      if (!this._audioLoading) this._audioLoading = new Set();
      if (!this._audioLoading.has(key)) {
        this._audioLoading.add(key);
        this.load.audio(key, `assets/${key}.mp3`);
        this.load.start();
        this.load.once(Phaser.Loader.Events.COMPLETE, () => this._audioLoading?.delete(key));
      }
      this.time.delayedCall(250, () => this._playMusicTrack(trackIdx));
      return;
    }

    const SONG_MS = 120000;
    const music   = this.sound.add(key, { volume: 0, loop: false });
    this._musicSounds.push(music);
    music.play();
    // First track of a run fades in fast (1.2 s) so music is audible within a second
    // of diving; later tracks use the full 7 s crossfade for smooth biome transitions.
    const fadeIn = this._currentMusic ? FADE_MS : 1200;
    this.tweens.add({ targets: music, volume: musicVol(), duration: fadeIn });

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

    // Immediately start fetching the next track in the background so it's
    // ready well before the crossfade point (FADE_MS = 7 s before end).
    const nextKey = this._getMusicKey(trackIdx + 1);
    if (!this.cache.audio.exists(nextKey)) {
      if (!this._audioLoading) this._audioLoading = new Set();
      if (!this._audioLoading.has(nextKey)) {
        this._audioLoading.add(nextKey);
        this.load.audio(nextKey, `assets/${nextKey}.mp3`);
        this.load.start();
        this.load.once(Phaser.Loader.Events.COMPLETE, () => this._audioLoading?.delete(nextKey));
      }
    }

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
    const numGaps      = Phaser.Math.Between(b.minGaps, b.maxGaps);
    const gaps         = this._generateGaps(numGaps, b.gapWidth, 0, W);
    this._lastGaps     = gaps;
    const zones        = this._getObstacleZones(gaps, 0, W);
    const skins        = BIOMES[this.biomeIdx].fillSkins;
    const bgPool       = BIOMES[this.biomeIdx].bgSkins;
    const isGhostTheme = this._cosmeticsEnabled && this._activeTheme === 'phantom';

    zones.forEach(zone => {
      const { x1, x2 } = zone;
      const zoneW = x2 - x1;
      if (zoneW <= 2) return;

      const isLeft  = x1 <= 2;
      const isRight = x2 >= W - 2;
      // ~12% of zones are phantom — no collision, flashing visual
      const isGhost = isGhostTheme && Math.random() < 0.12;

      if ((isLeft || isRight) && bgPool && bgPool.length) {
        // Ghost zones skip the physics rect so the player passes straight through
        if (!isGhost) {
          const rect = this.add.rectangle((x1 + x2) / 2, spawnY, zoneW, WALL_H, 0x000000, 0);
          this.physics.add.existing(rect, true);
          this.walls.add(rect);
          rect.setData('velY', speed);
        }

        const skin  = Phaser.Utils.Array.GetRandom(bgPool);
        const img   = this.add.image(0, spawnY, skin.key)
          .setFlipX(Math.random() < 0.5)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(6);
        const dispW = img.width * (WALL_H / img.height);
        img.setDisplaySize(dispW, WALL_H);
        img.setX(isLeft ? x2 - dispW / 2 : x1 + dispW / 2);
        img.setData('velY', speed).setTint(this._objSkinTint);
        this.decorations.push({ obj: img, isDecor: true });
        if (isGhostTheme) {
          this._addPhantomGlow(img.x, spawnY, img.displayWidth, WALL_H, speed);
        }

        if (isGhost) {
          this.tweens.add({
            targets: img, alpha: { from: 0.06, to: 0.52 },
            yoyo: true, repeat: -1,
            duration: Phaser.Math.Between(260, 500), ease: 'Sine.InOut',
          });
        }
      } else {
        if (isGhost) {
          // Interior ghost zone — track newly pushed decorations and flash them
          const before = this.decorations.length;
          this._addSkinWallZone(x1, x2, spawnY, WALL_H, speed, skins, false);
          for (let i = before; i < this.decorations.length; i++) {
            const e = this.decorations[i];
            if (e.obj?.active) {
              this.tweens.add({
                targets: e.obj, alpha: { from: 0.06, to: 0.52 },
                yoyo: true, repeat: -1,
                duration: Phaser.Math.Between(260, 500), ease: 'Sine.InOut',
              });
            }
          }
        } else {
          this._addSkinWallZone(x1, x2, spawnY, WALL_H, speed, skins);
        }
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

    // For 2 gaps: use a fixed-interior layout so fill sprites are never squished.
    // Layout: [leftOuter] [gap1] [interiorSprite] [gap2] [rightOuter]
    // The interior zone is exactly one XS (smallest tier) sprite wide — perfect fit, no scaling.
    const biome     = BIOMES[this.biomeIdx];
    const fillTiers = biome.fillSkins
      ? [...new Set(biome.fillSkins.map(s => s.w))].sort((a, b) => a - b)
      : [];
    const interiorW = fillTiers.length > 0 ? fillTiers[0] : 70;
    const remaining = (xMax - xMin) - 2 * gapW - interiorW;
    const minOuter  = 12;

    if (remaining < 2 * minOuter) {
      return this._generateGaps(1, gapW, xMin, xMax);
    }

    const leftW  = minOuter + Math.random() * (remaining - 2 * minOuter);
    const gap1x1 = xMin + leftW;
    const intX1  = gap1x1 + gapW;
    const gap2x1 = intX1 + interiorW;

    this._lastGapCenter = gap1x1 + gapW / 2;
    return [
      { x1: gap1x1, x2: gap1x1 + gapW },
      { x1: gap2x1, x2: gap2x1 + gapW },
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

    const natW = sk => sk.w;

    // Derive the distinct size tiers from the skin list (e.g. [70,120,190,260,340] for coral).
    // Each tier has exactly 2 variants (coralXS1/2, coralS1/2, etc.).
    const tiers = [...new Set(skins.map(natW))].sort((a, b) => a - b);

    // Find (count, tier) where sprites are never stretched — only scaled down if needed.
    // Rule: total natural width must be ≥ zoneW so adj = zoneW/total ≤ 1.0 always.
    // Among valid combinations, pick the one with highest adj (minimum downscale).
    // Small zones → XS tier; large zones → XL tier (naturally falls out of the scoring).
    let bestCount = 1, bestTierW = tiers[0], bestAdj = 0;
    for (let c = 1; c <= 12; c++) {
      for (const tierW of tiers) {
        const total = c * tierW;
        if (total < zoneW) continue;         // would need adj > 1.0 (stretch) — skip
        const adj = zoneW / total;           // always ≤ 1.0
        if (adj > bestAdj) { bestCount = c; bestTierW = tierW; bestAdj = adj; }
      }
    }

    // tierPool = the two sprites of the chosen size (e.g. coralXS1 + coralXS2).
    // _pickSkin alternates between them to avoid consecutive repeats.
    const tierPool = skins.filter(sk => natW(sk) === bestTierW);
    const picked   = Array.from({ length: bestCount }, () => this._pickSkin(tierPool));
    const adj      = zoneW / picked.reduce((s, sk) => s + natW(sk), 0); // ≤ 1.0

    let cursor = x1;
    picked.forEach(skin => {
      const dispW = natW(skin) * adj;
      const sx    = cursor + dispW / 2;
      const img   = this.add.image(sx, cy, skin.key)
        .setDisplaySize(dispW, wallH)
        .setFlipX(Math.random() < 0.5)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(6);
      img.setData('velY', velY).setTint(this._objSkinTint);
      this.decorations.push({ obj: img, isDecor: true });
      if (this._cosmeticsEnabled && this._activeTheme === 'phantom') {
        this._addPhantomGlow(sx, cy, dispW, wallH, velY);
      }
      cursor += dispW;
    });
  }

  // Pick a skin from pool, avoiding the most recently used entry (window = half pool size).
  // For 2-sprite tier pools this alternates between the two variants.
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
    const color = this._objSkinTint;
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

    this._sfx.coin?.stop(); this._sfx.coin?.play();

    this._coinsCollectedTotal++;
    this.coins++;
    setItem(STORAGE_COINS, this.coins);
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

  _spriteTexKeys() {
    const sp = PLAYER_SPRITES.find(s => s.key === this._activeSprite) ?? PLAYER_SPRITES[0];
    return { alive: sp.spriteKey + 'Alive', dead: sp.spriteKey + 'Dead' };
  }

  // ── SHELL (INVINCIBILITY) ─────────────────────────────────────────────────

  _shellSpawnDelay(forBatchReset = false) {
    // Convert a target wait time to wall-row count so it works regardless of biome speed.
    const spawnMs  = this._eff?.spawnMs ?? BIOMES[this.biomeIdx].spawnMs;
    const targetMs = forBatchReset
      ? Phaser.Math.Between(2000,  6000)  // 2–6 s after a batch reset
      : Phaser.Math.Between(8000, 18000); // 8–18 s after biome entry
    return Math.max(2, Math.round(targetMs / spawnMs));
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
    const margin = 32;
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
    shell.body.setSize(56, 56, true); // generous hitbox — texture is 28×28, visual pulses to ~48px
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
    this._sfx.coin?.stop(); this._sfx.coin?.play();
    if (this.cache.audio.has('invincibleSFX')) {
      this._invincibleSFX = this.sound.add('invincibleSFX', { volume: 0.8 * sfxVol(), loop: true });
      this._invincibleSFX.play();
    }

    this._shellInvincible = true;
    this.invincible       = true;

    // Warp depth jump + visuals
    this._doWarpEffect();

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

  _doWarpEffect() {
    // Activate warp: obstacles, coins, and decorations scroll at 7× speed for 1.5 s.
    // Depth increments in _tick() also multiply by _warpSpeedMult, so ~500 m is gained
    // naturally through the existing depth-per-tick system.
    this._warpSpeedMult = 7;
    this._warpTimeLeft  = 1.5;

    // Full-screen platinum flash
    this.cameras.main.flash(220, 180, 220, 255, false);

    // Quick zoom-in then snap back — feels like a burst of speed
    this.cameras.main.zoomTo(1.16, 110, 'Linear', true);
    this.time.delayedCall(110, () => this.cameras.main.zoomTo(1.0, 420, 'Power2Out'));

    // Biome shimmer burst
    this.bgShimmer.setAlpha(0.50);
    this.tweens.add({ targets: this.bgShimmer, alpha: 0, duration: 1200 });

    // Vertical speed lines flying upward
    for (let i = 0; i < 18; i++) {
      const lx  = Phaser.Math.Between(8, W - 8);
      const len = Phaser.Math.Between(40, 140);
      const ln  = this.add.rectangle(
        lx, Phaser.Math.Between(H * 0.1, H * 0.9), 1.5, len, 0xbbddff, 0.80
      ).setDepth(45).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: ln, y: ln.y - 480, alpha: 0,
        duration: Phaser.Math.Between(120, 320),
        onComplete: () => ln.destroy(),
      });
    }

    // Diver afterimages stacked above (trailing behind as the diver rushes down)
    for (let i = 1; i <= 6; i++) {
      const ghost = this.add.image(this.diver.x, DIVER_Y - i * 20, this._spriteTexKeys().alive)
        .setDisplaySize(88, 88)
        .setFlipX(this.diver.flipX)
        .setAngle(this.diver.angle)
        .setTint(this._cosmeticsEnabled ? (SKIN_TINTS[this._activeSkin] ?? 0xffffff) : 0xffffff)
        .setAlpha(0.50 - i * 0.07)
        .setDepth(9)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: ghost, alpha: 0,
        duration: 180 + i * 45,
        onComplete: () => ghost.destroy(),
      });
    }

    // "WARP!" pop, then depth gained shown when warp ends
    const pop = this.add.text(W / 2, H * 0.48, 'WARP!', {
      fontSize: '36px', fontFamily: 'Arial Black',
      color: '#bbddff', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(45).setAlpha(0).setScale(0.4);
    this.tweens.add({
      targets: pop, alpha: 1, scaleX: 1.1, scaleY: 1.1, duration: 200, ease: 'Back.Out',
      onComplete: () => this.time.delayedCall(1000, () =>
        this.tweens.add({ targets: pop, alpha: 0, y: pop.y - 55, duration: 450,
          onComplete: () => pop.destroy() })),
    });
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
    this.pressure = Math.min(this.pressure + PRESSURE_HIT * this._armorMult, 1.0);
    this._sfx.hit?.stop(); this._sfx.hit?.play();
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
    this.lives = parseInt(getItem(STORAGE_LIVES) || '0', 10);
    this._updateContinueLives();
    // Clear any leftover "life earned" pulse so the button isn't left scaled.
    this.tweens.killTweensOf([this.useLifeBtn, this.useLifeTxt].filter(Boolean));
    this.useLifeBtn?.setScale(1);
    this.useLifeTxt?.setScale(1);
    // Reset the tip to its default style (the ad "life earned" cue recolours it).
    this.contTipTxt.setColor('#8899aa').setText('tip: ' + Phaser.Utils.Array.GetRandom(TIPS));
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
    if (this._reviving) return;
    this._reviving = true;
    this.contEvt?.remove();
    this.contObjs.forEach(o => o.setVisible(false));

    // Defensive: the continue/ad path never pauses these, but guarantee the scene
    // clock and physics are running so a revive can never land on a frozen world
    // (e.g. if Phaser auto-paused while the native ad overlay had focus).
    this.gamePaused  = false;
    this.time.paused = false;
    this.physics.resume();

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
        this._reviving = false;
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
    setItem(STORAGE_LIVES, newLives);
    this.lives = newLives;
    this._updateLivesHUD();
    this._revive();
  }

  // Watch a rewarded ad to earn a life. Deliberately does NOT auto-revive — every
  // attempt to resume the run from the ad-dismiss callback raced the WebView regaining
  // focus and froze. Instead we grant +1 life and re-show the continue screen so the
  // player taps USE A LIFE to revive through the proven _useLife() → _revive() path.
  // That tap happens on a clean, fully-focused frame, so there is no timing race.
  async _watchAd() {
    if (this._adInProgress) return;
    this._adInProgress = true;
    this.contEvt?.remove();                 // stop the continue countdown during the ad
    this.contObjs.forEach(o => o.setVisible(false));

    // Silence music immediately — ad has its own audio
    this._musicSounds.forEach(s => s.setVolume(0));

    const adTxt = this.add.text(W / 2, H / 2, 'LOADING AD...', {
      fontSize: '20px', fontFamily: 'Arial', color: '#0088bb',
    }).setOrigin(0.5).setDepth(65);

    const { AdMob, RewardAdPluginEvents } = await import('@capacitor-community/admob');

    const _restoreMusic = () => {
      this._musicSounds.forEach(s => {
        if (s?.active) this.tweens.add({ targets: s, volume: musicVol(), duration: 800 });
      });
    };

    // _earned — the player has earned the life. Set by ANY of three signals:
    //   1. the Rewarded event listener,
    //   2. the value showRewardVideoAd() resolves with (native call.resolve at reward time),
    //   3. a 30 s failsafe (a full rewarded ad) — covers devices that never report the
    //      reward to JS, so a watched ad always grants the life.
    // _resolved — the single final decision has run.
    let _earned   = false;
    let _resolved = false;
    let failTimer = null;   // 30 s failsafe: assume the reward was earned
    let backstop  = null;   // 45 s ultimate unblock if Dismissed never fires
    let rwdHandle = null, dsmHandle = null, failHandle = null;

    // Restore control to the continue screen. Granting the life and re-showing the
    // continue screen are both safe even if the ad overlay is still up — nothing
    // resumes the run until the player taps USE A LIFE afterwards.
    const _resolve = () => {
      if (_resolved) return;
      _resolved = true;
      if (failTimer) { clearTimeout(failTimer); failTimer = null; }
      if (backstop)  { clearTimeout(backstop);  backstop  = null; }
      // addListener returns a Promise<PluginListenerHandle>; these are the resolved
      // handles, so .remove() works and listeners don't leak across ad views.
      try { rwdHandle?.remove(); }  catch {}
      try { dsmHandle?.remove(); }  catch {}
      try { failHandle?.remove(); } catch {}
      if (adTxt?.active) adTxt.destroy();
      _restoreMusic();

      if (_earned) {
        const lives = parseInt(getItem(STORAGE_LIVES) || '0', 10) + 1;
        setItem(STORAGE_LIVES, lives);
      }
      this._adInProgress = false;

      // Re-show the continue screen (re-reads lives, activates USE A LIFE, restarts countdown)
      this._showContinue();
      if (_earned) this._showLifeEarnedCue();
    };

    // 30 s failsafe — after a full ad, treat the reward as earned even if no JS signal came.
    failTimer = setTimeout(() => { _earned = true; }, 30000);
    // 45 s backstop — if Dismissed never fires, still hand control back (life already earned).
    backstop  = setTimeout(() => { _resolve(); }, 45000);

    try {
      // Await the handles so .remove() actually works. Inside the try so any
      // registration/show failure routes to _resolve() and unblocks the button.
      rwdHandle  = await AdMob.addListener(RewardAdPluginEvents.Rewarded,     () => { _earned = true; });
      dsmHandle  = await AdMob.addListener(RewardAdPluginEvents.Dismissed,    () => { _resolve(); });
      failHandle = await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => { _resolve(); });

      await AdMob.prepareRewardVideoAd({ adId: 'ca-app-pub-1522961874159114/2489265257' });
      // showRewardVideoAd() resolves with the reward item the instant it's earned
      // (ad still showing) — a backup to the Rewarded event. On a skip it simply never
      // resolves, which is fine: the Dismissed event still drives the outcome.
      const reward = await AdMob.showRewardVideoAd();
      if (reward) _earned = true;
    } catch (e) {
      _resolve();
    }
  }

  // Brief cue shown on the continue screen after an ad grants a life.
  _showLifeEarnedCue() {
    if (this.contTipTxt?.active) {
      this.contTipTxt.setText('✓  1 LIFE EARNED  —  tap USE A LIFE to continue').setColor('#88bb00');
    }
    const targets = [this.useLifeBtn, this.useLifeTxt].filter(o => o?.active);
    if (targets.length) {
      this.tweens.add({ targets, scaleX: 1.08, scaleY: 1.08, yoyo: true, repeat: 3, duration: 220 });
    }
  }

  _updateLivesHUD() {
    if (!this.livesTxt) return;
    this.livesTxt.setText(this.lives > 0 ? `♥ ${this.lives}` : '');
  }

  _updateCosmeticToggleUI() {
    const on = this._cosmeticsEnabled;
    this._cosmeticToggleBg?.setFillStyle(on ? 0x001122 : 0x111111)
      .setStrokeStyle(1.5, on ? 0x0088bb : 0x334455, on ? 0.8 : 0.5);
    this._cosmeticToggleTxt?.setText(on ? 'ON' : 'OFF').setColor(on ? '#00ccff' : '#334455');
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
        spriteAliveKey: this._spriteTexKeys().alive,
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
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  update(time, delta) {
    if (this.gamePaused || this.dead) return;
    const dt = delta / 1000;

    // ── DIVER PHYSICS ─────────────────────────────────────────────
    let vx = this.diver.body.velocity.x;

    const _accel = DIVER_ACCEL * this._speedMult;
    if (this.steerLeft) {
      if (vx > 0) vx = 0;  // snap opposing momentum so direction change is instant
      vx -= _accel * dt;
    } else if (this.steerRight) {
      if (vx < 0) vx = 0;
      vx += _accel * dt;
    } else {
      vx *= DIVER_DRAG;
    }

    vx = Phaser.Math.Clamp(vx, -DIVER_MAX_VX * this._speedMult, DIVER_MAX_VX * this._speedMult);

    this.diver.setVelocityX(vx);
    this.diver.setVelocityY(0);

    // Octo bobs vertically; kraken inherits this; everything else is pinned to DIVER_Y
    if (this._activeSprite === 'octo' || this._activeSprite === 'kraken') {
      this._octoBobTime = (this._octoBobTime ?? 0) + dt;
      this.diver.y = DIVER_Y + Math.sin(this._octoBobTime * 2.6) * 7;
    } else {
      this.diver.y = DIVER_Y;
    }

    this.diver.x = Phaser.Math.Clamp(this.diver.x, DIVER_MARGIN, W - DIVER_MARGIN);
    this.diverGlow.x = this.diver.x;
    this.diverGlow.y = this.diver.y;

    // Octo/kraken reach — wider pickup radius for coins and shells
    if (this._activeSprite === 'octo' || this._activeSprite === 'kraken') {
      this.diverOctoReach.body.enable = true;
      this.diverOctoReach.body.reset(this.diver.x, this.diver.y);
    } else {
      this.diverOctoReach.body.enable = false;
    }

    // Flip sprite to face whichever side the player is steering toward
    if      (vx >  10) this.diver.setFlipX(false);
    else if (vx < -10) this.diver.setFlipX(true);

    if (this._activeSprite === 'star') {
      // Spin continuously — CW when moving right, CCW when moving left, rate proportional to speed
      this._starAngle = ((this._starAngle ?? 0) + vx * 4.0 * dt) % 360;
      this.diver.angle = this._starAngle;
    } else if (this._activeSprite === 'octo') {
      this.diver.angle = 0;
    } else {
      // Default: nose-down tilt + idle tail waggle
      const tilt   = Phaser.Math.Clamp(Math.abs(vx) * DIVER_TILT, 0, DIVER_MAX_TILT);
      const idleT  = 1 - Math.min(Math.abs(vx) / 65, 1);
      const waggle = Math.sin(time * 0.005) * 4 * idleT;
      this.diver.angle = (this.diver.flipX ? -(90 - tilt) : (90 - tilt)) + waggle;
    }

    // Keep dead sprite locked to diver during hit-flash (visible but world still running)
    if (this.diverDead.visible) {
      this.diverDead.x     = this.diver.x;
      this.diverDead.y     = this.diver.y;
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
    if (this._cosmeticsEnabled && this.trailTimer > 80 && this._activeSprite !== 'kraken') {
      this.trailTimer = 0;
      // Tail position: offset from diver center toward the back end of the fish
      const angleRad = Phaser.Math.DegToRad(this.diver.angle);
      const flipSign = this.diver.flipX ? 1 : -1;
      const tx = this.diver.x + flipSign * 36 * Math.cos(angleRad);
      const ty = this.diver.y + flipSign * 36 * Math.sin(angleRad);
      this._spawnTrailParticles(tx, ty);
    }
    // Hard cap — cull oldest entries when the trail grows too large (blood effects can accumulate)
    if (this.trail.length > 180) {
      const excess = this.trail.splice(0, this.trail.length - 180);
      excess.forEach(e => { if (e.img?.active) e.img.destroy(); });
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

    // ── KRAKEN SPIRAL AURA ───────────────────────────────────────
    if (this._cosmeticsEnabled && this._activeSprite === 'kraken') {
      this._krakenPulseT   = ((this._krakenPulseT ?? 0) + dt * 1.8) % (Math.PI * 2);
      const rotSpeed       = 210 + Math.sin(this._krakenPulseT) * 140;
      this._krakenArmAngle = ((this._krakenArmAngle ?? 0) + rotSpeed * dt) % 360;
      this._krakenSpiralTimer = (this._krakenSpiralTimer ?? 0) + delta;
      if (this._krakenSpiralTimer > 80) {
        this._krakenSpiralTimer = 0;
        this._emitKrakenSpiral(this.diver.x, this.diver.y);
      }
    }

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
    if (this._warpTimeLeft > 0) {
      this._warpTimeLeft = Math.max(0, this._warpTimeLeft - dt);
      if (this._warpTimeLeft <= 0) this._warpSpeedMult = 1;
    }
    this.gridTile.tilePositionY -= this._eff.fallSpeed * dt * 0.22 * this._warpSpeedMult;

    // ── BLOOD THEME PARTICLES ────────────────────────────────────
    if (this._cosmeticsEnabled && this._activeTheme === 'crimson') {
      this._bloodTimer = (this._bloodTimer ?? 0) + delta;
      if (this._bloodTimer > 130) {
        this._bloodTimer = 0;
        const active = this.decorations.filter(e => e.obj?.active && !e.isGlowDot);
        if (active.length > 0) {
          this._spawnBloodEffect(
            Phaser.Utils.Array.GetRandom(active).obj.x,
            Phaser.Utils.Array.GetRandom(active).obj.y,
          );
          // Second source for denser coverage
          this._spawnBloodEffect(
            Phaser.Utils.Array.GetRandom(active).obj.x,
            Phaser.Utils.Array.GetRandom(active).obj.y,
          );
        }
      }
    }

    // ── NEON THEME ELECTRICITY ───────────────────────────────────
    if (this._cosmeticsEnabled && this._activeTheme === 'neon') {
      this._neonSparkTimer += delta;
      if (this._neonSparkTimer > 85) {
        this._neonSparkTimer = 0;
        const active = this.decorations.filter(e => e.obj?.active && !e.isGlowDot);
        if (active.length > 0) {
          const wx = Phaser.Utils.Array.GetRandom(active).obj.x;
          const wy = Phaser.Utils.Array.GetRandom(active).obj.y;
          const baseVelY = -this._eff.fallSpeed;
          // Short electric bolts
          for (let i = 0; i < Phaser.Math.Between(4, 8); i++) {
            const obj = this.add.rectangle(
              wx + Phaser.Math.Between(-28, 28),
              wy + Phaser.Math.Between(-20, 20),
              Phaser.Math.Between(5, 14), 1.5,
              Math.random() < 0.40 ? 0xffffff : 0x00ffff
            ).setDepth(7).setBlendMode(Phaser.BlendModes.ADD)
              .setAngle(Phaser.Math.Between(-70, 70));
            this.trail.push({
              img: obj, life: 1.0,
              velX: Phaser.Math.FloatBetween(-65, 65),
              velY: baseVelY + Phaser.Math.FloatBetween(-55, 55),
              decay: 4.0, maxAlpha: 0.98,
              rotSpeed: Phaser.Math.FloatBetween(-300, 300),
            });
          }
          // Bright spark dots alongside the bolts
          for (let i = 0; i < Phaser.Math.Between(3, 5); i++) {
            const dot = this.add.circle(
              wx + Phaser.Math.Between(-22, 22),
              wy + Phaser.Math.Between(-16, 16),
              Phaser.Math.FloatBetween(1.2, 3.0),
              Math.random() < 0.5 ? 0xffffff : 0x88ffff, 1.0
            ).setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
            this.trail.push({
              img: dot, life: 1.0,
              velX: Phaser.Math.FloatBetween(-90, 90),
              velY: baseVelY + Phaser.Math.FloatBetween(-90, 90),
              decay: 5.5, maxAlpha: 1.0,
            });
          }
        }
      }
    }

    // ── RAINBOW (legendary cosmetics) ────────────────────────────
    this._rainbowHue = (this._rainbowHue + dt * 0.04) % 1;  // full cycle ~25 s
    if (this._cosmeticsEnabled) {
      const rc = _hueToHex(this._rainbowHue);
      if (this._activeSkin === 'legendary') {
        this.diver.setTint(rc);
        this.diverDead.setTint(rc);
        this.diverGlow.setFillStyle(rc, 0.22);
      }
      if (this._activeTheme === 'legendary') {
        this._objSkinTint = rc;
        this._bgSkinTint  = rc;
        this.bgLayers.forEach(l => l.setTint(rc));
        this.decorations.forEach(e => { if (e.obj?.active) e.obj.setTint(rc); });
      }
    }

    // ── DAMAGE BAR ───────────────────────────────────────────────
    const pct = Phaser.Math.Clamp(this.pressure, 0, 1);
    this.pBar.width = (W - 40) * pct;
    this.pBar.setFillStyle(
      pct < 0.5  ? 0x00cc66 :
      pct < 0.78 ? 0xff9900 :
                   0xff2200
    );

    // ── SHARK BUST TIMER ─────────────────────────────────────────
    if (this._sharkBusting) {
      this._sharkBustTimer -= dt;
      if (this._sharkBustTimer <= 0) this._endSharkBust();
    }

    // ── BURST ROW SWEEP (push rows as diver passes through them) ─
    if (this._sharkBusting) {
      const ny  = this.diver.y;
      const hit = this.walls.getChildren().find(
        w => w.active && !w.getData('busted') && Math.abs(w.y - ny) < 70
      );
      if (hit) this._bustWall(hit);
    }

    // ── SHARK CHARGE GAUGE ───────────────────────────────────────
    this.sharkGaugeGfx.clear();
    if (this._activeSprite === 'shark' || this._activeSprite === 'kraken') {
      // Placed between lives text (left) and biome label (center) — no overlap with pause button
      const ST = SAFE_TOP, cx = 90, cy = 76 + ST, r = 8;
      const pct = this._sharkBusting
        ? Math.max(0, this._sharkBustTimer / 8.0)
        : Math.min(this._sharkChargeDist / 5000, 1);
      const col = this._sharkBusting ? 0xcc44ff : (pct >= 1 ? 0xffd700 : 0x8833cc);
      this.sharkGaugeGfx.lineStyle(2.5, 0x110022, 0.9);
      this.sharkGaugeGfx.strokeCircle(cx, cy, r);
      if (pct > 0) {
        this.sharkGaugeGfx.lineStyle(2.5, col, 1.0);
        this.sharkGaugeGfx.beginPath();
        this.sharkGaugeGfx.arc(cx, cy, r, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + 360 * pct), false);
        this.sharkGaugeGfx.strokePath();
      }
      if (pct >= 1 || this._sharkBusting) {
        this.sharkGaugeGfx.lineStyle(0);
        this.sharkGaugeGfx.fillStyle(col, 1.0);
        this.sharkGaugeGfx.fillCircle(cx, cy, 3.5);
      }
    }

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
        child.y += velY * dt * this._warpSpeedMult;
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
      obj.y += (obj.getData('velY') || 0) * dt * this._warpSpeedMult;
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
      r, 0xffffff, 0.6
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

  // Legendary — spinning rainbow 5-point stars with chromatic stardust trail
  _trailLegendary(x, y) {
    const starCount = Math.random() < 0.5 ? 3 : 2;
    for (let i = 0; i < starCount; i++) {
      const inner = Phaser.Math.FloatBetween(3, 5);
      const outer = Phaser.Math.FloatBetween(7, 12);
      // Each star gets a hue slightly offset from the current rainbow position
      const col = _hueToHex(this._rainbowHue + Phaser.Math.FloatBetween(-0.08, 0.08));
      const gs = this.add.star(
        x + Phaser.Math.Between(-14, 14),
        y + Phaser.Math.Between(0, 12),
        5, inner, outer, col
      ).setDepth(9).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9);
      this.trail.push({
        img: gs, life: 1.0,
        velX: Phaser.Math.FloatBetween(-30, 30),
        velY: Phaser.Math.FloatBetween(-60, -35),
        decay: 0.95, maxAlpha: 0.85,
        rotSpeed: Phaser.Math.FloatBetween(120, 300) * (Math.random() < 0.5 ? 1 : -1),
      });
    }
    // Stardust — tiny dots spanning the spectrum around the current hue
    for (let i = 0; i < 3; i++) {
      const dustCol = _hueToHex(this._rainbowHue + i * 0.12);
      const dust = this.add.circle(
        x + Phaser.Math.Between(-18, 18),
        y + Phaser.Math.Between(0, 8),
        Phaser.Math.FloatBetween(1, 2.5), dustCol, 0.8
      ).setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
      this.trail.push({
        img: dust, life: 1.0,
        velX: Phaser.Math.FloatBetween(-45, 45),
        velY: Phaser.Math.FloatBetween(-70, -25),
        decay: 2.0, maxAlpha: 0.7,
      });
    }
  }

  // Kraken — three-arm spiral using the equipped trail's visuals, outward velocity applied after spawn
  _emitKrakenSpiral(x, y) {
    const pulse = 0.5 + 0.5 * Math.sin(this._krakenPulseT * 2.5);
    const speed = 48 + pulse * 60;

    for (let i = 0; i < 3; i++) {
      const angle  = Phaser.Math.DegToRad(this._krakenArmAngle + i * 120);
      const before = this.trail.length;
      this._spawnTrailParticles(x, y);
      // Override every particle just spawned: fly outward along this arm's angle, scaled smaller
      for (let j = before; j < this.trail.length; j++) {
        const jitter        = Phaser.Math.FloatBetween(-0.12, 0.12);
        this.trail[j].velX  = Math.cos(angle + jitter) * speed;
        this.trail[j].velY  = Math.sin(angle + jitter) * speed;
        if (this.trail[j].img?.active) this.trail[j].img.setScale(0.62);
      }
    }

    // Subtle center glow at the pulse peak
    if (pulse > 0.75) {
      const glow = this.add.circle(x, y, 3 + pulse * 5, 0xffffff, 0.20)
        .setDepth(11).setBlendMode(Phaser.BlendModes.ADD);
      this.trail.push({ img: glow, life: 1.0, velX: 0, velY: -8, decay: 4.5, maxAlpha: 0.18 });
    }
  }

  // ── SHARK BUST ────────────────────────────────────────────────────────────

  _onWallOverlap(diver, wall) {
    if (this._sharkBusting) {
      this._bustWall(wall);
      return;
    }
    // Any wall hit resets charge meter for shark and kraken
    if (this._activeSprite === 'shark' || this._activeSprite === 'kraken') this._sharkChargeDist = 0;
    this.onHit();
  }

  _bustWall(wall) {
    if (!wall?.active || wall.getData('busted')) return;
    const wallY = wall.y;

    // Remove all physics rects in this wall row and fling them off-screen
    const rowWalls = this.walls.getChildren().filter(w =>
      w.active && !w.getData('busted') && Math.abs(w.y - wallY) < 80
    );
    rowWalls.forEach(w => {
      w.setData('busted', true);
      this.walls.remove(w, false, false);
      if (w.body) w.body.enable = false;
      const dir = w.x < W / 2 ? -1 : 1;
      this.tweens.add({
        targets: w,
        x: w.x + dir * (W + 250),
        y: w.y + Phaser.Math.Between(40, 130),
        rotation: Phaser.Math.FloatBetween(-Math.PI, Math.PI),
        alpha: 0,
        duration: Phaser.Math.Between(350, 580),
        ease: 'Cubic.Out',
        onComplete: () => { if (w?.active) w.destroy(); },
      });
    });

    // Also fling the visual decoration sprites in the same row
    this.decorations.forEach(entry => {
      const obj = entry.obj;
      if (!obj?.active || obj.getData('busted')) return;
      if (Math.abs(obj.y - wallY) > 80) return;
      obj.setData('busted', true);
      const dir = obj.x < W / 2 ? -1 : 1;
      this.tweens.add({
        targets: obj,
        x: obj.x + dir * (W + 250),
        y: obj.y + Phaser.Math.Between(40, 130),
        rotation: Phaser.Math.FloatBetween(-Math.PI, Math.PI),
        alpha: 0,
        duration: Phaser.Math.Between(350, 580),
        ease: 'Cubic.Out',
        onComplete: () => { if (obj?.active) obj.destroy(); },
      });
    });
  }

  _showBurstTitle() {
    const txt = this.add.text(W / 2, H * 0.42, 'BURST', {
      fontSize: '92px', fontFamily: 'Arial Black',
      color: '#dd55ff',
      stroke: '#110022', strokeThickness: 10,
      shadow: { offsetX: 0, offsetY: 0, color: '#8800ff', blur: 24, fill: true },
    }).setOrigin(0.5).setDepth(52).setScale(0);

    // Punch in → settle → blow out
    this.tweens.add({
      targets: txt, scale: 1.2, duration: 180, ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: txt, scale: 1.0, duration: 100, ease: 'Linear',
          onComplete: () => {
            this.time.delayedCall(300, () => {
              this.tweens.add({
                targets: txt, scale: 2.4, alpha: 0, duration: 440, ease: 'Cubic.In',
                onComplete: () => { if (txt?.active) txt.destroy(); },
              });
            });
          },
        });
      },
    });
  }

  _activateSharkBust() {
    this._sharkBusting    = true;
    this._sharkBustTimer  = 8.0;
    this._sharkChargeDist = 0;
    this._showBurstTitle();
    this.cameras.main.flash(350, 130, 0, 255, true);
    // Brief purple burst flash on the diver
    this.diver.setTint(0xcc44ff);
    this.diverDead.setTint(0xcc44ff);
    this.time.delayedCall(400, () => {
      if (!this.dead) this._syncTints();
    });

    // Slow purple overlay pulse for the duration of the bust
    if (this._sharkBustFlashTween) this._sharkBustFlashTween.stop();
    this.sharkBustFlash.setAlpha(0);
    this._sharkBustFlashTween = this.tweens.add({
      targets: this.sharkBustFlash,
      alpha: { from: 0.05, to: 0.22 },
      yoyo: true, repeat: -1,
      duration: 800, ease: 'Sine.InOut',
    });

    // Same invincible loop SFX as the platinum shell
    this._sharkBustSFX?.stop();
    this._sharkBustSFX?.destroy();
    if (this.cache.audio.has('invincibleSFX')) {
      this._sharkBustSFX = this.sound.add('invincibleSFX', { volume: 0.8 * sfxVol(), loop: true });
      this._sharkBustSFX.play();
    }
  }

  _endSharkBust() {
    this._sharkBusting    = false;
    this._sharkBustTimer  = 0;
    this._sharkChargeDist = 0;
    this._sharkBustFlashTween?.stop();
    this._sharkBustFlashTween = null;
    this.tweens.add({ targets: this.sharkBustFlash, alpha: 0, duration: 500 });
    this._sharkBustSFX?.stop();
    this._sharkBustSFX?.destroy();
    this._sharkBustSFX = null;
  }

  _spawnBloodEffect(x, y) {
    const velY  = -this._eff.fallSpeed;
    const count = Phaser.Math.Between(3, 6);
    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      if (roll < 0.40) {
        // Ember — large spinning 4-point star
        const sz  = Phaser.Math.FloatBetween(4, 9);
        const obj = this.add.star(
          x + Phaser.Math.FloatBetween(-30, 30), y,
          4, sz * 0.40, sz,
          Phaser.Utils.Array.GetRandom([0xff2200, 0xff6600, 0xff0000, 0xdd1100])
        ).setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
        this.trail.push({
          img: obj, life: 1.0,
          velX: Phaser.Math.FloatBetween(-55, 55),
          velY: velY + Phaser.Math.FloatBetween(-120, 15),
          decay: 0.42, maxAlpha: 0.94,
          rotSpeed: Phaser.Math.FloatBetween(120, 300) * (Math.random() < 0.5 ? 1 : -1),
        });
      } else if (roll < 0.80) {
        // Blood bubble — small soft circle
        const r   = Phaser.Math.FloatBetween(1.5, 4.5);
        const obj = this.add.circle(
          x + Phaser.Math.FloatBetween(-30, 30), y,
          r,
          Phaser.Utils.Array.GetRandom([0xcc0011, 0xff1133, 0xff0000, 0x990011]),
          0.9
        ).setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
        this.trail.push({
          img: obj, life: 1.0,
          velX: Phaser.Math.FloatBetween(-28, 28),
          velY: velY + Phaser.Math.FloatBetween(-130, -20),
          decay: 0.32, maxAlpha: 0.90,
        });
      } else {
        // Drip — slow-falling elongated streak
        const h   = Phaser.Math.FloatBetween(10, 22);
        const obj = this.add.rectangle(
          x + Phaser.Math.FloatBetween(-20, 20), y,
          Phaser.Math.FloatBetween(3, 6), h,
          Math.random() < 0.5 ? 0xcc0011 : 0xff2200
        ).setDepth(7).setBlendMode(Phaser.BlendModes.ADD)
          .setAngle(Phaser.Math.Between(-15, 15));
        this.trail.push({
          img: obj, life: 1.0,
          velX: Phaser.Math.FloatBetween(-12, 12),
          velY: velY + Phaser.Math.FloatBetween(-60, 20),
          decay: 0.28, maxAlpha: 0.88,
        });
      }
    }
  }

  _addPhantomGlow(cx, cy, w, h, velY) {
    // Three-layer radial glow: outer dim → inner bright, all within sprite bounds
    const g = this.add.graphics({ x: cx, y: cy })
      .setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
    g.fillStyle(0x8800ff, 0.09);  g.fillEllipse(0, 0, w * 0.82, h * 0.82);
    g.fillStyle(0x9911ff, 0.16);  g.fillEllipse(0, 0, w * 0.52, h * 0.52);
    g.fillStyle(0xbb44ff, 0.26);  g.fillEllipse(0, 0, w * 0.26, h * 0.26);
    g.setData('velY', velY);
    this.decorations.push({ obj: g });
    this.tweens.add({
      targets: g, alpha: { from: 0.25, to: 1.0 },
      yoyo: true, repeat: -1,
      duration: Phaser.Math.Between(550, 950), ease: 'Sine.InOut',
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

  _initBgAnimations() {}

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
    pauseHit.on('pointerout',   () => pauseBg.setStrokeStyle(1.2, 0x00ccff, 0.6).setAlpha(1));
    pauseHit.on('pointerdown',  () => { pauseBg.setAlpha(0.65); this._sfx.button?.stop(); this._sfx.button?.play(); this._pause(); });
    pauseHit.on('pointerup',    () => pauseBg.setAlpha(1));

    // Shark charge gauge — circle arc in biome-label row (left of center), clear of pause button
    this.sharkGaugeGfx = this.add.graphics().setDepth(30);

    // Hit flash
    this.hitFlash = this.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 0).setDepth(50);

    // Shark bust purple overlay — slow pulse while bust is active
    this.sharkBustFlash = this.add.rectangle(W / 2, H / 2, W, H, 0x8800ff, 0).setDepth(49);
  }

  _buildTapTutorial() {
    const depth = 24;
    const cy    = H * 0.65;
    const r     = 46;
    const lx    = W * 0.25;
    const rx    = W * 0.75;

    const makeCircle = (x) => {
      const g = this.add.graphics().setDepth(depth);
      g.fillStyle(0x00aaff, 0.18);
      g.fillCircle(x, cy, r);
      g.lineStyle(2.5, 0xffffff, 0.50);
      g.strokeCircle(x, cy, r);
      return g;
    };

    const gL = makeCircle(lx);
    const gR = makeCircle(rx);

    const style = {
      fontSize: '14px', fontFamily: 'Arial Black',
      color: '#aaddff', stroke: '#000011', strokeThickness: 2,
      align: 'center',
    };
    const tL = this.add.text(lx, cy, 'TAP TO\nMOVE', style).setOrigin(0.5).setDepth(depth + 1);
    const tR = this.add.text(rx, cy, 'TAP TO\nMOVE', style).setOrigin(0.5).setDepth(depth + 1);

    const targets = [gL, gR, tL, tR];
    const blinkTween = this.tweens.add({
      targets,
      alpha: { from: 1.0, to: 0.08 },
      yoyo: true, repeat: -1,
      duration: 520, ease: 'Sine.InOut',
    });

    this.time.delayedCall(3600, () => {
      blinkTween.stop();
      this.tweens.add({
        targets,
        alpha: 0,
        duration: 380,
        onComplete: () => targets.forEach(t => { if (t?.active) t.destroy(); }),
      });
    });
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

    // ── COSMETICS TOGGLE ──────────────────────────────────────────
    const trkW  = W - 100;
    const trkL  = cx - trkW / 2;
    const trkR  = cx + trkW / 2;
    const trlY  = H * 0.678;

    mk(this.add.text(trkL, trlY, '✦  COSMETICS', {
      fontSize: '16px', fontFamily: 'Arial Black', color: '#6688aa',
    }).setOrigin(0, 0.5).setDepth(d + 1).setVisible(false));

    this._cosmeticToggleBg = mk(this.add.rectangle(trkR - 40, trlY, 82, 34,
      this._cosmeticsEnabled ? 0x001122 : 0x111111)
      .setStrokeStyle(1.5, this._cosmeticsEnabled ? 0x0088bb : 0x334455, this._cosmeticsEnabled ? 0.8 : 0.5)
      .setDepth(d + 1).setVisible(false).setInteractive({ useHandCursor: true }));

    this._cosmeticToggleTxt = mk(this.add.text(trkR - 40, trlY, this._cosmeticsEnabled ? 'ON' : 'OFF', {
      fontSize: '15px', fontFamily: 'Arial Black',
      color: this._cosmeticsEnabled ? '#00ccff' : '#334455',
    }).setOrigin(0.5).setDepth(d + 2).setVisible(false));

    this._cosmeticToggleBg.on('pointerdown', () => {
      if (!this.gamePaused) return;
      this._cosmeticsEnabled = !this._cosmeticsEnabled;
      setItem(STORAGE_COSMETICS, this._cosmeticsEnabled ? '1' : '0');
      this._updateCosmeticToggleUI();

      if (this._cosmeticsEnabled) {
        // Restore saved cosmetics (sprite and bg image unaffected)
        const skinT = SKIN_TINTS[this._activeSkin] ?? 0xffffff;
        this.diver.setTint(skinT);
        this.diverDead.setTint(skinT);
        this.diverGlow.setFillStyle(skinT, 0.22);
        this._syncTints();
        this.bgLayers.forEach(l => l.setTint(this._bgSkinTint));
        this.decorations.forEach(e => { if (e.obj?.active) e.obj.setTint(this._objSkinTint); });
      } else {
        // Revert all cosmetics to default (sprite and bg image unchanged)
        this.diver.setTint(0xffffff);
        this.diverDead.setTint(0xffffff);
        this.diverGlow.setFillStyle(0xffffff, 0.22);
        this._objSkinTint = 0xffffff;
        this._bgSkinTint  = 0xffffff;
        this.bgLayers.forEach(l => l.setTint(0xffffff));
        this.decorations.forEach(e => { if (e.obj?.active) e.obj.setTint(0xffffff); });
      }
    });


    const backBtn = mk(this.add.text(cx, H * 0.912, '‹  BACK', {
      fontSize: '18px', fontFamily: 'Arial Black', color: '#2a3a44',
    }).setOrigin(0.5).setDepth(d + 1).setVisible(false));
    backBtn.setInteractive(new Phaser.Geom.Rectangle(-90, -24, 180, 48), Phaser.Geom.Rectangle.Contains);
    backBtn.input.cursor = 'pointer';
    backBtn.on('pointerover', () => backBtn.setColor('#6688aa'));
    backBtn.on('pointerout',  () => backBtn.setColor('#2a3a44'));
    backBtn.on('pointerdown', () => { this._sfx.button?.stop(); this._sfx.button?.play(); objs.forEach(o => o.setVisible(false)); });

    this.pauseSettingsObjs = objs;
    this.pauseSettingsObjs.forEach(o => o.setVisible(false));
  }

  _buildPauseSlider(mk, cx, cy, d, label, volKey, mutKey, defaultVol, onChange) {
    const trackW     = W - 100;
    const trackLeft  = cx - trackW / 2;
    const trackRight = cx + trackW / 2;

    let vol   = parseFloat(getItem(volKey));
    let muted = getItem(mutKey) === '1';
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
      setItem(volKey, vol.toFixed(3));
      onChange(vol, muted);
    };

    const applyMute = () => {
      muteIcon.setText(muted ? '🔇' : '🔊');
      lbl.setColor(muted ? '#334455' : '#6688aa');
      fill.setFillStyle(muted ? mutedColor : activeColor);
      thumb.setFillStyle(muted ? thumbMuted : thumbActive);
      setItem(mutKey, muted ? '1' : '0');
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

    // Tip bar — spans full width, ~9% headspace above it
    const tipBarY   = H * 0.130;
    const tipBar    = this.add.rectangle(cx, tipBarY, W, 72, 0x000d1a, 0.92).setDepth(d + 1);
    const tipLine1  = this.add.rectangle(cx, tipBarY - 36, W, 1, 0x0088bb, 0.4).setDepth(d + 1);
    const tipLine2  = this.add.rectangle(cx, tipBarY + 36, W, 1, 0x0088bb, 0.4).setDepth(d + 1);
    this.contTipTxt = this.add.text(cx, tipBarY, '', {
      fontSize: '13px', fontFamily: 'Arial',
      color: '#8899aa', stroke: '#000', strokeThickness: 1,
      wordWrap: { width: W * 0.88 }, align: 'center',
    }).setOrigin(0.5).setDepth(d + 2);

    // ~60px clear gap after tip bar
    const title = this.add.text(cx, H * 0.245, 'CONTINUE?', {
      fontSize: '46px', fontFamily: 'Arial Black',
      color: '#cc0077', stroke: '#fff', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(d + 1);

    // Countdown — hero element, sits in the visual center
    this.contTxt = this.add.text(cx, H * 0.370, '10', {
      fontSize: '72px', fontFamily: 'Arial Black',
      color: '#cc0077', stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(d + 1);

    const secLbl = this.add.text(cx, H * 0.452, 'seconds remaining', {
      fontSize: '13px', fontFamily: 'Arial', color: '#2a3a44',
    }).setOrigin(0.5).setDepth(d + 1);

    // Section break before action buttons
    // Lives available display — refreshed in _showContinue()
    this.contLivesLbl = this.add.text(cx, H * 0.530, '', {
      fontSize: '18px', fontFamily: 'Arial Black', color: '#cc0077',
    }).setOrigin(0.5).setDepth(d + 1);

    // Use Life button — pink neon, disabled when lives = 0
    this.useLifeBtn = this.add.rectangle(cx, H * 0.610, 280, 52, 0x110010)
      .setStrokeStyle(1.5, 0xcc0077, 0.8)
      .setDepth(d + 1).setInteractive({ useHandCursor: true });
    this.useLifeTxt = this.add.text(cx, H * 0.610, 'USE A LIFE', {
      fontSize: '22px', fontFamily: 'Arial Black',
      color: '#cc0077', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(d + 2);
    this.useLifeBtn.on('pointerover',  () => this.useLifeBtn.setStrokeStyle(2.5, this.lives > 0 ? 0xcc0077 : 0x333333, 1.0));
    this.useLifeBtn.on('pointerout',   () => this.useLifeBtn.setStrokeStyle(1.5, this.lives > 0 ? 0xcc0077 : 0x333333, 0.8).setAlpha(1));
    this.useLifeBtn.on('pointerdown',  () => { this.useLifeBtn.setAlpha(0.70); this._sfx.button?.stop(); this._sfx.button?.play(); this._useLife(); });
    this.useLifeBtn.on('pointerup',    () => this.useLifeBtn.setAlpha(1));

    // Watch Ad button — green neon (free action)
    const adBtns = this._makeBtn(cx, H * 0.700, 'WATCH AD  —  FREE', 280, 52, 0x001100, 0x88bb00, 20, d + 1,
      () => this._watchAd());

    const buyHintTxt = this.add.text(cx, H * 0.768, 'Buy lives from the store before diving', {
      fontSize: '13px', fontFamily: 'Arial', color: '#2a3a44',
    }).setOrigin(0.5).setDepth(d + 1);

    const giveUpBtns = this._makeBtn(cx, H * 0.855, '✕  GIVE UP', 200, 44, 0x100000, 0x882222, 18, d + 1,
      () => {
        this.contEvt?.remove();
        const prev = parseInt(getItem(STORAGE_BEST) || '0', 10);
        if (this.depth > prev) setItem(STORAGE_BEST, this.depth);
        this._stopMusic();
        this.cameras.main.fadeOut(250);
        this.time.delayedCall(250, () => this.scene.start('Menu', { skipAbyss: true }));
      });

    this.contObjs = [bg, tipBar, tipLine1, tipLine2, this.contTipTxt,
      title, this.contTxt, secLbl, this.contLivesLbl,
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
    btn.on('pointerout',   () => btn.setStrokeStyle(1.5, strokeColor, 0.75).setAlpha(1));
    btn.on('pointerdown',  () => {
      btn.setAlpha(0.70);
      this._sfx.button?.stop(); this._sfx.button?.play();
      callback();
    });
    btn.on('pointerup',    () => btn.setAlpha(1));
    return [btn, txt];
  }
}
