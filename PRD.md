# Fruit Bounce Merge — Absolute Rules PRD

> **This document defines absolute rules for the codebase. No rule may be violated without explicit approval.**

---

## 1. Layout Architecture

### 1.1 Pixi Canvas
- **Single canvas** at `100vw × 100vh`, `position: fixed`, `inset: 0`
- **All game rendering** goes through this canvas: fruits, ground, walls, clouds, effects, danger line
- Canvas z-index: `0` (behind all React UI overlays)

### 1.2 Centered Column
- A **single centered column** contains: HUD → Game Area → Ground/Pause
- Column scales to use **maximum** viewport space while maintaining internal proportions
- **Never clips** — scales down on narrow viewports, scales up on wide viewports
- Always **centered horizontally and vertically** within the viewport
- **Nothing in the column may exceed the column width**

### 1.3 Column Internal Structure (top to bottom)
```
┌─────────────────────────────────┐
│         HUD (compact)           │  ← Score, timer, level, next fruit, save
├─────────────────────────────────┤
│                                 │
│     GAME AREA (4:5 ratio)       │  ← Fruits, physics, danger line
│                                 │
├─────────────────────────────────┤
│   GROUND + PAUSE BUTTON [⏸]    │  ← Ground overlaps game area slightly
└─────────────────────────────────┘
```

### 1.4 Full-Viewport Elements (behind column)
- **Background**: Soft gradient filling entire viewport (`100vw × 100vh`)
- **Clouds**: Animated clouds in screen space, spanning full viewport width above the column
- **Ground**: Wavy ground spans full `100vw`, top edge overlaps game area by a few pixels, wave pattern loops consistently at any viewport width
- **Walls**: Positioned at left and right edges of the game area, inner edges overlap the game area by ~2-5px (framing effect)

---

## 2. Game Area — Absolute Dimensions

### 2.1 Virtual Resolution
| Constant | Value | Description |
|----------|-------|-------------|
| `V_WIDTH` | **600** | Virtual width (ABSOLUTE) |
| `V_HEIGHT` | **750** | Virtual height (ABSOLUTE) |
| Aspect ratio | **4:5** | (ABSOLUTE — never change) |

### 2.2 Scaling
- `scaleFactor = Math.min(domGameAreaWidth / 600, domGameAreaHeight / 750)`
- Pixi container scaled by `scaleFactor`, centered within the canvas
- All physics, rendering, and game logic use virtual coordinates

### 2.3 Key Y-Positions (virtual coordinates)
| Element | Y Position | Calculation |
|---------|-----------|-------------|
| Spawn line | **45** | `750 × 0.06` |
| Danger line | **97.5** | `750 × 0.13` |
| Floor base | **690** | `750 - 60` (with wave ±15) |
| Physics floor | **735** | `750 - 15` |

### 2.4 Playable Area
- Height: **~592.5** virtual units (from danger line y=97.5 to floor base y=690)
- Width: **600** virtual units

---

## 3. Rendering Architecture

### 3.1 Single Pixi Canvas Rule
- **One canvas** for ALL game rendering
- No secondary canvases, no 2D context rendering for game elements
- HUD, menus, popups, celebrations remain as **React DOM overlays**

### 3.2 Pixi Stage Structure (z-index order)
```
Stage (screen space, 100vw × 100vh)
├── Clouds (zIndex: -200) — screen space, full viewport width
├── Game Container (zIndex: 0) — scaled, centered in canvas
│   ├── Ground (zIndex: -100) — virtual coords
│   ├── Walls (zIndex: -50) — virtual coords
│   ├── Danger Line (zIndex: 0) — virtual coords
│   ├── Effect Particles (zIndex: 0) — virtual coords
│   └── Fruit Sprites (zIndex: 0) — virtual coords
├── Ground Overlay (zIndex: 5) — screen space, full 100vw
└── Wall Overlays (zIndex: 5) — screen space, at game area edges
```

### 3.3 Screen-Space Renderers (on Pixi stage)
| Renderer | Position | Purpose |
|----------|----------|---------|
| `CloudRenderer` | Screen space, y=0 to containerTop | Animated clouds above game area |
| `GroundRenderer` | Screen space, full 100vw | Wavy ground spanning viewport |
| `WallRenderer` | Screen space, at game area edges | Left + right grass walls |

