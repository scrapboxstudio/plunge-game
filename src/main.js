import Phaser from 'phaser';
import Boot    from './scenes/Boot.js';
import Menu    from './scenes/Menu.js';
import Game    from './scenes/Game.js';
import GameOver from './scenes/GameOver.js';

// Phones: fill the screen edge-to-edge (≤ 500 logical px wide covers every phone,
// including iPhone 15 Pro Max at 430pt, while excluding tablets at 744pt+).
// Desktop / tablet: lock to a standard phone canvas and let Phaser scale + center it.
const IS_PHONE = window.innerWidth <= 500;

export const W = IS_PHONE ? Math.round(window.innerWidth)  : 390;
export const H = IS_PHONE ? Math.round(window.innerHeight) : 844;

// Safe-area inset at the top (notch / Dynamic Island / status bar).
// Only meaningful on actual phones; always 0 on desktop/tablet.
function _readSafeAreaTop() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:0;left:0;width:0;padding-top:env(safe-area-inset-top,0px);pointer-events:none';
  document.documentElement.appendChild(el);
  const val = Math.round(parseFloat(window.getComputedStyle(el).paddingTop) || 0);
  el.remove();
  return val;
}
export const SAFE_TOP = IS_PHONE ? _readSafeAreaTop() : 0;

// ── DIVER CONSTANTS ───────────────────────────────────────────────────────────
export const DIVER_Y        = 260 + SAFE_TOP;  // fixed vertical position (below UI header)
export const DIVER_ACCEL    = 640;   // px/s² horizontal acceleration
export const DIVER_DRAG     = 0.84;  // velocity multiplier per frame when not steering
export const DIVER_MAX_VX   = 305;   // max horizontal speed px/s
export const DIVER_TILT     = 0.148; // degrees of tilt per px/s
export const DIVER_MAX_TILT = 45;    // max tilt from straight-down
export const DIVER_MARGIN   = 24;    // horizontal padding from screen edges

// ── PRESSURE CONSTANTS ────────────────────────────────────────────────────────
export const PRESSURE_DECAY = 0.004; // pressure removed per tick (120 ms) when not hitting walls
export const PRESSURE_HIT   = 0.30;  // pressure added per wall collision

