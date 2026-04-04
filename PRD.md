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

## 13. Commit Rules — ABSOLUTE

- Small, descriptive commit messages
- One logical change per commit
- Must pass all tests before committing
- Format: `step: [description]` or `fix: [description]`

---

## 14. What Stays as React DOM

- HUD (score, timer, level, next fruit, save button)
- Pause menu
- Game over screen
- Popups and celebrations
- Score fly effects
- Point ticker
- Debug menu

## 15. What Goes Through Pixi

- Fruit bodies and faces
- Ground (wavy floor)
- Walls (grass walls)
- Clouds (animated)
- Effects (merge particles, stars, bomb ghosts)
- Danger line
- Background (CSS gradient, but behind Pixi canvas)
