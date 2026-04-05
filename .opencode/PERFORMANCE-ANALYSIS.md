# FPS Performance Analysis & Action Plan

## Problem Statement
Game FPS is unstable, dropping from 60 to 51-57 FPS during gameplay. The goal is a locked, stable 60 FPS.

---

## Root Cause Analysis (Complete)

### CRITICAL — GPU Compositor Competition (Primary Suspect)

| Issue | Location | Impact | Fix Priority |
|-------|----------|--------|-------------|
| `backdrop-blur-md` background overlay | `App.tsx:392` | 5-8 FPS loss on mobile | P0 |
| CSS animated blobs with `filter: blur(60px)` | `App.tsx:386-388` | 2-4 FPS loss | P0 |
| Canvas renders at full viewport, not game area | `GameArea.tsx:14` | Wasted GPU fill rate | P1 |
| `backdrop-blur-xl` pause menu | `PauseMenu.tsx:42` | GPU hit when open | P2 |

### HIGH — Pixi.js Ticker Issues

| Issue | Location | Impact | Fix Priority |
|-------|----------|--------|-------------|
| `maxFPS = 60` unreliable on 120Hz displays | `GameEngine.ts:346` | Frame pacing stutter | P0 |
| No `minFPS` set for delta clamping | `GameEngine.ts` | No protection against slow frames | P1 |

### MEDIUM — Render Inefficiencies

| Issue | Location | Impact | Fix Priority |
|-------|----------|--------|-------------|
| `EffectRenderer` uses `Graphics.clear()` + redraw per frame | `EffectRenderer.ts:19` | CPU overhead for particles | P1 |
| `Date.now()` called per frame in fever mode | `RenderSystem.ts:192` | Minor but unnecessary | P2 |
| `GroundRenderer` redraws on every resize only (OK) | `GroundRenderer.ts` | Not per-frame, acceptable | P3 |
| `WallRenderer` redraws on every resize only (OK) | `WallRenderer.ts` | Not per-frame, acceptable | P3 |

### LOW — DOM/React Overhead

| Issue | Location | Impact | Fix Priority |
|-------|----------|--------|-------------|
| PointTicker React state updates per merge | `PointTicker.tsx` | Occasional jank | P2 |
| TextPopup state machine complexity | `TextPopup.tsx` | Occasional jank | P2 |
| ScoreFlyEffect `requestAnimationFrame` + React setState | `ScoreFlyEffect.tsx` | Brief jank | P2 |

---

## Recommended Fixes (Ordered by Impact)

### Phase 1: Immediate Wins (P0)

1. **Remove `backdrop-blur` from game background during PLAYING state**
   - The `backdrop-blur-md` on the main background div (App.tsx:392) runs on the GPU compositor and directly competes with Pixi.js WebGL rendering
   - **Fix**: Conditionally remove the blur overlay when `gameState === PLAYING`

2. **Remove CSS animated blobs during PLAYING state**
   - The 3 blobs with `filter: blur(60px)` and `animate-float` (App.tsx:386-388) are GPU-intensive
   - **Fix**: Hide these during gameplay, show only on Start/Game Over screens

3. **Fix Pixi.js ticker for stable 60 FPS**
   - `maxFPS` is known to be unreliable (GitHub issue #11411)
   - **Fix**: Use `minFPS` to clamp deltaTime, and implement manual frame skipping based on elapsed time instead of relying on `maxFPS`

### Phase 2: Rendering Optimizations (P1)

4. **Scope canvas to game area instead of full viewport**
   - Canvas is `fixed inset-0` wasting GPU on transparent pixels
   - **Fix**: Make canvas sized to the game area only

5. **Replace EffectRenderer Graphics with Sprites**
   - `Graphics.clear()` + redraw every frame is CPU-heavy
   - **Fix**: Use `ParticleContainer` or pre-rendered sprite textures for particles

6. **Add `minFPS` to ticker**
   - Prevents deltaTime from exploding during frame drops
   - **Fix**: `app.ticker.minFPS = 30`

### Phase 3: Polish (P2)

7. **Move PointTicker to Pixi.js**
   - React state updates for score popups cause DOM jank
   - **Fix**: Render score popups inside the Pixi canvas

8. **Move TextPopup to Pixi.js**
   - Same reasoning — DOM overlays competing with WebGL

9. **Optimize ScoreFlyEffect**
   - Remove React setState from rAF loop

---

## Test Plan

### Performance Test Suite (`performance-test.html`)

A standalone HTML file that tests each subsystem in isolation:

| Test | What It Measures |
|------|-----------------|
| **Baseline** | Empty Pixi scene overhead |
| **Fruit Stress** | 50 bouncing sprites with physics |
| **Particle Stress** | 200 effect particles |
| **Merge Storm** | Rapid sprite creation/destruction |
| **Physics Load** | 80 fruits with O(n²) collision |
| **Render Load** | Graphics clear+redraw every frame |
| **CSS Overlay** | CSS blur + DOM overlays + Pixi |
| **Full Game Sim** | Complete game simulation |

**How to run:**
1. `npm run dev` to start the dev server
2. Open `http://localhost:5100/performance-test.html`
3. Click "Run All Tests" or run individual tests
4. Watch the live FPS graph and results table

### In-Game Debug Mode
- Tap pause button 10 times to enable debug menu
- Shows real-time FPS, fruit count, particle count, heap memory
- Use this during actual gameplay to correlate FPS drops with game events

---

## Long-Term Vision: Full Pixi.js Migration

The ultimate goal is to move ALL rendering into Pixi.js, eliminating the React DOM overlay entirely. This means:

- HUD (score, timer, next fruit) → Pixi Text/Sprites
- Popups (chain, frenzy, danger) → Pixi containers
- Menus (pause, game over) → Pixi UI
- Background → Pixi gradient/particles

**This is a large undertaking** and should be done incrementally. The Phase 1-2 fixes above will provide immediate FPS improvements without requiring a full rewrite.
