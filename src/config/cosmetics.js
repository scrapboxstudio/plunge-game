// ── COSMETIC DATA & STORAGE KEYS ─────────────────────────────────────────────
// Single source of truth shared by Menu.js (store) and Game.js (in-game equip).
//
// Each entry: { key, name, price, tint, rarity, rc, desc }
//   key    – localStorage identifier
//   price  – 0 means always owned / default
//   tint   – hex colour applied via setTint(); 0xffffff = no tint (use for sprite-swap entries)
//   rc     – rarity label colour (CSS hex string)

export const STORAGE_ACTIVE_SPRITE   = 'plunge_active_sprite';
export const STORAGE_OWNED_SPRITES   = 'plunge_owned_sprites';
export const STORAGE_ACTIVE_SKIN     = 'plunge_active_skin';
export const STORAGE_OWNED_SKINS     = 'plunge_owned_skins';
export const STORAGE_ACTIVE_TRAIL    = 'plunge_active_trail';
export const STORAGE_OWNED_TRAILS    = 'plunge_owned_trails';
export const STORAGE_ACTIVE_THEME    = 'plunge_active_theme';
export const STORAGE_OWNED_THEMES    = 'plunge_owned_themes';
export const STORAGE_ACTIVE_BG_IMAGE = 'plunge_active_bg_image';
export const STORAGE_OWNED_BG_IMAGES = 'plunge_owned_bg_images';

// ── COSMETIC ARRAYS ───────────────────────────────────────────────────────────
// Each entry: { key, name, price, tint, rarity, rc, desc }
//   key    – localStorage identifier (also used as setTint lookup)
//   price  – 0 means always owned / equippable for free
//   tint   – hex colour applied via setTint() — remove at SPRITE SWAP POINTs
//   rc     – rarity label colour (CSS hex string)
//   desc   – one-line description shown in the store card

// ── PLAYER SPRITES ────────────────────────────────────────────────────────────
// Swaps the actual diver texture. Add new creatures here and load
// textures in Boot.js: {spriteKey}Alive.png / {spriteKey}Dead.png.
export const PLAYER_SPRITES = [
  { key: 'default', spriteKey: 'fish',   name: 'FISH',   price: 0,    tint: 0xffffff, rarity: 'Default',   rc: '#aaaaaa', desc: 'The original deep-sea diver'    },
  { key: 'star',    spriteKey: 'star',   name: 'STAR',   price: 400,  tint: 0xffffff, rarity: 'Common',    rc: '#00ccaa', desc: 'A cosmic wanderer of the deep'   },
  { key: 'octo',    spriteKey: 'octo',   name: 'OCTO',   price: 1000, tint: 0xffffff, rarity: 'Rare',      rc: '#4488ff', desc: 'Eight arms, zero fear'           },
  { key: 'shark',   spriteKey: 'shark',  name: 'SHARK',  price: 2500, tint: 0xffffff, rarity: 'Epic',      rc: '#aa44ff', desc: 'Apex predator of the deep'      },
  { key: 'kraken',  spriteKey: 'kraken', name: 'KRAKEN', price: 6000, tint: 0xffffff, rarity: 'Legendary', rc: '#ffaa00', desc: 'Ancient terror of the abyss'    },
];

export const SKINS = [
  { key: 'default',   name: 'SEAFARER',     price: 0,     tint: 0xffffff, rarity: 'Default',   rc: '#aaaaaa', desc: 'The original diver'          },
  { key: 'neon',      name: 'NEON DIVER',   price: 400,   tint: 0x00ccff, rarity: 'Common',    rc: '#00ccaa', desc: 'Electric cyan glow'           },
  { key: 'crimson',   name: 'CRIMSON DEEP', price: 1000,  tint: 0xff5544, rarity: 'Rare',      rc: '#4488ff', desc: 'Blood-red depths'             },
  { key: 'phantom',   name: 'PHANTOM',      price: 2500,  tint: 0xcc88ff, rarity: 'Epic',      rc: '#aa44ff', desc: 'Ghostly purple haze'          },
  { key: 'legendary', name: 'GOLD RUSH',    price: 6000,  tint: 0xffdd00, rarity: 'Legendary', rc: '#ffaa00', desc: 'Gilded legend'                },
];

