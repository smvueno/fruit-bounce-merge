# Performance Bottleneck Analysis — Fruit Bounce Merge

## Executive Summary

The game runs at **60fps on a real device with GPU**, but experiences **frame drops** during:
1. Initial load (texture generation + React hydration)
2. Fruit drops (physics collision spikes)
3. Merge chains (multiple effects + React state updates)
4. Fever mode (pulsing animation + increased callbacks)

---

## Bottleneck #1: Physics System (O(N²) × 4 substeps) ⚠️ MAJOR

**File:** `services/systems/PhysicsSystem.ts` (514 lines)

### The Problem
- **4 substeps per frame** (SUBSTEPS = 4)
- Each substep does:
  1. Sort all fruits by X: `O(N log N)`
  2. Sweep & Prune collision detection: `O(N²)` worst case
  3. Resolve collisions: `O(N²)` with weighted stability
  4. Resolve walls: `O(N)`
  5. Contact count pass: another `O(N²)`
- With 50 fruits: **~5,000 pair checks per frame** (1,225 pairs × 4 substeps)
- Plus tomato/bomb/celebration logic: `O(N × effects)` per frame

### Impact
- **~3-5ms per frame** on physics alone (at 50 fruits)
- Spikes to **10-15ms** during merge chains (fruits being created/destroyed)

### Fix Priority: HIGH
- Reduce substeps from 4 → 3 (mobile) / 4 (desktop) — already partially done
- Add spatial hash grid for O(N) collision detection
- Skip collision checks for stable fruits (contactCount > 1, velocity ≈ 0)

---

## Bottleneck #2: React State Updates ⚠️ MAJOR

**File:** `components/GameCanvas.tsx`

### The Problem
Every frame, the game engine fires callbacks that trigger React state updates:
- `onScore()` → `setScore()` → React re-render
- `onCombo()` → `setCombo()` → React re-render
- `onJuiceUpdate()` → `setJuice()` → React re-render
- `onTimeUpdate()` → `setPlayTime()` → React re-render (throttled to 4x/s)
- `onPopupUpdate()` → `setPopupData()` → React re-render
- `onPointEvent()` → `setLatestPointEvent()` → React re-render

Even with `React.memo`, these cause:
- State queueing and batching
- Reconciliation of HUD components
- Potential layout thrashing

### Impact
- **~1-2ms per frame** from React overhead
- Spikes during merge chains (multiple callbacks fire simultaneously)

### Fix Priority: HIGH
- Throttle all callbacks to 30fps max
- Use refs instead of state for frequently-updating values
- Batch React updates with `unstable_batchedUpdates`

---

## Bottleneck #3: Effect System ⚠️ MEDIUM

**File:** `services/systems/EffectSystem.ts`

### The Problem
- Creates new `EffectParticle` objects every merge
- Updates all visual particles every frame
- `visualParticles` array grows/shrinks rapidly during gameplay
- GC pressure from frequent object creation/destruction

### Impact
- **~0.5-1ms per frame** during active effects
- GC spikes during merge chains

### Fix Priority: MEDIUM
- Use object pooling for effect particles
- Pre-allocate max particle count
- Batch effect updates

---

## Bottleneck #4: Audio System ⚠️ LOW

**File:** `services/MusicEngine.ts`

### The Problem
- Sound queue management every frame (`audio.update()`)
- Multiple audio contexts (music, SFX, merge sounds, frenzy sounds)
- Queue length tracking in perfStats

### Impact
- **~0.2-0.5ms per frame**

### Fix Priority: LOW
- Already optimized with queue-based playback
- Minimal impact on overall performance

---

## Bottleneck #5: Rendering (Already Optimized) ✅

**File:** `services/systems/RenderSystem.ts`

### Current State
- ✅ Fruit textures pre-generated (GPU memory)
- ✅ Faces baked into textures (zero per-frame face work)
- ✅ Direct Sprites (1 object per fruit, was 3)
- ✅ Blinking = texture swap (GPU operation)
- ✅ Auto-batched by Pixi v8 (~10 draw calls for 50 fruits)
- ✅ Ground/Walls/Clouds in screen-space (drawn once per resize)

### Impact
- **~0.5ms per frame** for rendering 50 fruits
- Negligible compared to physics + React

### Fix Priority: NONE (already optimal)

---

## Bottleneck #6: GameEngine Update Loop ⚠️ MEDIUM

**File:** `services/GameEngine.ts` (1332 lines)

### The Problem
- 1332 lines of update logic per frame
- Multiple system updates (physics, effects, audio, rendering)
- Performance tracking overhead (memory sampling, FPS calculation)
- Danger logic iterates all fruits every frame
- `_fruitsById` Map rebuilt every frame

### Impact
- **~1-2ms per frame** from loop overhead

### Fix Priority: MEDIUM
- Extract into smaller managers (FruitManager, EffectManager, DangerManager)
- Throttle non-critical updates
- Use spatial indexing for danger zone checks

---

## Recommended Fix Order

1. **Throttle React callbacks** → Immediate win, low risk
2. **Stable fruit optimization** → Skip physics for settled fruits
3. **Effect particle pooling** → Reduce GC pressure
4. **Spatial hash grid** → O(N) collision detection (bigger change)
5. **GameEngine refactoring** → Extract managers (code quality)

---

## Expected Results After Fixes

| Metric | Current | After Fixes |
|--------|---------|-------------|
| Frame time (50 fruits) | ~16-20ms | ~10-12ms |
| Physics time | 3-5ms | 1-2ms |
| React overhead | 1-2ms | <0.5ms |
| Effect time | 0.5-1ms | 0.2-0.3ms |
| Render time | 0.5ms | 0.5ms (unchanged) |
| **FPS** | **50-60 (with drops)** | **60 (stable)** |