### 3.4 Virtual-Space Renderers (inside game container)
| Renderer | Position | Purpose |
|----------|----------|---------|
| `EffectRenderer` | Virtual coords | Merge particles, stars, bomb ghosts |
| `RenderSystem` | Virtual coords | Fruit sprites, danger line |

---

## 4. Wall Positioning — Absolute Rules

### 4.1 Placement
- **Left wall**: Inner edge overlaps game area left edge by **~2-5px**
- **Right wall**: Inner edge overlaps game area right edge by **~2-5px**
- Walls extend from just below HUD down to bottom of screen
- Wall width: **80px** (fixed)

### 4.2 Coordinate Calculation
```
leftWall.x = gameAreaLeft - wallWidth + overlap
rightWall.x = gameAreaLeft + gameAreaWidth - overlap
```
Where `overlap` is ~2-5px for the framing effect.

---

## 5. Ground — Absolute Rules

### 5.1 Width
- Ground spans **full 100vw** (viewport width)
- Wave pattern must loop consistently at any viewport width
- No clipping or distortion when viewport changes

### 5.2 Overlap
- Ground top edge overlaps game area bottom by **a few pixels** (framing effect)
- Ground extends to bottom of viewport

### 5.3 Wave Pattern
- Must match original GroundCanvas exactly:
  - `waveY = gameFloorY + sin(virtualX * 0.015) * 10 + cos(virtualX * 0.04) * 5`
  - Step size: **5px**
  - Stroke width: **4px**, color: `#2E5A1C`
  - Fill color: `#76C043`
  - Decorative circles at game area edges

---

## 6. Clouds — Absolute Rules

### 6.1 Position
- Clouds live in screen space, spanning **full 100vw**
- Zone: from `y=0` (top of screen) to `y=containerTop` (top of game area)
- 5 cloud layers with different scales, opacities, and animation speeds

### 6.2 Animation
- Use **Pixi.js ticker** — NO separate `requestAnimationFrame` loop
- Clouds drift left-to-right continuously
- Speeds: 12s to 30s per full pass (varies by layer)

---

## 7. Background — Absolute Rules

### 7.1 Design
- Soft gradient filling entire viewport (`100vw × 100vh`)
- **No pattern cycling**, no animated blobs
- Clean, minimal, doesn't distract from gameplay
- Fever mode: purple-tinted gradient

### 7.2 Implementation
- CSS gradient on a full-viewport div
- `position: fixed`, `inset: 0`, `z-index: -1` (behind everything)
- Transition on fever state change: `2s ease`

---

## 8. HUD — Absolute Rules

### 8.1 Width
- HUD **must never exceed** the column width (same as game area width)
- HUD is compact — does not steal space from game area

### 8.2 Contents
- Score display
- Timer
- Level indicator
- Next fruit preview
- Save/swap button

### 8.3 Position
- Directly above the 4:5 game area
- Same width as the game area column

---

## 9. Game Constants — ABSOLUTE

> **Never change these values without explicit approval.**

```typescript
V_WIDTH = 600
V_HEIGHT = 750
DANGER_Y_PERCENT = 0.13     // y = 97.5
SPAWN_Y_PERCENT = 0.06      // y = 45
FLOOR_OFFSET = 15
DANGER_TIME_MS = 5000
FEVER_DURATION_MS = 10000
JUICE_MAX = 1500
SCORE_BASE_MERGE = 2
FEVER_THRESHOLD = 5
PHYSICS_GRAVITY = 0.8
PHYSICS_FRICTION = 0.98
WALL_DAMPING = 0.5
FLOOR_DAMPING = 0.4
FRICTION_SLIDE = 0.99
FRICTION_LOCK = 0.5
SUBSTEPS = 3 (mobile) / 4 (desktop)
```

---

## 10. File Organization — ABSOLUTE

### 10.1 Structure
```
services/
  fruits/          # One file per fruit (~50-60 lines each)
  renderers/       # Pixi renderers (Ground, Wall, Cloud, Effect)
  systems/         # Game systems (Physics, Input, Render, Score)
  managers/        # Extracted from GameEngine (FruitManager, EffectManager, DangerManager)
  PixiGameApp.ts   # Pure Pixi wrapper
  GameEngine.ts    # Orchestration only
components/        # React components
types/             # TypeScript types
utils/             # Utility functions
hooks/             # React hooks
tests/             # Playwright tests
```