export const TRAILS = [
  { key: 'default',   name: 'OCEAN DRIFT',  price: 0,     tint: 0xffffff, rarity: 'Default',   rc: '#aaaaaa', desc: 'Soft rising bubbles'          },
  { key: 'neon',      name: 'ELECTRIC',     price: 400,   tint: 0x00ccff, rarity: 'Common',    rc: '#00ccaa', desc: 'Spinning cyan neon stars'     },
  { key: 'crimson',   name: 'EMBER BURST',  price: 1000,  tint: 0xff5544, rarity: 'Rare',      rc: '#4488ff', desc: 'Hot sparks & ember shards'    },
  { key: 'phantom',   name: 'GHOST WISP',   price: 2500,  tint: 0xcc88ff, rarity: 'Epic',      rc: '#aa44ff', desc: 'Purple ghost orbs & sparkles' },
  { key: 'legendary', name: 'STARDUST',     price: 6000,  tint: 0xffdd00, rarity: 'Legendary', rc: '#ffaa00', desc: 'Gold spinning stars & dust'   },
];

// ── THEMES ────────────────────────────────────────────────────────────────────
// Applies a single tint to BOTH obstacle sprites and background layers at once,
// giving the whole game a consistent colour vibe per theme.
export const THEMES = [
  { key: 'default',   name: 'NATURAL',      price: 0,    tint: 0xffffff, rarity: 'Default',   rc: '#aaaaaa', desc: 'Original colours, unfiltered'        },
  { key: 'neon',      name: 'NEON DEPTHS',  price: 400,  tint: 0x00ccff, rarity: 'Common',    rc: '#00ccaa', desc: 'Electric cyan across the deep'       },
  { key: 'crimson',   name: 'BLOOD TIDE',   price: 1000, tint: 0xff5544, rarity: 'Rare',      rc: '#4488ff', desc: 'Red-stained walls and dark waters'    },
  { key: 'phantom',   name: 'VOID REALM',   price: 2500, tint: 0xcc88ff, rarity: 'Epic',      rc: '#aa44ff', desc: 'Haunting violet across all biomes'    },
  { key: 'legendary', name: 'GOLDEN ABYSS', price: 6000, tint: 0xffdd00, rarity: 'Legendary', rc: '#ffaa00', desc: 'Gold-drenched formations and depths'  },
];

// ── BACKGROUND IMAGES ─────────────────────────────────────────────────────────
// Swaps the actual background image set used per biome.
// Add new sets here and preload their textures in Boot.js.
// Non-default entries are placeholders — assets not yet included.
export const BG_IMAGES = [
  { key: 'default',  name: 'NATURAL',    price: 0,    tint: 0xffffff, rarity: 'Default',   rc: '#aaaaaa', desc: 'Original biome backgrounds'         },
  { key: 'twilight', name: 'TWILIGHT',   price: 400,  tint: 0xffffff, rarity: 'Common',    rc: '#00ccaa', desc: 'Dusky mid-water twilight zone'       },
  { key: 'volcanic', name: 'VOLCANIC',   price: 1000, tint: 0xffffff, rarity: 'Rare',      rc: '#4488ff', desc: 'Superheated vents and lava rock'     },
  { key: 'arctic',   name: 'ARCTIC',     price: 2500, tint: 0xffffff, rarity: 'Epic',      rc: '#aa44ff', desc: 'Frozen depths beneath the ice shelf'  },
  { key: 'abyss',    name: 'THE ABYSS',  price: 6000, tint: 0xffffff, rarity: 'Legendary', rc: '#ffaa00', desc: 'The deepest, darkest trench'         },
];

// Convenience map for quick tint lookup: { default: 0xffffff, neon: 0x00ccff, … }
export const SKIN_TINTS = Object.fromEntries(SKINS.map(s => [s.key, s.tint]));

if (import.meta.env.DEV) {
  const fmt = (arr, label) => {
    console.groupCollapsed(`[Cosmetics] ${label}`);
    arr.forEach(i => console.log(`  ${i.rarity.padEnd(10)} ${i.name.padEnd(16)} ${i.price.toLocaleString()} coins`));
    console.groupEnd();
  };
  fmt(PLAYER_SPRITES, 'PLAYER SKINS');
  fmt(SKINS,          'AURA');
  fmt(TRAILS,         'PARTICLES');
  fmt(THEMES,         'THEMES');
  fmt(BG_IMAGES,      'BACKGROUNDS');
}
