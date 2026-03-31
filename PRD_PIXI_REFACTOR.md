# Product Requirement Document (PRD): PixiJS 100vw/vh Game Canvas Refactor

## 1. Overview and Goals
The objective is to refactor the game environment rendering from multiple layered React/HTML5 Canvas components (`GameBackground.tsx`, `CloudsCanvas.tsx`, `WallCanvas.tsx`, `GroundCanvas.tsx`, `EffectCanvas.tsx`) into a single, unified, high-performance PixiJS WebGL renderer.
The target is a constant 120 FPS on all capable devices, utilizing PixiJS performance best practices.

**Core Requirements:**
- The root PixiJS `Application` canvas must cover `100vw` and `100vh`.
- Background layers (wavy background, clouds, ground) must extend horizontally across the entire screen (`100vw`).
- The Game Area (where fruits drop, physics occur, and walls are drawn) must maintain a strict `4:5` aspect ratio.
- The HUD (React UI) will remain overlaid via HTML over the PixiJS canvas.
- No single file should exceed 300-500 lines of code. The current "god files" like `GameEngine.ts` and `GameCanvas.tsx` need to be respected and refactored incrementally.
- Zero feature degradation. The exact visual appearance must be matched, proven by before/after screenshots.

## 2. Architecture & File Structure Strategy
To maintain files under 300 lines and separate concerns, the rendering logic will be divided into modular systems under `services/systems/environment/` and `services/systems/background/`.

**New Folder Structure created:**
- `services/systems/environment/`: Contains ground, walls.
- `services/systems/background/`: Contains scrolling bg, clouds.
- `services/core/`: Potential refactors for core engine parts.

**System Architecture:**
1. **`GameEngine.ts`**: Will manage the root `PIXI.Application` (set to 100vw/vh). It will contain a `rootContainer` and a `gameAreaContainer`.
2. **`BackgroundSystem.ts`**: Manages the scrolling background pattern. Uses `PIXI.TilingSprite` spanning full width and height.
3. **`CloudSystem.ts`**: Manages cloud entities using `PIXI.Sprite` pooling, moving across the full width.
4. **`EnvironmentSystem.ts`**: Manages the `Ground` (full width) and `Walls` (constrained to game area container).
5. **`RenderSystem.ts` (Existing)**: Will focus purely on drawing fruits and the danger line within the `gameAreaContainer`.

## 3. Performance Best Practices to Follow (PixiJS)
- **Batched Rendering:** Ensure sprites use the same textures to avoid breaking batches.
- **TilingSprites:** Use `PIXI.TilingSprite` for scrolling backgrounds (e.g., `GameBackground.tsx`) instead of multiple `div` elements.
- **Object Pooling:** Clouds must be pooled, not created/destroyed every frame.
- **Graphics Caching:** Ground and Wall graphics should be drawn once and cached as textures or left as static `PIXI.Graphics` objects whose geometry does not update every frame. Do NOT clear and redraw them every tick.
- **Event System:** Set `interactive = false` and `interactiveChildren = false` on all background/environment containers.
- **Resolution/DPR:** Configure PIXI app to use device pixel ratio capped at 2 for mobile (already implemented in `GameEngine.ts`, keep it).

## 4. Current File Analysis
- **`components/GameCanvas.tsx`**: Currently positions the React canvas. This will need to be updated so the canvas spans the whole viewport, removing the `aspect-[4/5]` wrapper from the canvas itself, and putting it on the React HUD container instead.
- **`components/GameArea.tsx`**: Defines the `canvas` element size. Needs to be made `100vw/vh`.
- **`components/GameBackground.tsx`**: Uses DOM `div`s and `requestAnimationFrame` for a scrolling pattern. Needs replacement with `BackgroundSystem` (`PIXI.TilingSprite`).
- **`components/GroundCanvas.tsx`**: HTML5 Canvas drawing wavy green ground. Needs to become a `PIXI.Graphics` geometry drawn once.
- **`components/CloudsCanvas.tsx`**: HTML5 Canvas drawing clouds. Needs to become `CloudSystem`.
- **`components/WallCanvas.tsx`**: HTML5 Canvas. Needs to become part of the PixiJS `EnvironmentSystem`.

