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
  { key: 'default', spriteKey: 'fish',   name: 'FISH',   price: 0,    tint: 0xffffff, rarity: 'Default',   rc: '#aaaaaa', desc: 'Balanced diver with no special ability',                speedBonus: 0,  armorBonus: 0  },
  { key: 'star',    spriteKey: 'star',   name: 'STAR',   price: 400,  tint: 0xffffff, rarity: 'Common',    rc: '#00ccaa', desc: 'Spins 360° as you move — speed & armor boost',           speedBonus: 5,  armorBonus: 5  },
  { key: 'octo',    spriteKey: 'octo',   name: 'OCTO',   price: 1000, tint: 0xffffff, rarity: 'Rare',      rc: '#4488ff', desc: 'Wider reach auto-collects nearby coins and shells',        speedBonus: 10, armorBonus: 10 },
  { key: 'shark',   spriteKey: 'shark',  name: 'SHARK',  price: 2500, tint: 0xffffff, rarity: 'Epic',      rc: '#aa44ff', desc: '5,000m collision-free charges an 8-second bust mode',      speedBonus: 15, armorBonus: 15 },
  { key: 'kraken',  spriteKey: 'kraken', name: 'KRAKEN', price: 6000, tint: 0xffffff, rarity: 'Legendary', rc: '#b0ccff', desc: 'Max speed & armor — the ultimate deep-sea predator',       speedBonus: 20, armorBonus: 20 },
];

export const SKINS = [
  { key: 'default',   name: 'SEAFARER',     price: 0,     tint: 0xffffff, rarity: 'Default',   rc: '#aaaaaa', desc: 'Plain diver — no tint or effects'             },
  { key: 'neon',      name: 'NEON DIVER',   price: 400,   tint: 0x00ccff, rarity: 'Common',    rc: '#00ccaa', desc: 'Electric cyan tint on the diver'               },
  { key: 'crimson',   name: 'CRIMSON DEEP', price: 1000,  tint: 0xff2200, rarity: 'Rare',      rc: '#4488ff', desc: 'Blood-red diver tint',                         biomeTints: { 2: 0xff0033 } },
  { key: 'phantom',   name: 'PHANTOM',      price: 2500,  tint: 0xeeccff, rarity: 'Epic',      rc: '#aa44ff', desc: 'Ghostly purple tint on the diver',             biomeTints: { 1: 0x99ffee, 2: 0xccddff } },
  { key: 'legendary', name: 'PRISM',        price: 6000,  tint: 0xd8eeff, rarity: 'Legendary', rc: '#b0ccff', desc: 'Slowly cycles through every hue of the spectrum' },
];

export const TRAILS = [
  { key: 'default',   name: 'OCEAN DRIFT',  price: 0,     tint: 0xffffff, rarity: 'Default',   rc: '#aaaaaa', desc: 'Soft rising bubbles trail behind the diver'      },
  { key: 'neon',      name: 'ELECTRIC',     price: 400,   tint: 0x00ccff, rarity: 'Common',    rc: '#00ccaa', desc: 'Spinning cyan star particles trail behind you'    },
  { key: 'crimson',   name: 'EMBER BURST',  price: 1000,  tint: 0xff2200, rarity: 'Rare',      rc: '#4488ff', desc: 'Hot red embers and sparks streak behind you'      },
  { key: 'phantom',   name: 'GHOST WISP',   price: 2500,  tint: 0xeeccff, rarity: 'Epic',      rc: '#aa44ff', desc: 'Ghost orbs and sparkles float in your wake'       },
  { key: 'legendary', name: 'PRISM MIST',   price: 6000,  tint: 0xd8eeff, rarity: 'Legendary', rc: '#b0ccff', desc: 'Rainbow stars shifting through every hue'         },
];

// ── THEMES ────────────────────────────────────────────────────────────────────
// Applies a single tint to BOTH obstacle sprites and background layers at once,
// giving the whole game a consistent colour vibe per theme.
export const THEMES = [
  { key: 'default',   name: 'NATURAL',      price: 0,    tint: 0xffffff, rarity: 'Default',   rc: '#aaaaaa', desc: 'Natural biome colours — no tint or effects'                  },
  { key: 'neon',      name: 'NEON DEPTHS',  price: 400,  tint: 0x00ccff, rarity: 'Common',    rc: '#00ccaa', desc: 'Electric cyan tint on all walls and biomes'                  },
  { key: 'crimson',   name: 'BLOOD TIDE',   price: 1000, tint: 0xff2200, rarity: 'Rare',      rc: '#4488ff', desc: 'Red walls emit drifting blood embers and bubbles'            },
  { key: 'phantom',   name: 'VOID REALM',   price: 2500, tint: 0xeeccff, rarity: 'Epic',      rc: '#aa44ff', desc: 'Some walls phase out randomly and become passable'           },
  { key: 'legendary', name: 'PRISM ABYSS',  price: 6000, tint: 0xd8eeff, rarity: 'Legendary', rc: '#b0ccff', desc: 'Walls and biomes cycle through the full spectrum'            },
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
  { key: 'abyss',    name: 'THE ABYSS',  price: 6000, tint: 0xffffff, rarity: 'Legendary', rc: '#b0ccff', desc: 'The deepest, darkest trench'         },
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
