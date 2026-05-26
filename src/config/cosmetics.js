// ── COSMETIC DATA & STORAGE KEYS ─────────────────────────────────────────────
//
// Single source of truth shared by Menu.js (store) and Game.js (in-game equip).
//
// ── HOW TO REPLACE TINT COSMETICS WITH REAL SPRITES ──────────────────────────
// 1. Add a `spriteKey` field to each non-default entry, e.g. spriteKey: 'skin_neon'
// 2. Preload in Boot.js: this.load.image('skin_neon', 'assets/skin_neon.png')
// 3. In Game.js, find every // SPRITE SWAP POINT comment and replace:
//      setTint(tint)  →  setTexture(item.spriteKey ?? 'diver').setTint(0xffffff)
// 4. In Menu.js _buildStoreCosmeticPage, replace the color-disc preview circles
//    with: this.add.image(cx - cardW / 2 + 36, py, item.spriteKey ?? 'diver')
//
// ── STORAGE KEYS ──────────────────────────────────────────────────────────────

export const STORAGE_ACTIVE_SKIN     = 'plunge_active_skin';
export const STORAGE_OWNED_SKINS     = 'plunge_owned_skins';
export const STORAGE_ACTIVE_TRAIL    = 'plunge_active_trail';
export const STORAGE_OWNED_TRAILS    = 'plunge_owned_trails';
export const STORAGE_ACTIVE_OBJ_SKIN = 'plunge_active_obj_skin';
export const STORAGE_OWNED_OBJ_SKINS = 'plunge_owned_obj_skins';
export const STORAGE_ACTIVE_BG       = 'plunge_active_bg';
export const STORAGE_OWNED_BGS       = 'plunge_owned_bgs';
export const STORAGE_ACTIVE_MUSIC    = 'plunge_active_music';

// ── COSMETIC ARRAYS ───────────────────────────────────────────────────────────
// Each entry: { key, name, price, tint, rarity, rc, desc }
//   key    – localStorage identifier (also used as setTint lookup)
//   price  – 0 means always owned / equippable for free
//   tint   – hex colour applied via setTint() — remove at SPRITE SWAP POINTs
//   rc     – rarity label colour (CSS hex string)
//   desc   – one-line description shown in the store card

export const SKINS = [
  { key: 'default',   name: 'SEAFARER',     price: 0,     tint: 0xffffff, rarity: 'Default',   rc: '#aaaaaa', desc: 'The original diver'          },
  { key: 'neon',      name: 'NEON DIVER',   price: 50,    tint: 0x00ccff, rarity: 'Common',    rc: '#00ccaa', desc: 'Electric cyan glow'           },
  { key: 'crimson',   name: 'CRIMSON DEEP', price: 100,   tint: 0xff5544, rarity: 'Rare',      rc: '#4488ff', desc: 'Blood-red depths'             },
  { key: 'phantom',   name: 'PHANTOM',      price: 250,   tint: 0xcc88ff, rarity: 'Epic',      rc: '#aa44ff', desc: 'Ghostly purple haze'          },
  { key: 'legendary', name: 'GOLD RUSH',    price: 500,   tint: 0xffdd00, rarity: 'Legendary', rc: '#ffaa00', desc: 'Gilded legend'                },
];

export const TRAILS = [
  { key: 'default',   name: 'OCEAN DRIFT',  price: 0,     tint: 0xaaddff, rarity: 'Default',   rc: '#aaaaaa', desc: 'Soft rising bubbles'          },
  { key: 'neon',      name: 'ELECTRIC',     price: 50,    tint: 0x00ccff, rarity: 'Common',    rc: '#00ccaa', desc: 'Spinning cyan neon stars'     },
  { key: 'crimson',   name: 'EMBER BURST',  price: 100,   tint: 0xff5544, rarity: 'Rare',      rc: '#4488ff', desc: 'Hot sparks & ember shards'    },
  { key: 'phantom',   name: 'GHOST WISP',   price: 250,   tint: 0xcc88ff, rarity: 'Epic',      rc: '#aa44ff', desc: 'Purple ghost orbs & sparkles' },
  { key: 'legendary', name: 'STARDUST',     price: 500,   tint: 0xffdd00, rarity: 'Legendary', rc: '#ffaa00', desc: 'Gold spinning stars & dust'   },
];

export const OBJ_SKINS = [
  { key: 'default',   name: 'NATURAL',      price: 0,     tint: 0xffffff, rarity: 'Default',   rc: '#aaaaaa', desc: 'Original biome textures'      },
  { key: 'neon',      name: 'NEON REEF',    price: 100,   tint: 0x00ccff, rarity: 'Common',    rc: '#00ccaa', desc: 'Electric cyan obstacles'      },
  { key: 'crimson',   name: 'BLOOD TIDE',   price: 200,   tint: 0xff5544, rarity: 'Rare',      rc: '#4488ff', desc: 'Deep red tidal walls'         },
  { key: 'phantom',   name: 'VOID STONE',   price: 500,   tint: 0xcc88ff, rarity: 'Epic',      rc: '#aa44ff', desc: 'Ghostly purple rock'          },
  { key: 'legendary', name: 'GILDED DEEP',  price: 1000,  tint: 0xffdd00, rarity: 'Legendary', rc: '#ffaa00', desc: 'Gold-drenched formations'     },
];

export const BG_SKINS = [
  { key: 'default',   name: 'NATURAL',      price: 0,     tint: 0xffffff, rarity: 'Default',   rc: '#aaaaaa', desc: 'Unfiltered biome backgrounds' },
  { key: 'neon',      name: 'NEON DEPTHS',  price: 1000,  tint: 0x00ccff, rarity: 'Common',    rc: '#00ccaa', desc: 'Cyan-tinted deep waters'      },
  { key: 'crimson',   name: 'BLOOD WATER',  price: 2000,  tint: 0xff5544, rarity: 'Rare',      rc: '#4488ff', desc: 'Crimson-hued ocean depths'    },
  { key: 'phantom',   name: 'VOID REALM',   price: 5000,  tint: 0xcc88ff, rarity: 'Epic',      rc: '#aa44ff', desc: 'Haunting violet dimensions'   },
  { key: 'legendary', name: 'GOLDEN ABYSS', price: 10000, tint: 0xffdd00, rarity: 'Legendary', rc: '#ffaa00', desc: 'Resplendent golden depths'    },
];

// Convenience map for quick tint lookup: { default: 0xffffff, neon: 0x00ccff, … }
export const SKIN_TINTS = Object.fromEntries(SKINS.map(s => [s.key, s.tint]));
