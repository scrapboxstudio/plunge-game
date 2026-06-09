# Missing Content Checklist â€” PLUNGE

> Cross-check filenames against your actual this.load.* calls in src/scenes/Game.js
> Run: grep -n "this.load." src/scenes/Game.js to see exact keys

## Biome Structure (assumed from project description)
0. Shallows / Surface (starting zone)
1. Kelp Forest (200-800m)
2. Midnight Zone (800-3000m)
3. Hadal Trench (3000-6000m)
4. The Void (6000m+)

---

## Missing Obstacle Sprites

Kelp Forest:
- [ ] kelp-obstacle-left.png
- [ ] kelp-obstacle-right.png

Midnight Zone:
- [ ] midnight-obstacle-jellyfish.png
- [ ] midnight-obstacle-wall-left.png
- [ ] midnight-obstacle-wall-right.png

Hadal Trench:
- [ ] hadal-obstacle-rock-left.png
- [ ] hadal-obstacle-rock-right.png
- [ ] hadal-obstacle-debris.png

The Void:
- [ ] void-obstacle-fragment.png
- [ ] void-obstacle-bar.png

---

## Missing Backgrounds (5 total)

- [ ] bg-shallows.png â€” bright blue, light rays, surface visible
- [ ] bg-kelp.png â€” dense green kelp, darker water
- [ ] bg-midnight.png â€” near-black, bioluminescent particles
- [ ] bg-hadal.png â€” dark rocky walls, crushing depth
- [ ] bg-void.png â€” pure white or glitchy abstract

Recommended size: match your game resolution (check index.html or main.js config)

---

## Missing Music (3 per biome, ~15 tracks total)

- [ ] music-shallows-1.mp3 / -2 / -3
- [ ] music-kelp-1.mp3 / -2 / -3
- [ ] music-midnight-1.mp3 / -2 / -3
- [ ] music-hadal-1.mp3 / -2 / -3
- [ ] music-void-1.mp3 / -2 / -3

Generate via Suno. Prompts:
- Kelp: "underwater ambient, slow bubbling, light and eerie, no vocals"
- Midnight: "deep sea horror ambient, bioluminescent, tense, no melody"
- Hadal: "crushing pressure, low drone, dark industrial, 120bpm"
- Void: "distorted glitch ambient, reversed reverb, unsettling"

---

## Missing SFX

- [ ] sfx-hit.mp3 â€” obstacle collision (short thud)
- [ ] sfx-death.mp3 â€” player death (impact + fade)
- [ ] sfx-collect.mp3 â€” pickup (bright chime)
- [ ] sfx-burst.mp3 â€” boost/bubble burst
- [ ] sfx-transition.mp3 â€” biome change (whoosh or depth ping)

---

## Special Effects

- [ ] The Void white flash transition (likely a code effect â€” check for flash-overlay.png or void-flash.png)

---

## Quick Verification Commands
List all current assets:
  find public/assets -type f | sort

Check all Phaser load calls:
  grep -n "this.load\." src/scenes/Game.js
  grep -n "this.load\." src/main.js