### 10.2 File Size Limits
- **Soft limit**: 300 lines
- **Hard limit**: 400 lines — must split before exceeding
- No god files

---

## 11. Testing — ABSOLUTE

### 11.1 Requirements
- Every change must pass **all Playwright tests**
- Screenshot verification after each step
- Small, reversible commits per step
- No breaking changes without immediate fix

### 11.2 Test Suite
- `tests/game.spec.ts` — Core gameplay tests
- `tests/visual-regression.spec.ts` — Visual parity tests
- `tests/screenshots.spec.ts` — Screenshot capture for review
- `tests/benchmark.spec.ts` — Performance stress test

### 11.3 Playwright Config
- Headless Chrome with `--enable-unsafe-swiftshader` for WebGL
- Dev server on port **5100**
- `reuseExistingServer: true`

---

## 12. Dev Server — ABSOLUTE

- Port: **5100** (reserved)
- Host: `0.0.0.0` (external access)
- `allowedHosts: true` (network access)

---

## 13. Development & Testing Environment — ABSOLUTE

### 13.1 Access URLs
- **Local:** `http://localhost:5100`
- **Network (Tailscale):** `http://pro.feist-crocodile.ts.net:5100`
- Always test on **both** localhost and the Tailscale URL during development

### 13.2 Manual Testing Checklist (Every Step)
Before committing, verify manually via browser on `pro.feist-crocodile.ts.net`:
- [ ] Start screen renders correctly
- [ ] Game starts and canvas appears
- [ ] Fruits drop and physics work
- [ ] Walls visible on both left and right edges of game area
- [ ] Ground visible and spans full viewport width
- [ ] Clouds visible and animate above the game area
- [ ] HUD displays correctly (score, timer, next fruit, save button)
- [ ] Pause menu opens and closes
- [ ] No visual clipping or misalignment at any screen size

### 13.3 Multi-Size Testing
Test the game at these viewport sizes during development:
- **Mobile narrow:** 375×812 (iPhone 12 Mini)
- **Mobile:** 390×844 (iPhone 12)
- **Tablet:** 768×1024 (iPad)
- **Desktop:** 1280×900
- **Ultrawide:** 1920×1080

### 13.4 Automated Testing
- `npx playwright test` — Run full test suite
- `npx playwright test tests/cloud-benchmark.spec.ts` — Cloud rendering benchmark
- `npx playwright test tests/screenshots.spec.ts` — Screenshot verification
- `npx playwright test tests/benchmark.spec.ts` — Game stress test (50 fruits)
- All tests must pass before every commit

### 13.5 Benchmark Pages (Manual)
- `http://localhost:5100/demo-clouds.html` — Interactive ParticleContainer cloud demo
- `http://localhost:5100/benchmark-clouds.html` — Automated benchmark (4 techniques × 6 counts)

---

## 14. Commit Rules — ABSOLUTE

- Small, descriptive commit messages
- One logical change per commit
- Must pass all tests before committing
- Format: `step: [description]` or `fix: [description]`

---

## 15. What Stays as React DOM

- HUD (score, timer, level, next fruit, save button)
- Pause menu
- Game over screen
- Popups and celebrations
- Score fly effects
- Point ticker
- Debug menu

## 16. What Goes Through Pixi

- Fruit bodies and faces
- Ground (wavy floor)
- Walls (grass walls)
- Clouds (animated)
- Effects (merge particles, stars, bomb ghosts)
- Danger line
- Background (CSS gradient, but behind Pixi canvas)

---

## 17. Fruit Rendering — ABSOLUTE

### 17.1 Architecture
- **ALL fruits rendered via a single `ParticleContainer`** — 1 draw call for every fruit on screen
- Each fruit = **1 `PIXI.Particle`** (lightweight, not a full Sprite or Container)
- **Faces baked into fruit textures** — not separate Graphics objects
- **Blinking** = swap to alternate texture (eyes squished), NOT scale.y animation
- **Fever pulse** = scale.x/y on the Particle directly, NOT on a parent Container

