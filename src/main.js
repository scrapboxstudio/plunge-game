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
//   bgSkins    – wide landmark sprites, anchored to outer zone edges,
//                extend off-screen so they never overlap the gap
//   fillSkins  – smaller sprites that tile to fill interior collision zones
//                pngW / pngH = actual PNG pixel dimensions (used for aspect-ratio scaling)
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
      { key: 'coral01', pngW: 531, pngH: 139 },
      { key: 'coral02', pngW: 523, pngH: 143 },
    ],
    fillSkins: [
      { key: 'coral03', pngW: 273, pngH: 283 },
      { key: 'coral04', pngW: 285, pngH: 284 },
      { key: 'coral05', pngW: 146, pngH: 136 },
      { key: 'coral06', pngW: 193, pngH: 130 },
      { key: 'coral07', pngW: 229, pngH: 200 },
      { key: 'coral08', pngW: 204, pngH: 188 },
      { key: 'coral09', pngW: 257, pngH: 365 },
      { key: 'coral10', pngW: 266, pngH: 372 },
      { key: 'coral11', pngW: 318, pngH: 174 },
      { key: 'coral12', pngW: 290, pngH: 177 },
      { key: 'coral13', pngW: 353, pngH: 103 },
      { key: 'coral14', pngW: 334, pngH: 126 },
      { key: 'coral15', pngW: 284, pngH: 127 },
      { key: 'coral16', pngW: 301, pngH: 135 },
      { key: 'coral17', pngW:  70, pngH:  63 },
      { key: 'coral18', pngW:  70, pngH:  64 },
      { key: 'coral19', pngW:  79, pngH:  63 },
      { key: 'coral20', pngW: 106, pngH:  88 },
      { key: 'coral21', pngW:  98, pngH: 109 },
      { key: 'coral22', pngW:  91, pngH:  89 },
      { key: 'coral23', pngW: 120, pngH: 116 },
      { key: 'coral24', pngW:  93, pngH: 114 },
      { key: 'coral25', pngW: 122, pngH: 125 },
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
      { key: 'kelp01', pngW: 694, pngH: 211 },
      { key: 'kelp02', pngW: 713, pngH: 216 },
    ],
    fillSkins: [
      { key: 'kelp03', pngW: 562, pngH: 253 },
      { key: 'kelp04', pngW: 453, pngH: 191 },
      { key: 'kelp05', pngW: 173, pngH: 220 },
      { key: 'kelp06', pngW: 147, pngH: 309 },
      { key: 'kelp07', pngW: 224, pngH: 165 },
      { key: 'kelp08', pngW: 589, pngH: 164 },
      { key: 'kelp09', pngW: 449, pngH: 191 },
      { key: 'kelp10', pngW: 114, pngH: 190 },
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
      { key: 'midnight01', pngW: 371, pngH: 212 },
      { key: 'midnight02', pngW: 382, pngH: 211 },
    ],
    fillSkins: [
      { key: 'midnight03', pngW: 227, pngH: 128 },
      { key: 'midnight04', pngW: 225, pngH: 101 },
      { key: 'midnight05', pngW: 143, pngH: 135 },
      { key: 'midnight06', pngW: 132, pngH: 137 },
      { key: 'midnight07', pngW:  65, pngH: 138 },
      { key: 'midnight08', pngW:  78, pngH: 109 },
      { key: 'midnight09', pngW:  66, pngH: 117 },
      { key: 'midnight10', pngW: 103, pngH:  85 },
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
      { key: 'hadal01', pngW: 734, pngH: 226 },
      { key: 'hadal02', pngW: 695, pngH: 202 },
    ],
    fillSkins: [
      { key: 'hadal03', pngW: 205, pngH: 77  },
      { key: 'hadal04', pngW: 189, pngH: 78  },
      { key: 'hadal05', pngW: 151, pngH: 147 },
      { key: 'hadal06', pngW: 160, pngH: 73  },
      { key: 'hadal07', pngW: 163, pngH:  92 },
      { key: 'hadal08', pngW: 116, pngH: 107 },
      { key: 'hadal09', pngW:  88, pngH:  94 },
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
