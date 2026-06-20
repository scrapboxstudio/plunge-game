# Game Archetypes Reference

## 1. Tap Runner (Easiest — Build First)
**Examples:** Flappy Bird, Copter game, Jetpack Joyride (simplified)

**Core mechanic:** Single tap/press → upward force. Gravity pulls down. Navigate gaps.

**What makes it addictive:**
- Brutally simple to understand
- Brutally hard to master
- 5-second games = instant retry loop
- Skill ceiling is actually quite high

**Key variables to tune:**
- `gravity`: 600-900 (higher = harder, faster)
- `flapForce`: -350 to -450
- `gapSize`: 180-250px (smaller = harder)
- `obstacleSpeed`: 180-350px/s

**Theme variations (same code, different art):**
- Bird through pipes → spaceship through asteroids
- Frog jumping → ball bouncing → ghost flying
- Pipes → buildings, stalactites, clouds, swords

**Time to build:** 3-4 hours for polished version

---

## 2. Endless Runner (Most Popular Genre)
**Examples:** Subway Surfers, Temple Run, Jetpack Joyride, Geometry Dash

**Core mechanic:** Character auto-runs. Player jumps over / slides under obstacles.

**Variants:**
- **Ground runner** (Subway Surfers): Swipe up=jump, down=slide, left/right=lane change
- **Gravity runner** (Geometry Dash): Tap to flip gravity
- **Auto-scroller hybrid**: Move up/down, obstacles come from right

**What makes it addictive:**
- "Just one more run"
- Distance-based score feels like progress
- Powerups break up monotony
- Skins/characters to unlock

**Key systems:**
1. Parallax scrolling background (2-3 layers)
2. Obstacle spawner with difficulty curve
3. Coin trail system
4. Jump + slide with animations
5. Powerup system (magnet, shield, x2 score)

**Time to build:** 6-10 hours for solid version

---

## 3. Endless Diver (PLUNGE-style)
**Examples:** PLUNGE, similar vertical endless games

**Core mechanic:** Player descends through a world. Dodge obstacles, collect items. Biomes change as you go deeper.

**What makes it addictive:**
- Vertical progression feels like exploration/adventure
- Biome transitions create natural "one more zone" pull
- Hidden late-game content (see Secret Content below)
- Cosmetics tied to depth milestones

**Key systems:**
1. Depth/score tracker
2. Biome system (background + obstacle set swaps at depth thresholds)
3. Obstacle spawner with per-biome patterns
4. Continue/revive system with AdMob rewarded ad
5. Coin economy + cosmetic shop

**Biome design template:**
```js
const BIOMES = [
  { name: 'Ocean',    depthStart: 0,    bgKey: 'bg_ocean',    color: 0x0066ff },
  { name: 'Cave',     depthStart: 500,  bgKey: 'bg_cave',     color: 0x441100 },
  { name: 'Volcano',  depthStart: 1200, bgKey: 'bg_volcano',  color: 0xff3300 },
  { name: 'Abyss',    depthStart: 2500, bgKey: 'bg_abyss',    color: 0x110022 },
  { name: 'The Void', depthStart: 5000, bgKey: 'bg_void',     color: 0x000000 }, // secret
];
```

**Time to build:** 6-10 hours for solid version

---

## 4. Stack (Hyper-Casual — 2nd Easiest)
**Examples:** Stack, Stack Jump, Helix Jump

**Core mechanic:** Tap at right moment to stack blocks. Miss = block shrinks or falls.

**What makes it addictive:**
- Perfect timing is satisfying
- Shrinking blocks create increasing pressure
- Very quick sessions

**Implementation:**
```js
// Oscillating platform
x = center + Math.sin(time * speed) * amplitude;
// On tap: freeze X, check overlap, cut non-overlapping part
```

**Time to build:** 2-3 hours

---

## 5. Arcade Shooter (Classic)
**Examples:** Galaga, Space Invaders, Geometry Wars

**Core mechanic:** Move ship, shoot enemies, dodge bullets. Wave-based progression.

**Enemy patterns:**
```js
const patterns = {
  grid:      // classic Space Invaders grid
  vShape:    // V formation coming down
  spiral:    // enemies spiral in from edges
  kamikaze:  // one at a time, dive at player
};
```

**Wave design:**
- Waves 1-3: Basic enemies, slow, grid formation
- Waves 4-6: Armored enemies, side movement
- Wave 5/10/15: Boss fight
- Wave 7+: Enemies shoot back

**Time to build:** 8-12 hours for polished version

---

## 6. Brick Breaker
**Examples:** Breakout, Arkanoid, Ballz

**Core mechanic:** Ball bounces. Paddle deflects. Break all bricks.

**Modern twist (Ballz-style):**
- Multiple balls (grows with score)
- One-row grid that moves down
- Ball count is your score multiplier

**Time to build:** 4-6 hours

---

## 7. Color Match / Reaction
**Examples:** Piano Tiles, Color Switch

**Core mechanic:** Tap in rhythm with colored obstacles. Color must match.

**Time to build:** 3-4 hours

---

## Secret / Endless Late-Game Content (Retention Driver)

A hidden "final zone" beyond normal progression drives retention and word-of-mouth. This is one of the highest-ROI features you can add after core gameplay is solid.

### Design Pattern
- **Trigger:** Reaching a depth/score that's far enough that leaderboard players find it in week one but casual players take weeks. Example: ~15 minutes of max-difficulty survival.
- **Entrance:** Make it feel like the game "broke" in a good way. A hard white flash (not a normal biome crossfade) works well — players genuinely wonder if something went wrong.
- **Zone design:** Endless final zone cycles backgrounds and pulls obstacles from ALL previous biomes. Infinite runway without authoring infinite content.
- **Reward:** Exclusive cosmetic or achievement only unlockable here. Makes it worth talking about.

### Implementation Sketch
```js
// In update() or depth check:
if (this.depth >= SECRET_DEPTH && !this._enteredVoid) {
  this._enteredVoid = true;
  this.cameras.main.flash(500, 255, 255, 255);  // hard white flash
  this.time.delayedCall(500, () => this._enterVoid());
}

_enterVoid() {
  this.currentBiome = 'void';
  // Pull obstacles randomly from all biome pools
  // Loop background
  // Grant exclusive cosmetic if not already owned
}
```

### Why This Works
- Reachable but hard = leaderboard players find it first → they post about it → others try
- Distinct entrance = memorable moment worth sharing
- Infinite zone = no "end state" — game never officially ends

---

## Picking Your First 5 Games (Recommended Order)

1. **Tap Runner** — learn Phaser physics, obstacle spawning, high score
2. **Stack** — learn input timing, dynamic object creation
3. **Endless Runner** — learn parallax, animation, powerups
4. **Brick Breaker** — learn ball physics, grid management
5. **Arcade Shooter or Endless Diver** — learn enemy AI/biome systems, waves

By game 5, you'll build any new game in 1-2 days.

---

## Re-Skinning Strategy (Fastest Way to Ship More Games)

After building core mechanic once, re-skin = new game:

| Base Game | Re-skin 1 | Re-skin 2 | Re-skin 3 |
|---|---|---|---|
| Bird flapper | Space rocket | Bouncing ball | Flying ghost |
| Dino runner | Ninja runner | Car dodge | Robot runner |
| Space shooter | Ocean shooter | Fantasy archer | Tank battle |
| Brick breaker | Candy breaker | Ice breaker | Space breaker |
| Endless diver | Space descent | Cave crawl | Dream fall |

Each re-skin: new art + theme + name = separate listing. Time per re-skin: 2-4 hours.