### 17.2 Texture Atlas
- All fruit textures packed into a **single sprite sheet / texture atlas** at game init
- Each fruit has **2 frames**: normal face + blink face
- Texture resolution: `2x` (matches device DPR, capped at 2 for mobile)
- Atlas allows ParticleContainer to use different textures per particle via sprite sheet UVs

### 17.3 Face Baking Rules
- Face (eyes + mouth) rendered into the fruit texture during atlas generation
- Eyes: simple circles with pupils, facing forward
- Blink frame: eyes rendered as thin horizontal lines (scale.y = 0.1 equivalent)
- No dynamic look-direction — eyes face forward (trade-off for maximum performance)

### 17.4 Performance Targets
- **Max 50 fruits on screen** simultaneously
- **1 draw call for ALL fruits** (single ParticleContainer)
- **Zero Graphics objects** for fruit faces
- **Zero Container wrappers** around fruit Sprites
- Fruit rendering must not exceed **1ms per frame** at 50 fruits

### 17.5 ParticleContainer Configuration
```typescript
new PIXI.ParticleContainer({
    dynamicProperties: { position: true, scale: true, rotation: true, color: false },
});
```
- **Dynamic:** position (x/y changes every frame), scale (fever pulse), rotation (fruit spin)
- **Static:** color/alpha (set once, never changes per frame)

### 17.6 Current vs Target
| Aspect | Current | Target |
|--------|---------|--------|
| Container type | Individual Containers | Single ParticleContainer |
| Objects per fruit | 3 (Container + Sprite + Graphics) | 1 (Particle) |
| Draw calls (50 fruits) | 100+ | **1** |
| Face rendering | Per-frame Graphics update | Baked texture swap |
| Blinking | eyes.scale.y animation | Texture swap |
| Total display objects (50 fruits) | 150+ | 50 (all in 1 container) |

---

## 18. Effect Rendering — ABSOLUTE

### 18.1 Merge Burst Particles
- Use **`ParticleContainer`** with `Particle` objects — NOT batched Graphics
- Particles share a single circle/star texture from atlas
- GPU instanced, 1 draw call for all burst particles
- Max 30 burst particles simultaneously

### 18.2 Stars / Score Popups
- DOM-based (React), not Pixi — these are UI elements

### 18.3 Bomb Ghost Effect
- Single `Sprite` from pre-rendered texture, fades via alpha
- Short-lived (0.5 seconds)

### 18.4 Performance Targets
- **All effects in 1 draw call** (ParticleContainer)
- **Zero `Graphics.clear()` + redraw per frame** — too CPU-heavy
- Max 50 effect particles simultaneously

---

## 19. Background Rendering — ABSOLUTE

### 19.1 Implementation
- CSS gradient on a full-viewport `<div>` (`position: fixed`, `inset: 0`, `z-index: 0`)
- **No Pixi background** — CSS is more performant for full-screen gradients

### 19.2 Color Cycling
- **Normal mode:** cycle through 5 colors every **4 seconds**
- **Fever mode:** cycle through 5 fever colors every **1.5 seconds**
- CSS `transition: background 1.5s ease` for smooth morphing

---

## 20. Cloud Rendering — ABSOLUTE

### 20.1 Implementation
- **`ParticleContainer`** with `Particle` objects (GPU instanced, 1 draw call)
- **5 clouds total** (1 per depth layer)
- Two shapes: **3-ball** (near/mid) and **2-ball** (far)

### 20.2 Depth System
| Layer | Scale | Alpha | Speed | Shape |
|-------|-------|-------|-------|-------|
| Near | 1.4 | 0.65 | 55 px/s | 3-ball |
| Mid-near | 1.1 | 0.55 | 40 px/s | 3-ball |
| Mid | 0.8 | 0.40 | 28 px/s | 3-ball |
| Mid-far | 0.6 | 0.30 | 20 px/s | 2-ball |
| Far | 0.4 | 0.20 | 14 px/s | 2-ball |

### 20.3 Looping
- Clouds spawn **off-screen left** (staggered)
- Drift right continuously
- When fully off-screen right, **respawn off-screen left** (no snapping, no popping)
