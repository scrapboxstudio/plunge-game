# Asset Generation Prompts

Use these with Midjourney (v6), DALL-E 3, or Adobe Firefly.
Always request PNG with transparent background for sprites.

---

## Player Characters

### Bird / Flapper (Flappy Bird style)
**Midjourney:**
```
cute cartoon bird character, side view, wings spread mid-flap, bright yellow body, round eyes, 
simple clean design, game sprite style, white background, isolated, pixel-friendly proportions 
--ar 1:1 --style raw --v 6
```
**DALL-E:**
```
A cute cartoon bird game sprite, side profile view, wings in mid-flap position, bright cheerful 
colors, simple clean lines suitable for a mobile game, white background, isolated character
```

### Ninja Runner
```
cartoon ninja character side view running pose, dark outfit with colored accents, expressive face, 
mobile game sprite style, clean outlines, white background, isolated --ar 1:1 --v 6
```

### Space Fighter Ship
```
top-down view spaceship game sprite, sleek fighter design, glowing engines, neon blue and silver 
color scheme, transparent background, mobile game art style, clean vector look --ar 1:1 --v 6
```

### Dino Runner
```
cute cartoon dinosaur side view running pose, bright green, simple design, large expressive eyes, 
mobile game character sprite, white background --ar 1:1 --v 6
```

---

## Backgrounds (no transparency needed)

### Sky / Clouds (Tap Runner)
```
endless runner game background, bright blue sky, fluffy white clouds at different depths, 
parallax layers, simple cartoon style, mobile game art, 1080x1920 portrait orientation --ar 9:16
```

### Night City (Endless Runner)
```
side-scrolling endless runner game background, night city skyline, neon lights, rooftops, 
parallax layer, dark purple sky with stars, cyberpunk aesthetic, 2D game art style --ar 9:16
```

### Space (Shooter)
```
top-down space shooter game background, deep space, distant stars and nebula, subtle purple and 
blue hues, seamlessly tileable vertically, 2D game art --ar 9:16
```

### Jungle (Runner)
```
side-scrolling jungle game background, lush green vegetation, ancient ruins, 2D parallax layer,
cartoon style, vibrant colors, mobile game art --ar 9:16
```

### Ocean Underwater
```
underwater game background, coral reef, colorful fish, light rays from above, 2D cartoon style,
blue-green color palette, mobile game art, parallax layer --ar 9:16
```

---

## Obstacles / Enemies

### Pipes / Walls (Flappy Bird)
```
game obstacle pipe column, green with metal rim top, top-down flappy bird style pipe, 
clean cartoon art, white background, isolated --ar 1:3 --v 6
```

### Rock / Boulder (Runner)
```
cartoon rock obstacle game sprite, grey boulder, simple round design, 
clean outline, white background, isolated --ar 1:1 --v 6
```

### Enemy Ship (Shooter)
```
top-down alien spaceship sprite, menacing design, red and black colors, glowing elements, 
game enemy art style, white background, isolated --ar 1:1 --v 6
```

### Cactus (Desert Runner)
```
cartoon cactus game obstacle, green, simple clean design, multiple size variants, 
white background, isolated sprite, mobile game art --ar 1:2 --v 6
```

---

## Collectibles

### Coin / Star
```
gold coin game collectible sprite, shiny, simple design with shine highlight, 
cartoon style, white background, isolated --ar 1:1 --v 6
```

### Power-Up Variants
```
neon power up capsule game sprite, glowing, [choose: red for speed, blue for shield, 
yellow for magnet, green for double score], white background, isolated --ar 1:1 --v 6
```

---

## UI Elements

### Buttons (Play, Restart, etc.)
```
mobile game UI button, rounded rectangle, [green/red/blue], shiny glossy finish, 
white text placeholder space in center, drop shadow, isolated on white --ar 5:2 --v 6
```

### Hearts / Lives
```
game UI heart icon, red, glossy, game HUD style, white background, isolated --ar 1:1 --v 6
```

---

## App Icons (1024×1024)

### High-Energy / Arcade
```
mobile game app icon, 1024x1024, vibrant gradient background [choose color], 
centered [GAME CHARACTER OR OBJECT], bold dynamic composition, professional game icon design, 
high contrast, no text --ar 1:1 --v 6
```

