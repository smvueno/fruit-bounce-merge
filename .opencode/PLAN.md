# Fruit Bounce Merge — Pure Pixi.js Refactor Plan

## Executive Summary

**Current State:** A hybrid React + Pixi.js game with 6 separate rendering layers:
1. **Pixi.js canvas** — fruit bodies, faces, danger line, floor (inside GameCanvas)
2. **EffectCanvas (2D)** — merge particles, stars, bomb ghosts (separate fullscreen canvas)
3. **GroundCanvas (2D)** — wavy floor extending to screen edges (separate fullscreen canvas)
4. **WallCanvas (2D)** — grass walls on sides (separate fullscreen canvas)
5. **CloudsCanvas (2D)** — animated clouds above game area (separate canvas)
6. **DOM overlays** — JuiceOverlay (CSS mask), HUD, menus, popups, celebrations

**Target State:** Single Pixi.js Application managing ALL game rendering, with React handling only the non-game UI (menus, HUD, modals).

---

## Current Architecture Problems Identified

### Critical Issues
1. **6 rendering contexts** — Pixi.js + 4 separate 2D canvases + CSS = massive coordination overhead
2. **Coordinate system hell** — Each canvas independently converts between virtual → screen coordinates, causing drift/alignment bugs
3. **EffectCanvas uses raw 2D context** — duplicates particle logic already in EffectSystem, completely bypassing Pixi.js GPU rendering
4. **GroundCanvas/WallCanvas re-render on every resize** — static artwork redrawn via 2D context instead of being in Pixi scene graph
5. **CloudsCanvas runs its own rAF loop** — separate from Pixi ticker, unsynchronized animations

### Performance Issues
6. **RenderSystem creates one Graphics object per fruit face+eyes** — should use cached textures
7. **EffectRenderer exists but is UNUSED** — EffectCanvas.tsx does manual 2D rendering instead of using this Pixi-based renderer
8. **fruitConfig.tsx = 675 lines** — god file mixing React SVG + Pixi Graphics definitions
9. **GameEngine.ts = 1223 lines** — orchestrates everything, too coupled
10. **Texture generation on every context restore** — blocks rendering during restoration

### Architecture Issues
11. **No sprite batching** — each fruit is a separate Container with Sprite + Graphics children
12. **No texture atlas** — each fruit texture is individually generated RenderTexture
13. **No ParticleContainer usage** — Pixi.js v8's ParticleContainer can handle 100K+ particles, but we're using regular Containers
14. **EffectSystem + EffectCanvas split** — EffectSystem manages particle data, EffectCanvas renders with 2D context (should be one Pixi system)

---

## Refactor Strategy: Micro-Steps (Each Testable via Playwright)

**Core Principle:** Each step is independently testable. After every step, the game must pass all existing Playwright tests AND look visually identical. We move ONE rendering layer at a time into Pixi.js.

### PHASE 0: Foundation (Steps 0.1-0.4)

#### Step 0.1: Fix Playwright config + add visual regression baseline
- **What:** Update `playwright.config.ts` baseURL to port 5100 (from 4173). Add visual snapshot tests for start screen, game canvas, pause menu.
- **Why:** We need baselines to verify visual parity after every refactor step.
- **Files:** `playwright.config.ts`, `tests/visual-regression.spec.ts` (new)
- **Test:** `npx playwright test tests/visual-regression.spec.ts` — captures baseline screenshots
- **Risk:** None — additive only

#### Step 0.2: Create `PixiGameApp` class (pure Pixi wrapper)
- **What:** New class that encapsulates PIXI.Application lifecycle. Replaces the ad-hoc Pixi setup in GameEngine. Manages a single canvas element.
- **Why:** Clean separation between Pixi lifecycle and game logic.
- **Files:** `services/PixiGameApp.ts` (new)
- **Test:** Existing game.spec.ts tests still pass (this class is not wired in yet)
- **Risk:** None — dead code until wired in

#### Step 0.3: Move fruit textures to pre-generated atlas
- **What:** Instead of generating RenderTextures at runtime, create a proper texture atlas. Pre-bake all fruit body textures + face textures into a single atlas JSON + PNG.
- **Why:** Eliminates runtime texture generation, reduces GPU memory, enables sprite batching.
- **Files:** `services/TextureAtlas.ts` (new), `services/fruitConfig.tsx` (refactor)
- **Test:** Visual regression test — fruits must look identical
- **Risk:** Medium — texture coordinates must be exact. Keep old system as fallback during transition.

#### Step 0.4: Add `ParticleContainer` for fruits in RenderSystem
- **What:** Swap from individual Container+Sprite per fruit to Pixi.js v8 ParticleContainer. Particles support position, rotation, scale, alpha, tint — exactly what we need.
- **Why:** 10-100x faster rendering for fruit bodies. v8 ParticleContainer handles 100K+ sprites.
- **Files:** `services/systems/RenderSystem.ts` (modify)
- **Test:** Visual regression + benchmark.spec.ts — FPS should improve
- **Risk:** Medium — ParticleContainer has limitations (no nested children). Faces must be handled separately or baked into textures.

