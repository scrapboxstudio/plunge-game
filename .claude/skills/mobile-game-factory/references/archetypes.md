# Game Archetypes Reference

## 1. Tap Runner (Easiest — Build First)
**Examples**: Flappy Bird, Copter game, Jetpack Joyride (simplified)

**Core mechanic**: Single tap/press → upward force. Gravity pulls down. Navigate gaps.

**What makes it addictive**: 
- Brutally simple to understand
- Brutally hard to master
- 5-second games = instant retry loop
- Skill ceiling is actually quite high

**Key variables to tune**:
- `gravity`: 600-900 (higher = harder, faster)
- `flapForce`: -350 to -450
- `gapSize`: 180-250px (smaller = harder)
- `obstacleSpeed`: 180-350px/s

**Theme variations** (same code, different art):
- Bird through pipes → spaceship through asteroids
- Frog jumping → ball bouncing → ghost flying
- Pipes → buildings, stalactites, clouds, swords

**Time to build**: 3-4 hours for polished version

---

## 2. Endless Runner (Most Popular Genre)
**Examples**: Subway Surfers, Temple Run, Jetpack Joyride, Geometry Dash

**Core mechanic**: Character auto-runs. Player jumps over / slides under obstacles. 

**Variants**:
- **Ground runner** (Subway Surfers): Swipe up=jump, down=slide, left/right=lane change
- **Gravity runner** (Geometry Dash): Tap to flip gravity
- **Auto-scroller** (Flappy + runner hybrid): Move up/down, obstacles come from right

**What makes it addictive**:
- "Just one more run"
- Distance-based score feels like progress
- Powerups break up monotony
- Characters/skins to unlock

**Key systems to build**:
1. Parallax scrolling background (2-3 layers)
2. Obstacle spawner with difficulty curve
3. Coin trail system
4. Jump + slide with animations
5. Powerup system (magnet, shield, x2 score)

**Time to build**: 6-10 hours for solid version

---

## 3. Stack (Hyper-Casual — 2nd Easiest)
**Examples**: Stack, Stack Jump, Helix Jump

**Core mechanic**: Tap at right moment to stack blocks. Miss = block shrinks or falls.

**What makes it addictive**:
- Perfect timing is satisfying
- Shrinking blocks create increasing pressure
- Very quick sessions

**Implementation notes**:
- Oscillating platform: `x = center + Math.sin(time * speed) * amplitude`
- On tap: freeze X, check overlap with stack below
- Cut off non-overlapping part, add remaining as new stack level
- If remaining block < threshold → game over

**Time to build**: 2-3 hours

---

## 4. Arcade Shooter (Classic)
**Examples**: Galaga, Space Invaders, 1942, Geometry Wars

**Core mechanic**: Move ship, shoot enemies, dodge bullets. Wave-based progression.

**What makes it addictive**:
- Clear progression (waves)
- Risk/reward (killing boss = massive points)
- Close calls are thrilling
- Powerups change playstyle

**Enemy patterns**:
```js
// Formation patterns
patterns = {
  vShape: // enemies form V coming down,
  grid: // classic Space Invaders grid,
  spiral: // enemies spiral in from edges,
  kamikaze: // one at a time, dive straight at player
}
```

**Wave design**: 
- Waves 1-3: Basic enemies, slow, grid formation
- Waves 4-6: Add armored enemies, side movement
- Wave 5, 10, 15...: Boss fight
- Wave 7+: Enemies shoot back

**Time to build**: 8-12 hours for polished version

---

## 5. Brick Breaker
**Examples**: Breakout, Arkanoid, Ballz

**Core mechanic**: Ball bounces. Paddle deflects. Break all bricks.

**Modern twist (Ballz style)**: 
- Multiple balls (grows with score)
- One-row-at-a-time grid that moves down
- Ball count is your score multiplier

**What makes it addictive**:
- Chain reactions are visually satisfying
- Ball count growing = tangible progress
- Strategic aim

**Key physics**:
- Ball reflects off walls/paddle with `setVelocity` adjustment
- Angle of reflection based on where ball hits paddle
- `if (ball.x < paddle.x) bounce left, else bounce right`

**Time to build**: 4-6 hours

---

## 6. Color Match / Reaction
**Examples**: Piano Tiles, Color Switch

**Core mechanic**: Tap in rhythm with colored obstacles. Color must match.

**What makes it addictive**:
- Rhythm feels good
- Very fast sessions
- High skill expression

**Time to build**: 3-4 hours

---

## Picking Your First 5 Games (Recommended Order)

1. **Tap Runner** — learn Phaser physics, obstacle spawning, high score
2. **Stack** — learn input timing, dynamic object creation
3. **Endless Runner** — learn parallax, animation, powerups
4. **Brick Breaker** — learn ball physics, grid management
5. **Arcade Shooter** — learn enemy AI, bullet systems, waves

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

Each re-skin: new art + new theme + new name = separate app store listing.
Time per re-skin: 2-4 hours (mostly asset swapping + UI color changes).
