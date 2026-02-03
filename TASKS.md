# Master Optimization Task List

This document is the **Source of Truth** for the High-Performance Refactor.
Each task is designed to be executed by a dedicated agent. **Start from 1.1 and proceed sequentially.**

---

## 🛑 Global Rules for Agents
1.  **Strict Visual Parity**: If it doesn't look *exactly* like the current game, it is a failure.
2.  **Zero-Regression**: No existing game logic (physics, scoring, audio) can change.
3.  **Clean-Code**: New renderers must be in `services/systems/renderers/`.

---

## Phase 1: Infrastructure (The Foundation)
**Goal:** Enable PixiJS to render the full screen background layers.

### [x] Task 1.1: Consolidate Pixi Container Structure
*   **Implementation Details**:
    *   Edit `GameEngine.ts` constructor.
    *   Rename `this.container` -> `this.rootContainer` (This must NOT scale. It stays 1:1 with screen pixels).
    *   Create `this.gameContainer = new PIXI.Container()` inside `rootContainer`.
    *   Update `handleResize()`:
        *   Calculate `scaleFactor` as usual.
        *   Apply `scaleFactor` ONLY to `this.gameContainer`.
        *   Center `this.gameContainer` within `this.rootContainer`.
*   **Definition of Done**:
    *   [x] Game loads and resizing the window keeps the game board centered.
    *   [x] Debug overlay (red lines) match the fruit positions accurately.
    *   [x] `rootContainer` size equals `app.screen` size.
*   **Stress Test**: Resize window rapidly for 10 seconds. Fruits remain locked to physics positions.

### [x] Task 1.2: Update RenderSystem Layering
*   **Implementation Details**:
    *   Edit `RenderSystem.ts`. Update `initialize(app, root, gameContainer, backgroundContainer, effectContainer)`.
    *   Store references to these containers.
    *   Ensure Z-Order is enforced: `Background (0)` -> `Game (10)` -> `Effects (20)`.
*   **Definition of Done**:
    *   [x] `RenderSystem` compiles without errors.
    *   [x] `GameEngine` passes the correct 3 containers to `RenderSystem`.

---

## Phase 2: High-Performance Rendering (Visual Parity is Critical)
**Goal:** Migrate 2D Canvas layers to WebGL for zero-overhead compositing.

### [ ] Task 2.1: Port Ground Layer (Wavy Floor)
*   **Implementation Details**:
    *   Create `services/systems/renderers/GroundRenderer.ts`.
    *   Use `PIXI.Graphics` to draw the floor.
    *   **CRITICAL**: Copy the *exact* sine wave math from `GroundCanvas.tsx` (`Math.sin(virtualX * 0.015) * 10...`).
    *   Implement `draw(width, height, gameTop, gameLeft, scaleFactor)`:
        *   Draw the full screen green fill.
        *   Draw the dark green stroke line on top.
    *   Hook into `RenderSystem.refreshGraphics()` or `handleResize`.
*   **Definition of Done**:
    *   [ ] The green floor looks identical to the old version.
    *   [ ] The floor wave aligns perfectly with the physics "Floor Line".
    *   [ ] No gaps at the bottom of the screen on any device ratio.
*   **Stress Test**: Open on ultra-wide and ultra-tall aspect ratios. Floor covers everything.

### [ ] Task 2.2: Port Wall Layer (Grass Decoration)
*   **Implementation Details**:
    *   Create `services/systems/renderers/WallRenderer.ts`.
    *   Use `PIXI.Graphics` to draw the grass walls.
    *   **CRITICAL**: Translate the SVG bezier curves from `WallCanvas.tsx` into `graphics.bezierCurveTo()`.
    *   Use `graphics.scale.x = -1` to mirror the left wall for the right side (optimization).
    *   Match colors (`#4CAF50`, `#1f6b23`) exactly.
*   **Definition of Done**:
    *   [ ] Walls look identically smooth (antialias enabled).
    *   [ ] Drop shadows under grass tufts are present.
    *   [ ] Walls resize correctly with height.
*   **Stress Test**: Rapidly resize height. Walls should not stretch weirdly but unroll/draw correctly.

### [ ] Task 2.3: Port Effects Layer (The 10/10 Priority)
*   **Implementation Details**:
    *   Create `services/systems/renderers/EffectRenderer.ts`.
    *   **Pre-Generation**: In `generateAllTextures`, create textures for `Star`, `Circle`, `Glow`.
    *   **Pooling**: Implement a `ParticlePool` (Array of `PIXI.Sprite`). Do not `new Sprite()` every frame!
    *   **Update Loop**: In `render(particles)`, iterate the pool.
        *   If particle active: `sprite.visible = true`, update x/y/alpha/scale.
        *   If inactive: `sprite.visible = false`.
*   **Definition of Done**:
    *   [ ] Visual particles (stars, ghosts) appear exactly where fruits merge.
    *   [ ] "Suck Up" effect (tomatoes) looks smooth.
    *   [ ] No FPS drop when 100+ particles are on screen.
*   **Stress Test**: Trigger "Fever Mode" (which creates hundreds of particles). FPS must remain > 55fps.

---

## Phase 3: Physics Engine Overhaul (Low-End Device Lock)
**Goal:** Reduce O(N^2) complexity to O(N) to run on potato phones.

### [ ] Task 3.1: Implement Spatial Hash Grid
*   **Implementation Details**:
    *   Create `services/systems/physics/SpatialHash.ts`.
    *   Grid Cell Size = Max Fruit Radius * 2 (~300px).
    *   Methods: `insert(particle)`, `query(particle) -> potentialColliders[]`.
    *   Edit `PhysicsSystem.ts`:
        *   Replace `_sortedBuffer` sorting with `spatialHash.insert()` at start of step.
        *   Replace "Sweep & Prune" loop with `spatialHash.query()`.
*   **Definition of Done**:
    *   [ ] Physics behave EXACTLY the same (stacking without jitter).
    *   [ ] No "Tunneling" (fruits passing through each other).
*   **Stress Test**: Spawn 50 fruits (God Mode). Physics time per frame (measured in chrome profiler) < 4ms.

---

## Phase 4: UI Thread Unblocking (Anti-Stutter)
**Goal:** Stop React from re-calculating layout during high-intensity moments.

### [ ] Task 4.1: Migrate Point Popups to Pixi
*   **Implementation Details**:
    *   Create `services/systems/renderers/FloatingTextRenderer.ts`.
    *   Use `PIXI.Text` or `PIXI.BitmapText` (BitmapText is preferred for performance).
    *   Style: Font "Fredoka", White Fill, Black Stroke (6px).
    *   Animation: Replicate the `animate-float-fade` CSS keyframes using manual Tween logic in `update()`.
*   **Definition of Done**:
    *   [ ] Numbers pop up exactly over the merge location.
    *   [ ] Text scaling (larger for combos) works.
    *   [ ] Text fades out smoothly.
*   **Stress Test**: Merge two watermelons (huge explosion of points). UI should not hiccup.

---

## Phase 5: Final Cleanup
**Goal:** Remove the scaffolding.

### [ ] Task 5.1: Removal & Integration
*   **Implementation Details**:
    *   Delete `GroundCanvas.tsx`, `WallCanvas.tsx`, `EffectCanvas.tsx`, `PointTicker.tsx`.
    *   Remove imports from `GameCanvas.tsx`.
    *   Verify `GameCanvas.tsx` is now just a lightweight wrapper.
*   **Definition of Done**:
    *   [ ] Project builds (`npm run build`).
    *   [ ] No unused file warnings.
    *   [ ] Bundle size check (should be smaller).

