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

### [ ] Task 1.3: Tune Resize Logic (Maximize Gameplay Area)
*   **Implementation Details**:
    *   Update `GameEngine.handleResize`:
    *   **Rule**: `rootContainer` and Backgrounds always fill 100% of window.
    *   **Rule**: `gameContainer` (Gameplay Area) maintains 4:5 aspect ratio.
    *   **Rule**: Scaling should maximize the `gameContainer` size within the window, but leave small margins (approx 1/3 of wall width visible on sides for "breathing room" on narrow screens).
    *   Remove arbitrary `actualW / 1.4` throttle.
*   **Definition of Done**:
    *   [ ] Mobile Portrait: Game fills width/height, walls partially visible.
    *   [ ] Desktop: Game maximizes vertically, walls visible, infinite ground extends.
    *   [ ] No clipping of the game board.

---

## Phase 2: High-Performance Rendering (Visual Parity is Critical)
**Goal:** Migrate 2D Canvas layers to WebGL for zero-overhead compositing.

### [x] Task 2.1: Port Ground Layer (Wavy Floor)
> [!NOTE] 
> **Context for Next Agent:**
> - The `GameEngine.ts` and `RenderSystem.ts` have been refactored (Task 1).
> - `RenderSystem` now holds references to `backgroundContainer`, `gameContainer`, and `effectContainer`.
> - **For Task 2.1**: You should implement the `GroundRenderer` and attach it to the `backgroundContainer`.
> - **Visual Parity**: You must look at `components/GroundCanvas.tsx` to get the exact sine wave parameters. The goal is to make the Pixi version look *identical* to the React version.
> - **Files to Create**: `services/systems/renderers/GroundRenderer.ts`.
> - **Integration**: Initialize this renderer inside `RenderSystem.ts` and call it in the render loop/resize handler.

*   **Implementation Details**:
    *   Create `services/systems/renderers/GroundRenderer.ts`.
    *   Use `PIXI.Graphics` to draw the floor.
    *   **CRITICAL**: Copy the *exact* sine wave math from `GroundCanvas.tsx` (`Math.sin(virtualX * 0.015) * 10...`).
    *   Implement `draw(width, height, gameTop, gameLeft, scaleFactor)`:
        *   Draw the full screen green fill.
        *   Draw the dark green stroke line on top.
    *   Hook into `RenderSystem.refreshGraphics()` or `handleResize`.
*   **Definition of Done**:
    *   [x] The green floor looks identical to the old version.
    *   [x] The floor wave aligns perfectly with the physics "Floor Line".
    *   [x] No gaps at the bottom of the screen on any device ratio.
*   **Stress Test**: Open on ultra-wide and ultra-tall aspect ratios. Floor covers everything.

### [x] Task 2.2: Port Wall Layer (Grass Decoration)
> [!NOTE]
> **Context for Next Agent:**
> - Reference `components/WallCanvas.tsx`.
> - **Decision**: Put Walls in `backgroundContainer` (Layer 0), drawn *after* the Ground.
> - **Visuals**: Bezier curves are critical. `graphics.bezierCurveTo` is your friend.

*   **Implementation Details**:
    *   Create `services/systems/renderers/WallRenderer.ts`.
    *   Use `PIXI.Graphics` to draw the grass walls.
    *   **CRITICAL**: Translate the SVG bezier curves from `WallCanvas.tsx` into `graphics.bezierCurveTo()`.
    *   Use `graphics.scale.x = -1` to mirror the left wall for the right side (optimization).
    *   Match colors (`#4CAF50`, `#1f6b23`) exactly.
*   **Definition of Done**:
    *   [x] Walls look identically smooth (antialias enabled).
    *   [x] Drop shadows under grass tufts are present.
    *   [x] Walls resize correctly with height.
*   **Stress Test**: Rapidly resize height. Walls should not stretch weirdly but unroll/draw correctly.

### [x] Task 2.3: Port Effects Layer (The 10/10 Priority)
> [!NOTE]
> **Context for Next Agent:**
> - This is the most performance-critical part.
> - **Pooling**: The task requires a `ParticlePool`. This implies avoiding `new Particle()` or `new Sprite()` during gameplay.
> - **Textures**: Generate them in `RenderSystem.generateAllTextures` alongside fruits.

*   **Implementation Details**:
    *   Create `services/systems/renderers/EffectRenderer.ts`.
    *   **Pre-Generation**: In `generateAllTextures`, create textures for `Star`, `Circle`, `Glow`.
    *   **Pooling**: Implement a `ParticlePool` (Array of `PIXI.Sprite`). Do not `new Sprite()` every frame!
    *   **Update Loop**: In `render(particles)`, iterate the pool.
        *   If particle active: `sprite.visible = true`, update x/y/alpha/scale.
        *   If inactive: `sprite.visible = false`.
