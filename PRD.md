# Fruit Bounce Merge — Absolute Rules PRD

> **This document defines absolute rules for the codebase. No rule may be violated without explicit approval.**

---

## 1. Layout Architecture

### 1.1 Pixi Canvas
- **Single canvas** at `100vw × 100vh`, `position: fixed`, `inset: 0`
- **All game rendering** goes through this canvas: fruits, ground, walls, clouds, effects, danger line, juice
- Canvas z-index: `0` (behind all React UI overlays)

### 1.2 Centered Column
- A **single centered column** contains: HUD → Game Area → Pause Button
- Column width = game area width (4:5 aspect ratio based on viewport height minus HUD/controls)
- **Never clips** — scales down on narrow viewports, constrained on wide viewports
- Always **centered horizontally and vertically** within the viewport
- HUD and controls have **percentage-based padding** (8% left/right, 6% top/bottom) for consistent spacing on all screen sizes

### 1.3 Column Internal Structure (top to bottom)
```
┌─────────────────────────────────┐
│  HUD (8% L/R, 6% top padding)   │  ← Score, timer, level, next fruit, save
├─────────────────────────────────┤
│                                 │
│     GAME AREA (4:5 ratio)       │  ← Fruits, physics, danger line
│                                 │
├─────────────────────────────────┤
│   PAUSE BUTTON [⏸] (6% bottom)  │
└─────────────────────────────────┘
```

### 1.4 Full-Viewport Elements (behind column)
- **Background**: Soft animated gradient filling entire viewport
- **Clouds**: Animated clouds in screen space, spanning full viewport width above the column
- **Sky gradient**: Blue gradient behind clouds for visibility

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

---

## 3. Rendering Architecture

### 3.1 Single Pixi Canvas Rule
- **One canvas** for ALL game rendering
- No secondary canvases, no 2D context rendering for game elements
- HUD, menus, popups, celebrations remain as **React DOM overlays**

### 3.2 Pixi Stage Structure (z-index order)
```
Stage (screen space, 100vw × 100vh)
├── Sky Gradient (zIndex: -210) — screen space, behind clouds
├── Clouds (zIndex: -200) — screen space, full viewport width
├── Game Container (zIndex: 0) — scaled, centered in canvas
│   ├── Ground (zIndex: -100) — virtual coords, extends to viewport bottom
│   ├── Juice (zIndex: -110) — virtual coords, behind ground
│   ├── Walls (zIndex: 50) — virtual coords, ABOVE fruits
│   ├── Danger Line (zIndex: 0) — virtual coords
│   ├── Effect Particles (zIndex: 0) — virtual coords
│   └── Fruit Sprites (zIndex: 0) — virtual coords
```

### 3.3 Renderer Coordinate Systems
| Renderer | Coordinate System | Parent |
|----------|------------------|--------|
| `CloudRenderer` | Screen space | Pixi stage |
| `Sky Gradient` | Screen space | Pixi stage |
| `GroundRenderer` | Virtual coords | Game container |
| `JuiceRenderer` | Virtual coords | Game container |
| `WallRenderer` | Virtual coords | Game container |
| `EffectRenderer` | Virtual coords | Game container |
| `RenderSystem` | Virtual coords | Game container |

---

## 4. Wall Positioning — Absolute Rules

### 4.1 Placement
- **Both walls**: Inner edge overlaps game area by **5px**
- Walls use **bezier curves** (`quadraticCurveTo`, `bezierCurveTo`) for smooth organic shapes
- Wall width: **80px** (fixed)
- Walls positioned **above fruits** (zIndex 50)

### 4.2 Coordinate Calculation (virtual coords)
```
leftWall.x = overlap - 70          // = -65 (5px overlap)
rightWall.x = V_WIDTH - overlap + 70  // = 665, with scale.x = -1
```
Both walls must overlap the game area by exactly the same amount (5px).

### 4.3 Wall Height
- Fixed to game area height (V_HEIGHT = 750)
- Does NOT extend to viewport bottom — ground handles that

---

## 5. Ground — Absolute Rules

### 5.1 Width
- Ground spans **full viewport width** in virtual coords
- Wave pattern loops consistently at any viewport width

### 5.2 Height
- Ground extends to **bottom of viewport** on any screen size
- Uses `screenVHeight = Math.max(V_HEIGHT, viewHeight / scaleFactor)`

### 5.3 Wave Pattern
- `waveY = virtualFloorY + sin(virtualX * 0.015) * 10 + cos(virtualX * 0.04) * 5`
- Step size: **5px**
- Stroke: `moveTo/lineTo` (not `poly()`) to avoid auto-closing bottom line
- Fill color: `#76C043`, Stroke color: `#2E5A1C`

---

## 6. Clouds — Absolute Rules

### 6.1 Implementation
- **`ParticleContainer`** with `Particle` objects (GPU instanced, 1 draw call)
- **5 clouds total** (1 per depth layer)
- Two shapes: **3-ball** (near/mid) and **2-ball** (far)