## 5. Micro-Task Execution Plan
This PRD is structured for multiple agents to collaborate.
**Rule for Agents:** You are ONLY allowed to execute the task assigned to you or the next unfinished task in the list. Do not attempt to complete the entire PRD at once. After finishing a task, document your progress and exit, leaving instructions for the next agent.

### Task 1: Bootstrapping the Full-Screen App & Game Area Container
**Objective:** Update the root `PIXI.Application` to cover `100vw/100vh` and implement a responsive `gameAreaContainer` that maintains the `4:5` aspect ratio centered on screen.
**Clearance Test (10/10):**
1. The canvas element spans the entire browser window (no scrollbars).
2. Fruits still drop and bounce correctly within a centered, `4:5` scaled area.
3. The HUD overlay correctly aligns with the scaled Game Area.
4. Resize events correctly scale and center the `gameAreaContainer`.
**Details:**
- Modify `GameEngine.ts` to attach `app.stage` directly, but create a `gameContainer` for physics/rendering.
- Modify `GameCanvas.tsx` and `GameArea.tsx` CSS to allow the canvas to span the window `fixed inset-0`.

### Task 2: Refactoring `GameBackground.tsx` to `BackgroundSystem.ts`
*(To be completed by a future agent)*
**Objective:** Implement a `PIXI.TilingSprite` based scrolling background to replace the React DOM implementation.
**Clearance Test:**
1. Background scrolls infinitely using PixiJS.
2. Fever mode speed changes work.
3. `GameBackground.tsx` is removed.

### Task 3: Refactoring `GroundCanvas.tsx` to `EnvironmentSystem.ts`
*(To be completed by a future agent)*
**Objective:** Implement the wavy ground extending 100vw in PixiJS.
**Clearance Test:**
1. Ground spans the full width of the screen.
2. Wavy geometry matches the exact physics floor offsets.
3. `GroundCanvas.tsx` is removed.

### Task 4: Refactoring `WallCanvas.tsx` to `EnvironmentSystem.ts`
*(To be completed by a future agent)*
**Objective:** Implement the walls using PixiJS Graphics within the `gameContainer`.
**Clearance Test:**
1. Walls appear on the left and right of the 4:5 Game Area.
2. `WallCanvas.tsx` is removed.

### Task 5: Refactoring `CloudsCanvas.tsx` to `CloudSystem.ts`
*(To be completed by a future agent)*
**Objective:** Implement floating clouds spanning 100vw.
**Clearance Test:**
1. Clouds float across the entire screen from left to right.
2. Object pooling is used.
3. `CloudsCanvas.tsx` is removed.

---
## Agent Handoff Log
- **[Task 1 Initiated by Jules]** Created PRD, initialized folder structure, proceeding with Task 1 execution.
- **[Task 1 Completed by Jules]** `GameEngine.ts` and UI (`GameArea.tsx`, `GameCanvas.tsx`) updated successfully. The root Pixi app covers `100vw/vh`. `rootContainer` and `gameAreaContainer` are in place. Resize observer correctly tracks and passes React bounding box size to scale `gameAreaContainer` maintaining 4:5 aspect ratio. Playwright screenshot verification passed visually confirming HTML layout.
- **[Instructions for Next Agent]** Please pick up **Task 2**. You should create `services/systems/background/BackgroundSystem.ts` and implement the `PIXI.TilingSprite` background logic there. You will need to import and integrate it into `GameEngine.ts`'s `rootContainer`, and then delete `components/GameBackground.tsx` to clear it from the React render tree entirely. Make sure to adhere to the performance tips in Section 3.