---

### PHASE 1: Move Ground & Walls into Pixi (Steps 1.1-1.3)

#### Step 1.1: Create `GroundRenderer` in Pixi
- **What:** New Pixi Graphics-based renderer for the wavy floor. Lives inside the main Pixi container.
- **Why:** Eliminates GroundCanvas.tsx (2D context). Single coordinate system.
- **Files:** `services/renderers/GroundRenderer.ts` (new), `services/systems/RenderSystem.ts` (integrate)
- **Test:** Visual regression — ground must look identical. No JS errors.
- **Risk:** Low — GroundRenderer draws static shape, just needs correct coordinate mapping.

#### Step 1.2: Create `WallRenderer` in Pixi
- **What:** Pixi Graphics-based grass walls. Same approach as GroundRenderer.
- **Why:** Eliminates WallCanvas.tsx.
- **Files:** `services/renderers/WallRenderer.ts` (new)
- **Test:** Visual regression — walls must look identical.
- **Risk:** Low — static shapes.

#### Step 1.3: Remove GroundCanvas and WallCanvas from GameCanvas.tsx
- **What:** Delete the `<GroundCanvas>` and `<WallCanvas>` JSX from GameCanvas. Remove their imports.
- **Why:** Now rendered by Pixi.
- **Files:** `components/GameCanvas.tsx` (remove), `components/GroundCanvas.tsx` (delete), `components/WallCanvas.tsx` (delete)
- **Test:** Visual regression must pass. All existing tests pass.
- **Risk:** Low — if Pixi renderers are correct, this is just removing the old DOM elements.

---

### PHASE 2: Move Effects into Pixi (Steps 2.1-2.3)

#### Step 2.1: Wire up existing EffectRenderer in RenderSystem
- **What:** The `EffectRenderer.ts` already exists but is UNUSED. Integrate it into the Pixi scene graph. Have RenderSystem call it instead of the 2D EffectCanvas.
- **Why:** Effects will render on GPU via Pixi instead of 2D canvas.
- **Files:** `services/systems/RenderSystem.ts` (integrate EffectRenderer), `services/GameEngine.ts` (wire up)
- **Test:** Visual regression — merge particles, stars, bomb ghosts must look identical.
- **Risk:** Medium — coordinate mapping must match exactly.

#### Step 2.2: Migrate EffectCanvas particles to use Pixi Graphics batching
- **What:** Replace EffectCanvas's manual 2D batched rendering with EffectRenderer's Pixi Graphics approach. Use single Graphics object with multiple draw calls (already implemented).
- **Why:** Unified rendering pipeline.
- **Files:** `services/renderers/EffectRenderer.ts` (enhance), `components/EffectCanvas.tsx` (hollow out)
- **Test:** Visual regression + benchmark — particles should render correctly.
- **Risk:** Medium — color conversion (string vs number) and alpha handling must match.

#### Step 2.3: Remove EffectCanvas from GameCanvas.tsx
- **What:** Delete `<EffectCanvas>` from GameCanvas and the component file.
- **Why:** Now fully in Pixi.
- **Files:** `components/GameCanvas.tsx` (remove), `components/EffectCanvas.tsx` (delete)
- **Test:** All tests pass. Visual regression passes.
- **Risk:** Low — if Step 2.1-2.2 work, this is cleanup.

---

### PHASE 3: Move Clouds into Pixi (Steps 3.1-3.2)

#### Step 3.1: Create `CloudRenderer` in Pixi
- **What:** Pixi Graphics-based cloud layer. Animate via Pixi ticker instead of separate rAF loop.
- **Why:** Eliminates CloudsCanvas.tsx and its unsynchronized rAF loop.
- **Files:** `services/renderers/CloudRenderer.ts` (new)
- **Test:** Visual regression — clouds must float identically.
- **Risk:** Low — simple animated shapes.

#### Step 3.2: Remove CloudsCanvas from GameCanvas.tsx
- **What:** Delete `<CloudsCanvas>` and component file.
- **Files:** `components/GameCanvas.tsx` (remove), `components/CloudsCanvas.tsx` (delete)
- **Test:** Visual regression passes.
- **Risk:** Low.

---

### PHASE 4: Consolidate & Optimize (Steps 4.1-4.4)

#### Step 4.1: Merge fruit body + face into single texture per fruit
- **What:** Instead of Container(Sprite + Graphics face), bake face into the fruit texture during atlas generation. Blinking = swap to alternate texture with squished eyes.
- **Why:** Reduces draw calls from 2N to N per fruit. Eliminates per-frame face position updates.
- **Files:** `services/TextureAtlas.ts` (enhance), `services/systems/RenderSystem.ts` (simplify)
- **Test:** Visual regression — fruits must look identical including blinking.
- **Risk:** Medium — need blink frame textures. Can use tint/scale for blink effect instead.

