import Phaser from 'phaser';
import Boot    from './scenes/Boot.js';
import Menu    from './scenes/Menu.js';
import Game    from './scenes/Game.js';
import GameOver from './scenes/GameOver.js';

// Use the device's actual logical point size so the canvas fills edge-to-edge
// on every iPhone model without letterboxing.
export const W = Math.round(window.innerWidth);
export const H = Math.round(window.innerHeight);

// Safe-area inset at the top (notch / Dynamic Island / status bar).
// Requires viewport-fit=cover in the HTML meta viewport tag.
// Returns 0 on older iPhones and in desktop browsers.
function _readSafeAreaTop() {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:0;left:0;width:0;padding-top:env(safe-area-inset-top,0px);pointer-events:none';
  document.documentElement.appendChild(el);
  const val = Math.round(parseFloat(window.getComputedStyle(el).paddingTop) || 0);
  el.remove();
  return val;
}
export const SAFE_TOP = _readSafeAreaTop();

// ── DIVER CONSTANTS ───────────────────────────────────────────────────────────
export const DIVER_Y        = 260 + SAFE_TOP;  // fixed vertical position (below UI header)
export const DIVER_ACCEL    = 640;   // px/s² horizontal acceleration
export const DIVER_DRAG     = 0.84;  // velocity multiplier per frame when not steering
export const DIVER_MAX_VX   = 305;   // max horizontal speed px/s
export const DIVER_TILT     = 0.148; // degrees of tilt per px/s → reaches 45° at max speed
export const DIVER_MAX_TILT = 45;    // max tilt from straight-down (fish banks hard on turns)
export const DIVER_MARGIN   = 24;    // horizontal padding from screen edges

// ── PRESSURE CONSTANTS ────────────────────────────────────────────────────────
export const PRESSURE_DECAY = 0.004; // pressure removed per tick (120ms) when not hitting walls
export const PRESSURE_HIT   = 0.30; // pressure added per wall collision

// ── BIOME DEFINITIONS ─────────────────────────────────────────────────────────
// Each biome defines: visual style, obstacle difficulty, and atmosphere
export const BIOMES = [
  {
    name:       'Coral Reef',
    minDepth:   0,
    bg:         0x010d18,   // near-black, hint of blue
    obsColor:   0x00ccff,   // electric cyan
    lightFade:  0.0,
    fallSpeed:  240,
    spawnMs:    1300,
    gapWidth:   162,
    minPieces:  1,
    maxPieces:  1,
    minGaps:    1,
    maxGaps:    2,
  },
  {
    name:       'Kelp Forest',
    minDepth:   2500,
    bg:         0x020d06,   // near-black, hint of green
    obsColor:   0x00ff66,   // acid neon green
    lightFade:  0.30,
    fallSpeed:  310,
    spawnMs:    1300,
    gapWidth:   140,
    minPieces:  1,
    maxPieces:  2,
    minGaps:    1,
    maxGaps:    2,
  },
  {
    name:       'Midnight Zone',
    minDepth:   7500,
    bg:         0x060518,   // near-black, hint of purple
    obsColor:   0xff0088,   // hot magenta
    lightFade:  0.55,
    fallSpeed:  375,
    spawnMs:    1150,
    gapWidth:   120,
    minPieces:  2,
    maxPieces:  3,
    minGaps:    1,
    maxGaps:    2,
  },
  {
    name:       'Hadal Trench',
    minDepth:   18000,
    bg:         0x050204,   // near-black, hint of deep red
    obsColor:   0xffcc00,   // golden yellow
    lightFade:  0.72,
    fallSpeed:  450,
    spawnMs:    950,
    gapWidth:   108,
    minPieces:  2,
    maxPieces:  4,
    minGaps:    1,
    maxGaps:    1,
  },
];

export function getBiomeIndex(depth) {
  for (let i = BIOMES.length - 1; i >= 0; i--) {
    if (depth >= BIOMES[i].minDepth) return i;
  }
  return 0;
}

// ── PHASER CONFIG ─────────────────────────────────────────────────────────────
const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#010c18',
  scale: {
    mode: Phaser.Scale.NONE,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scene: [Boot, Menu, Game, GameOver],
};

new Phaser.Game(config);