### 6.2 Depth System
| Layer | Scale | Alpha | Speed | Shape |
|-------|-------|-------|-------|-------|
| Near | 1.6 | 0.85 | 55 px/s | 3-ball |
| Mid-near | 1.3 | 0.75 | 40 px/s | 3-ball |
| Mid | 1.0 | 0.65 | 28 px/s | 3-ball |
| Mid-far | 0.8 | 0.55 | 20 px/s | 2-ball |
| Far | 0.55 | 0.45 | 14 px/s | 2-ball |

### 6.3 Looping
- Clouds spawn **off-screen left** (staggered)
- Drift right continuously
- When fully off-screen right, **respawn off-screen left** (no snapping, no popping)

### 6.4 Sky Gradient
- Canvas `createLinearGradient()` with 5 color stops
- From dark blue (#2563EB, 55% alpha) at top to transparent at bottom
- Behind clouds (zIndex -210), regenerated only on resize

---

## 7. Background — Absolute Rules

### 7.1 Design
- Soft animated gradient filling entire viewport (`100vw × 100vh`)
- **No pattern cycling**, no animated blobs
- Clean, minimal, doesn't distract from gameplay
- Fever mode: purple-tinted gradient

### 7.2 Implementation
- CSS gradient on a full-viewport div
- `position: fixed`, `inset: 0`, `z-index: 0` (behind Pixi canvas)
- Transition on fever state change: `2s ease`

---

## 8. Juice/Water Overlay — Absolute Rules

### 8.1 Implementation
- **Pixi Graphics** inside game container (virtual coords)
- Behind ground (zIndex -110)
- Animated wave on top edge using `Math.sin()`
- Smooth interpolation to target level (speed: 2.0 units/sec)

### 8.2 Height
- At 100% juice, water reaches **20px above danger line**
- At ~95% juice, water top is exactly at danger line
- Color: blue (#60A5FA) normal, purple (#A855F7) fever
- Opacity: 40% fill, 60% wave edge

---

## 9. HUD — Absolute Rules

### 9.1 Width
- HUD **must never exceed** the game area width
- Constrained by LayoutContainer

### 9.2 Padding
- **Left/Right**: 8% of container width
- **Top**: 6% of container height
- **Bottom**: 6% of container height (pause button)
- Percentage-based for consistent spacing on all screen sizes

### 9.3 Contents
- Score display (left)
- Timer (left, below score)
- Level indicator (left, below timer)
- Next fruit preview (right)
- Save/swap button (right, below next)
- SCORE and NEXT labels on same baseline

---

## 10. Fruit Rendering — Current Implementation

### 10.1 Architecture
- Each fruit = **1 `PIXI.Sprite`** with baked texture (body + face)
- **Faces baked into textures** at init time — not separate Graphics objects
- **Blinking** = swap between normal/blink texture
- **Fever pulse** = scale.x/y on the Sprite directly

### 10.2 Texture Generation
- `generateTexture()` with `resolution: 4` and `antialias: true`
- Two textures per fruit: normal face + blink face
- Textures stored in Maps: `normalTextures` and `blinkTextures`

### 10.3 Performance
- ~10 draw calls for 50 fruits (Pixi v8 auto-batches by texture)
- Zero per-frame face CPU work
- Blinking = texture swap (GPU operation)

---

## 11. Effect Rendering — Current Implementation

### 11.1 Merge Burst Particles
- **Batched Graphics** — single Graphics object with multiple circles
- Updates every frame (acceptable for short-lived particles)

### 11.2 Bomb Ghost Effect
- Single `Sprite` from pre-rendered texture, fades via alpha

---

## 12. Game Constants — ABSOLUTE

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
SUBSTEPS = 4
```

---

## 13. Pixi.js Configuration — ABSOLUTE

### 13.1 Canvas Init
```typescript
antialias: true,           // Enabled on ALL devices
resolution: devicePixelRatio,  // No cap — full DPR for sharpness
autoDensity: true,
preference: 'webgl',
```

### 13.2 Ticker
- `maxFPS: 0` (uncapped — runs at display refresh rate)
- Physics runs at fixed 60fps via substeps

---

## 14. File Organization — ABSOLUTE

### 14.1 Structure
```
services/
  fruits/          # One file per fruit (~50-60 lines each)
  renderers/       # Pixi renderers (Ground, Wall, Cloud, Effect, Juice)
  systems/         # Game systems (Physics, Input, Render, Score)
  GameEngine.ts    # Main orchestrator
components/        # React components
types/             # TypeScript types
tests/             # Playwright tests
```

### 14.2 File Size Limits
- **Soft limit**: 300 lines
- **Hard limit**: 400 lines — must split before exceeding
- No god files

---

## 15. Testing — ABSOLUTE

### 15.1 Requirements
- Every change must pass **all Playwright tests**
- Screenshot verification after each step
- Small, reversible commits per step
- No breaking changes without immediate fix

### 15.2 Playwright Config
- Headless Chrome with `--enable-unsafe-swiftshader` for WebGL
- Dev server on port **5100**
- `reuseExistingServer: true`

### 15.3 Multi-Size Testing
Test at these viewport sizes during development:
- **Mobile narrow:** 375×812
- **Mobile:** 390×844
- **Tablet:** 768×1024
- **Desktop:** 1280×900
- **Ultrawide:** 1920×1080

---

## 16. Dev Server — ABSOLUTE

- Port: **5100** (reserved)
- Host: `0.0.0.0` (external access)
- `allowedHosts: true` (network access)

---

## 17. Development & Testing Environment

### 17.1 Access URLs
- **Local:** `http://localhost:5100`
- **Network (Tailscale):** `http://pro.feist-crocodile.ts.net:5100`

### 17.2 Manual Testing Checklist
Before committing, verify manually:
- [ ] Start screen renders correctly
- [ ] Game starts and canvas appears
- [ ] Fruits drop and physics work
- [ ] Walls visible on both sides, overlapping game area by 5px each
- [ ] Ground visible and spans full viewport width, extends to bottom
- [ ] Clouds visible and animate above the game area
- [ ] HUD displays correctly with consistent padding
- [ ] Pause menu opens and closes
- [ ] No visual clipping or misalignment at any screen size

---

## 18. Commit Rules — ABSOLUTE

- Small, descriptive commit messages
- One logical change per commit
- Must pass all tests before committing
- Format: `fix: [description]` or `feat: [description]`

---

## 19. What Stays as React DOM

- HUD (score, timer, level, next fruit, save button)
- Pause menu
- Game over screen
- Popups and celebrations
- Score fly effects
- Point ticker
- Debug menu

## 20. What Goes Through Pixi

- Fruit bodies and faces (baked textures)
- Ground (wavy floor, extends to viewport bottom)
- Walls (grass walls, above fruits)
- Clouds (animated, screen space)
- Effects (merge particles, stars, bomb ghosts)
- Danger line
- Juice/water overlay (animated wave)
- Sky gradient (behind clouds)
- Background (CSS gradient, behind Pixi canvas)

---

## 21. Lessons Learned — Things to Be Careful Of

### 21.1 Coordinate Systems
- **Screen space** = Pixi stage coordinates (pixels). Used for: clouds, sky gradient.
- **Virtual space** = Game container coordinates (600×750). Used for: ground, walls, fruits, effects, juice.
- **NEVER mix coordinate systems** — a renderer must be either in the stage OR in the container, not both.
- When moving a renderer between stage and container, ALL position calculations must change.

### 21.2 Wall Positioning
- Walls are mirrored using `scale.x = -1` on the right wall.
- After mirroring: `rightWall.x = V_WIDTH - overlap + 70` (not `V_WIDTH + 70`).
- The `+70` accounts for the wall's inner edge being at local x=70.
- **Always verify both walls have the same overlap** — it's easy to get one side wrong.

### 21.3 Ground Extension
- Ground must extend to the **bottom of the viewport** on any screen size.
- Use `screenVHeight = Math.max(V_HEIGHT, viewHeight / scaleFactor)`.
- The bottom of the ground polygon should be at `screenVHeight + 100` (buffer).

### 21.4 Fruit Textures
- Use `generateTexture()` NOT `RenderTexture.create()` + `renderer.render()`.
- `generateTexture()` auto-fits bounds and centers content correctly.
- Resolution should be **4** for crisp vector-like rendering.
- Always set `antialias: true`.

### 21.5 Pixi v8 ParticleContainer
- `Particle` requires `anchorX` and `anchorY` to be set (or it crashes with `.trim()` error).
- `addParticle()` and `removeParticle()` are the correct methods.
- One texture per container — can't mix textures in a single ParticleContainer.
- Moving a particle between containers requires `removeParticle()` + `addParticle()`.

### 21.6 LayoutContainer Width
- LayoutContainer width = `(viewportHeight - HUD_HEIGHT - CONTROLS_HEIGHT) * 4/5`.
- This ensures the container width exactly matches the game area width.
- HUD and controls padding is percentage-based, not fixed pixels.

### 21.7 Headless Chrome Testing
- Headless Chrome uses SwiftShader (software rendering) — no hardware GPU.
- FPS in headless will be 3-5x lower than on a real device.
- Always use `--enable-unsafe-swiftshader` flag for WebGL to work at all.
- Visual verification should be done on a real device, not just headless tests.

### 21.8 What NOT to Change
- **Physics constants** — gravity, friction, damping, substeps. These are finely tuned.
- **Wall bezier curves** — the original design values produce the beautiful organic shapes.
- **Ground wave formula** — matches the original GroundCanvas exactly.
- **Virtual resolution** (600×750) — all physics and positions depend on this.
- **4:5 aspect ratio** — core to the game's visual identity.