*   **Definition of Done**:
    *   [x] Visual particles (stars, ghosts) appear exactly where fruits merge.
    *   [x] "Suck Up" effect (tomatoes) looks smooth.
    *   [x] No FPS drop when 100+ particles are on screen.
*   **Stress Test**: Trigger "Fever Mode" (which creates hundreds of particles). FPS must remain > 55fps.

---

## Phase 3: Physics Engine Overhaul (Low-End Device Lock)
**Goal:** Reduce O(N^2) complexity to O(N) to run on potato phones.

### [x] Task 3.1: Implement Spatial Hash Grid
*   **Implementation Details**:
    *   Create `services/systems/physics/SpatialHash.ts`.
    *   Grid Cell Size = Max Fruit Radius * 2 (~300px).
    *   Methods: `insert(particle)`, `query(particle) -> potentialColliders[]`.
    *   Edit `PhysicsSystem.ts`:
        *   Replace `_sortedBuffer` sorting with `spatialHash.insert()` at start of step.
        *   Replace "Sweep and Prune" loop with `spatialHash.query()`.
*   **Definition of Done**:
    *   [x] Physics behave EXACTLY the same (stacking without jitter).
    *   [x] No "Tunneling" (fruits passing through each other).
*   **Stress Test**: Spawn 50 fruits (God Mode). Physics time per frame (measured in chrome profiler) < 4ms.

---

## Phase 4: UI Thread Unblocking (Full UI Migration)
**Goal:** Stop React from re-calculating layout. Move EVERYTHING except Menus to Pixi.

> [!NOTE]
> **Context from Task 3 Agent:**
> - **Physics is solved**: Spatial Hash Grid is implemented and verified (0.325ms/frame). Physics is no longer a bottleneck.
> - **Current Bottleneck**: The React UI overlay (Score, Popups, Next Fruit) causes heavy composite layer repaints.
> - **Recommendation**: For Task 4.1 & 4.2, ensure you completely detach the React components (`PointTicker`, `GameHUD`) from the high-frequency game loop. The `ScoreController` should talk directly to your new `HUDRenderer` without triggering `setState`.
> - **Benchmark**: You can use `window.runPhysicsBenchmark()` to verify physics stability if you touch `PhysicsSystem`.

### [x] Task 4.1: Migrate Point Popups to Pixi
*   **Implementation Details**:
    *   Create `services/systems/renderers/FloatingTextRenderer.ts`.
    *   Use `PIXI.Text` or `PIXI.BitmapText` (BitmapText is preferred for performance).
    *   Style: Font "Fredoka", White Fill, Black Stroke (6px).
    *   Animation: Replicate the `animate-float-fade` CSS keyframes using manual Tween logic in `update()`.
*   **Definition of Done**:
    *   [x] Numbers pop up exactly over the merge location.
    *   [x] Text scaling (larger for combos) works.
    *   [x] Text fades out smoothly.
*   **Stress Test**: Merge two watermelons (huge explosion of points). UI should not hiccup.

### [x] Task 4.2: Migrate HUD (Score, Next, Hold)
*   **Implementation Details**:
    *   Create `services/systems/renderers/HUDRenderer.ts`.
    *   Render Score, Best Score, Next Fruit Bubble, and Saved Fruit Bubble using Pixi.
    *   Remove `GameHUD.tsx` and `PointTicker.tsx`.
*   **Definition of Done**:
    *   [x] Score updates instantly (no React lag).
    *   [x] Next/Saved fruits render correct textures.

### [x] Task 4.3: Migrate Overlays (Danger, Juice)
*   **Implementation Details**:
    *   Move `JuiceOverlay` logic to `RenderSystem`.
    *   Move `DangerOverlay` vignetting/red flash to `RenderSystem` (Pixi Graphics/Sprite).
*   **Definition of Done**:
    *   [x] Juice level visuals work in Pixi.
    *   [x] Danger red pulse works in Pixi.

---

## Phase 5: Final Cleanup
**Goal:** Remove the scaffolding.

### [ ] Task 5.1: Removal & Integration
*   **Implementation Details**:
    *   [x] Delete `GroundCanvas.tsx`, `WallCanvas.tsx`, `EffectCanvas.tsx`, `PointTicker.tsx`. (Removed from GameCanvas, files still exist for reference).
    *   [x] Remove imports from `GameCanvas.tsx`.
    *   [ ] Implement Fullscreen Toggle Button in Settings Menu.
    *   Verify `GameCanvas.tsx` is now just a lightweight wrapper.
*   **Definition of Done**:
    *   [ ] Project builds (`npm run build`).
    *   [ ] No unused file warnings.
    *   [ ] Bundle size check (should be smaller).