### Cute / Casual
```
mobile app icon design, cute cartoon [character], pastel background with subtle pattern,
rounded corners aesthetic, cheerful and bright, no text, 1024x1024 --ar 1:1 --v 6
```

---

## Spritesheet Frames (Animation)

### Player Run Cycle (4 frames)
Generate individually, then combine:
```
Frame 1: [character] neutral run, left foot forward
Frame 2: [character] run, right foot forward  
Frame 3: [character] jumping pose, tucked
Frame 4: [character] sliding pose, crouched

Each: same style, white background, isolated, consistent size --ar 1:1 --v 6
```

### Explosion (4 frames)
```
cartoon explosion animation frame [1-4], [small/medium/large], orange and yellow, 
frame [N] of 4, sequential animation style, white background --ar 1:1 --v 6
```

---

## Audio Asset Sources (Free)

| Source | What to get |
|---|---|
| freesound.org | Jump, coin, explosion SFX |
| opengameart.org | Chiptune BGM, full SFX packs |
| pixabay.com/music | Background music, loops |
| zapsplat.com | Professional SFX library |
| jsfxr.com | Generate 8-bit SFX in browser (free) |

### jsfxr Quick Recipes (browser tool, no download needed)
- Jump: Preset "Jump" → adjust pitch up slightly
- Coin: Preset "Pickup/Coin" → works great as-is
- Explosion: Preset "Explosion" → reduce duration to 0.4s
- Laser: Preset "Laser/Shoot" → increase frequency sweep

---

## Quick Asset Checklist Per Game

Copy this and check off as you go:

```
□ Player sprite (idle)
□ Player sprite (action: jump/flap/shoot)  
□ Player sprite (death/hit)
□ Background layer 1 (far)
□ Background layer 2 (near, optional)
□ Obstacle/enemy sprite
□ Collectible (coin/star)
□ UI: Play button
□ UI: Restart button  
□ UI: Heart/life icon
□ App icon (1024×1024)
□ Splash screen (2732×2732, centered logo on solid color)
□ SFX: jump
□ SFX: die/death
□ SFX: score/collect
□ BGM: main loop (seamless)
```

---

## ADD Blend Mode — Neon-on-Black Style (PLUNGE approach)

This art style uses pure black as the "invisible" color. In Phaser's ADD blend mode, black pixels = fully transparent, bright pixels = glowing. No alpha channel needed.

### Key Principle
**Author sprites on pure black (#000000).** Bright/neon art on top glows when overlaid.

### AI Prompts for ADD Blend Mode Sprites

#### Neon Obstacles / Hazards
```
neon [shape/object] glowing art, pure black background (#000000), 
bright [cyan/purple/orange/white] outline with soft glow, no transparency needed, 
game sprite, high contrast --ar 1:1 --v 6
```

#### Neon Player Character
```
neon silhouette [character type], pure black background, bright glowing outline, 
[color] neon glow effect, game sprite style, high contrast --ar 1:1 --v 6
```

#### Neon Particles / Trails
```
neon particle effect, pure black background, [color] glowing dots or streaks, 
soft glow halo, game VFX sprite sheet, high contrast
```

#### Neon Biome Backgrounds (Wall/Cave style)
```
neon underwater cave walls, pure black background, glowing [cyan/blue/purple] 
mineral formations, bioluminescent effect, 2D game art, vertical orientation --ar 9:16
```

### Engine Setup
```js
// Apply ADD blend mode to a sprite
sprite.setBlendMode(Phaser.BlendModes.ADD);

// Apply to a group
this.obstacles = this.add.group({ blendMode: Phaser.BlendModes.ADD });

// Layering tip: put a dim background behind ADD-mode sprites
// The black in the sprite = fully transparent over whatever's behind it
```

### Color Palette That Works Well
| Biome | Primary Neon | Accent |
|---|---|---|
| Ocean | Cyan (#00ffff) | Teal (#00ffcc) |
| Cave | Orange (#ff6600) | Amber (#ffaa00) |
| Volcano | Red (#ff2200) | Yellow (#ffcc00) |
| Abyss | Purple (#aa00ff) | Violet (#cc44ff) |
| The Void | White (#ffffff) | Pale blue (#aaccff) |