// ── BIOME DEFINITIONS ─────────────────────────────────────────────────────────
// To add a new biome: add one entry here and preload its assets in Boot.js.
//
// Fields:
//   name       – display name
//   minDepth   – depth (m) at which this biome begins
//   bg         – solid background fill colour (hex)
//   bgKey      – Phaser texture key for the parallax background image
//                (Boot.js loads  assets/<bgKey.slice(3)>.png  e.g. 'bg_coral' → 'coral.png')
//   obsColor   – neon accent colour used for biome label, shimmer flash, etc.
//   lightFade  – vignette darkness at this depth  (0 = none, 1 = full black)
//
//   fallSpeed  – obstacle scroll speed in px/s   ← tweak difficulty here
//   spawnMs    – milliseconds between wall rows   ← tweak difficulty here
//   gapWidth   – player gap width in px           ← tweak difficulty here
//   minGaps    – minimum gaps per wall row
//   maxGaps    – maximum gaps per wall row
//
//   bgSkins    – wide landmark sprites anchored to outer zone edges; extend off-screen
//                so they never overlap the gap. w = rendered width px (height always 110 px).
//   fillSkins  – smaller sprites that tile to fill interior collision zones.
//                w = rendered width px (height always 110 px).
//                Replacement PNGs should be (w×2) wide × 220 px tall for crisp @2× retina.
export const BIOMES = [
  {
    name:      'Coral Reef',
    minDepth:  0,
    bg:        0x010d18,
    bgKey:     'bg_coral',
    obsColor:  0x00ccff,
    lightFade: 0.0,
    fallSpeed: 252,
    spawnMs:   1238,
    gapWidth:  154,
    minGaps:   1,
    maxGaps:   2,
    duration:  120,   // seconds (1 song × 2 min)
    music:     ['coralBGM'],
    bgSkins: [
      { key: 'coral01', w: 350 },
      { key: 'coral02', w: 350 },
    ],
    fillSkins: [
      { key: 'coral03', w: 120 },
      { key: 'coral04', w: 120 },
      { key: 'coral05', w: 120 },
      { key: 'coral06', w: 190 },
      { key: 'coral07', w: 120 },
      { key: 'coral08', w: 120 },
      { key: 'coral09', w: 120 },
      { key: 'coral10', w: 120 },
      { key: 'coral11', w: 190 },
      { key: 'coral12', w: 190 },
      { key: 'coral13', w: 340 },
      { key: 'coral14', w: 260 },
      { key: 'coral15', w: 260 },
      { key: 'coral16', w: 260 },
      { key: 'coral17', w: 120 },
      { key: 'coral18', w: 120 },
      { key: 'coral19', w: 120 },
      { key: 'coral20', w: 120 },
      { key: 'coral21', w:  70 },
      { key: 'coral22', w: 120 },
      { key: 'coral23', w: 120 },
      { key: 'coral24', w:  70 },
      { key: 'coral25', w: 120 },
    ],
  },
  {
    name:      'Kelp Forest',
    minDepth:  2500,
    bg:        0x020d06,
    bgKey:     'bg_kelp',
    obsColor:  0x00ff66,
    lightFade: 0.30,
    fallSpeed: 326,
    spawnMs:   1238,
    gapWidth:  133,
    minGaps:   1,
    maxGaps:   2,
    duration:  240,   // seconds (2 songs × 2 min)
    music:     ['kelpBGM01', 'kelpBGM02'],
    bgSkins: [
      { key: 'kelp01', w: 350 },
      { key: 'kelp02', w: 350 },
    ],
    fillSkins: [
      { key: 'kelp03', w: 260 },
      { key: 'kelp04', w: 260 },
      { key: 'kelp05', w: 120 },
      { key: 'kelp06', w: 120 },
      { key: 'kelp07', w: 190 },
      { key: 'kelp08', w: 340 },
      { key: 'kelp09', w: 260 },
      { key: 'kelp10', w:  70 },
    ],
  },
  {
    name:      'Midnight Zone',
    minDepth:  7500,
    bg:        0x060518,
    bgKey:     'bg_midnight',
    obsColor:  0xff0088,
    lightFade: 0.55,
    fallSpeed: 394,
    spawnMs:   1095,
    gapWidth:  114,
    minGaps:   1,
    maxGaps:   2,
    duration:  360,   // seconds (3 songs × 2 min)
    music:     ['midnightBGM01', 'midnightBGM02', 'midnightBGM03'],
    bgSkins: [
      { key: 'midnight01', w: 350 },
      { key: 'midnight02', w: 350 },
    ],
    fillSkins: [
      { key: 'midnight03', w: 190 },
      { key: 'midnight04', w: 260 },
      { key: 'midnight05', w: 120 },
      { key: 'midnight06', w: 120 },
      { key: 'midnight07', w: 120 },
      { key: 'midnight08', w: 120 },
      { key: 'midnight09', w:  70 },
      { key: 'midnight10', w: 120 },
    ],
  },
  {
    name:      'Hadal Trench',
    minDepth:  18000,
    bg:        0x050204,
    bgKey:     'bg_hadal',
    obsColor:  0xffcc00,
    lightFade: 0.72,
    fallSpeed: 450,
    spawnMs:   950,
    gapWidth:  108,
    minGaps:   1,
    maxGaps:   1,
    duration:  480,   // seconds (4 songs × 2 min), then loops
    music:     ['hadalBGM01', 'hadalBGM02', 'hadalBGM03', 'hadalBGM04'],
    bgSkins: [
      { key: 'hadal01', w: 350 },
      { key: 'hadal02', w: 350 },
    ],
    fillSkins: [
      { key: 'hadal03', w: 260 },
      { key: 'hadal04', w: 260 },
      { key: 'hadal05', w: 120 },
      { key: 'hadal06', w: 260 },
      { key: 'hadal07', w: 190 },
      { key: 'hadal08', w: 120 },
      { key: 'hadal09', w:  70 },
    ],
  },
];

// ── DEBUG: biome duration scaling ─────────────────────────────────────────────
// Multiplies every biome's minDepth threshold.
//   < 1.0  →  shorter biomes  (0.1 = 10× faster transitions, good for quick testing)
//   > 1.0  →  longer  biomes
//   1.0    →  normal (ship value)
// Remove this constant (and the two references to it) before release.
export const BIOME_DURATION_SCALE = 1.0;

export function getBiomeIndex(depth) {
  for (let i = BIOMES.length - 1; i >= 0; i--) {
    if (depth >= BIOMES[i].minDepth * BIOME_DURATION_SCALE) return i;
  }
  return 0;
}

// Time-based biome lookup — used in-game so biome transitions align with music.
// ms = elapsed game time in milliseconds (pauses excluded).
// BIOME_DURATION_SCALE compresses/stretches transitions for testing; set to 1.0 to ship.
// Note: music always plays at full song duration regardless of BIOME_DURATION_SCALE.
export function getBiomeIndexByTime(ms) {
  let cumMs = 0;
  for (let i = 0; i < BIOMES.length - 1; i++) {
    cumMs += BIOMES[i].duration * 1000 * BIOME_DURATION_SCALE;
    if (ms < cumMs) return i;
  }
  return BIOMES.length - 1;
}

// ── PHASER CONFIG ─────────────────────────────────────────────────────────────
const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#010c18',
  scale: {
    // Phone: NONE so the canvas fills the screen with no letterboxing.
    // Desktop/tablet: FIT scales the fixed 390×844 canvas to fit the window
    // while preserving aspect ratio; CENTER_BOTH keeps it centered on black.
    mode:       IS_PHONE ? Phaser.Scale.NONE : Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scene: [Boot, Menu, Game, GameOver],
};

new Phaser.Game(config);