#### Step 4.2: Extract fruitConfig.tsx (675 lines) into per-fruit files
- **What:** Split the god file into `services/fruits/cherry.ts`, `services/fruits/strawberry.ts`, etc. Each ~50-70 lines.
- **Why:** Readability, maintainability. Follows modular-code-manager skill.
- **Files:** `services/fruits/` (new directory), `services/fruitConfig.tsx` → `services/fruitConfig.ts` (index)
- **Test:** All existing tests pass. No behavioral change.
- **Risk:** Low — pure file splitting, no logic changes.

#### Step 4.3: Extract GameEngine systems into dedicated managers
- **What:** Break GameEngine (1223 lines) into:
  - `services/managers/FruitManager.ts` — spawn, merge, remove fruits
  - `services/managers/EffectManager.ts` — tomato, bomb, celebration effects
  - `services/managers/DangerManager.ts` — danger zone logic
  - `services/GameEngine.ts` — slimmed to orchestration only (~300 lines)
- **Why:** Each file under 300 lines. Easier to test and modify.
- **Files:** New manager files, GameEngine.ts (reduced)
- **Test:** All existing tests pass. Benchmark must maintain FPS.
- **Risk:** Medium — careful extraction needed, but each manager is logically separable.

#### Step 4.4: JuiceOverlay → Pixi Graphics
- **What:** Move the CSS-mask-based juice/water overlay into a Pixi Graphics wave shape.
- **Why:** Last non-Pixi visual element in the game area. Eliminates CSS mask complexity.
- **Files:** `services/renderers/JuiceRenderer.ts` (new), `components/JuiceOverlay.tsx` (delete or keep as fallback)
- **Test:** Visual regression — juice wave must look identical.
- **Risk:** Medium — CSS wave mask → Graphics bezier conversion must match visually.

---

### PHASE 5: Final Cleanup (Steps 5.1-5.3)

#### Step 5.1: Single canvas element
- **What:** GameCanvas.tsx should render only ONE `<canvas>` element for all game rendering. Remove any remaining auxiliary canvases.
- **Test:** DOM inspection shows exactly 1 game canvas. All visual tests pass.
- **Risk:** Low — if all previous phases complete, this is just verification.

#### Step 5.2: Performance audit
- **What:** Run benchmark.spec.ts before/after. Target: 50%+ FPS improvement under stress.
- **Test:** `npx playwright test tests/benchmark.spec.ts`
- **Risk:** None — measurement only.

#### Step 5.3: Code cleanup & dead code removal
- **What:** Remove unused imports, dead code paths, fallback systems.
- **Test:** Full test suite passes. TypeScript compiles clean.
- **Risk:** Low.

---

## Playwright Test Strategy Per Step

Every step must pass this test matrix:

| Test | Purpose |
|------|---------|
| `game.spec.ts` — start screen loads | UI still renders |
| `game.spec.ts` — click play starts game | Canvas initializes |
| `game.spec.ts` — can drop a fruit | Physics + rendering works |
| `game.spec.ts` — pause/resume | Game state management |
| `game.spec.ts` — no uncaught JS errors | No runtime errors |
| `benchmark.spec.ts` — stress test FPS | Performance regression check |
| `visual-regression.spec.ts` — screenshot diff | Visual parity check |

### New Visual Regression Test (`tests/visual-regression.spec.ts`)
```
- Start screen → screenshot baseline
- After 1 fruit drop → screenshot baseline  
- After 5 fruit drops → screenshot baseline
- Pause menu open → screenshot baseline
- Fever mode active → screenshot baseline (triggered via debug)
```

---

## Files to Delete (Eventually)
- `components/GroundCanvas.tsx`
- `components/WallCanvas.tsx`
- `components/EffectCanvas.tsx`
- `components/CloudsCanvas.tsx`
- `services/renderers/EffectRenderer.ts` (replaced by integrated approach)

## Files to Create
- `services/PixiGameApp.ts`
- `services/TextureAtlas.ts`
- `services/renderers/GroundRenderer.ts`
- `services/renderers/WallRenderer.ts`
- `services/renderers/CloudRenderer.ts`
- `services/renderers/JuiceRenderer.ts`
- `services/fruits/*.ts` (12 files, one per fruit)
- `services/managers/FruitManager.ts`
- `services/managers/EffectManager.ts`
- `services/managers/DangerManager.ts`
- `tests/visual-regression.spec.ts`

---

## User-Decided Architecture
- **Fruit faces:** Baked into textures with blink-frame swap (most performant + simplest)
- **JuiceOverlay:** Keep as CSS (1 DOM element, works fine)
- **Background blobs:** Remove → replace with soft animated gradient background
- **HUD elements:** Keep as React overlay (score, timer, next fruit preview)
- **Commit style:** Small, reversible commits per micro-step
