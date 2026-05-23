import Phaser from 'phaser';
import Boot    from './scenes/Boot.js';
import Menu    from './scenes/Menu.js';
import Game    from './scenes/Game.js';
import GameOver from './scenes/GameOver.js';

export const W = 390;
export const H = 844;

// ── DIVER CONSTANTS ───────────────────────────────────────────────────────────
export const DIVER_Y        = 200;   // fixed vertical position (top quarter of screen)
export const DIVER_ACCEL    = 640;   // px/s² horizontal acceleration
export const DIVER_DRAG     = 0.84;  // velocity multiplier per frame when not steering
export const DIVER_MAX_VX   = 305;   // max horizontal speed px/s
export const DIVER_TILT     = 0.11;  // degrees of tilt per px/s of horizontal velocity
export const DIVER_MAX_TILT = 22;    // max tilt angle in degrees
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
    bg:         0x005f7a,
    obsColor:   0xd44a20,
    lightFade:  0.0,
    fallSpeed:  200,
    spawnMs:    1500,
    gapWidth:   145,   // navigable gap width
    minPieces:  1,     // min obstacle chunks per side
    maxPieces:  1,     // max obstacle chunks per side
  },
  {
    name:       'Kelp Forest',
    minDepth:   2500,
    bg:         0x0b3320,
    obsColor:   0x22aa55,
    lightFade:  0.30,
    fallSpeed:  265,
    spawnMs:    1280,
    gapWidth:   120,
    minPieces:  1,
    maxPieces:  2,
  },
  {
    name:       'Midnight Zone',
    minDepth:   7500,
    bg:         0x060618,
    obsColor:   0x9933ff,
    lightFade:  0.55,
    fallSpeed:  325,
    spawnMs:    1080,
    gapWidth:   100,
    minPieces:  2,
    maxPieces:  3,
  },
  {
    name:       'Hadal Trench',
    minDepth:   18000,
    bg:         0x020206,
    obsColor:   0x0099ff,
    lightFade:  0.72,
    fallSpeed:  395,
    spawnMs:    880,
    gapWidth:   88,
    minPieces:  2,
    maxPieces:  4,
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
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scene: [Boot, Menu, Game, GameOver],
};

new Phaser.Game(config);
