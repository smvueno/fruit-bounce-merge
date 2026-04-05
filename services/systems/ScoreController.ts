import { SCORE_BASE_MERGE, FEVER_DURATION_MS, JUICE_MAX } from '../../constants';

// --- Types ---

export type ScoreEventType =
  | 'MERGE'
  | 'TURN_END'
  | 'FEVER_START'
  | 'FEVER_TICK'
  | 'FEVER_END'
  | 'CELEBRATION'
  | 'RESET';

export interface ScoreState {
  // Real score (instant, hidden bank)
  totalScore: number;

  // Chain State (Normal Mode)
  chainCount: number;           // 0-10
  chainMultiplier: number;      // 1x-10x

  // Fever State
  feverMeter: number;           // 0-JUICE_MAX
  feverActive: boolean;
  feverMultiplier: number;      // Persistent across game (1x, 2x, 3x...)
  feverTimeRemaining: number;   // ms
  feverRoundCount: number;      // Increments on enter

  // Snapshots for Fever
  frozenChainMultiplier: number | null;
  stashedSessionAccumulator: number | null; // Stores Normal Streak during Fever

  // Session Accumulator (The "Streak" Score)
  // In Normal Mode: Points from current chain, waiting to be sucked up on miss.
  // In Fever Mode: Points from the entire fever round, sucked up at end.
  sessionAccumulator: number;
}

// --- Controller ---

export class ScoreController {
  private state: ScoreState;

  // Callbacks (View Layer Bindings)
  public onScoreChange: (totalScore: number, addedPoints: number) => void = () => { };
  public onPopupUpdate: (currentStreak: number, multiplier: number, isFever: boolean) => void = () => { };
  public onJuiceUpdate: (current: number, max: number) => void = () => { };
  public onFeverStart: (totalMultiplier: number) => void = () => { };
  public onFeverTick: (remaining: number, total: number) => void = () => { };
  public onFeverEnd: (suckedPoints: number) => void = () => { };
  public onStreakEnd: (suckedPoints: number, totalScore: number) => void = () => { };
  public onChainReset: () => void = () => { }; // Visual reset of chain counter

  // --- Performance: Batched UI updates to prevent React thrashing ---
  // Instead of firing callbacks on every merge (which triggers React re-renders),
  // we accumulate pending updates and flush them once per animation frame.
  private _pendingScoreUpdate = false;
  private _pendingPopupUpdate = false;
  private _pendingJuiceUpdate = false;
  private _lastScoreTotal = 0;
  private _lastScoreAdded = 0;
  private _lastPopupStreak = 0;
  private _lastPopupMult = 0;
  private _lastPopupFever = false;
  private _lastJuiceCurrent = 0;

  constructor() {
    this.state = this.getInitialState();
  }

  private getInitialState(): ScoreState {
    return {
      totalScore: 0,
      chainCount: 0,
      chainMultiplier: 1,
      feverMeter: 0,
      feverActive: false,
      feverMultiplier: 1,
      feverTimeRemaining: 0,
      feverRoundCount: 0,
      frozenChainMultiplier: null,
      stashedSessionAccumulator: null,
      sessionAccumulator: 0
    };
  }

  // --- Public API ---

  /**
   * Resets the entire scoring system (New Game).
   */
  public reset() {
    this.state = this.getInitialState();
    this._pendingScoreUpdate = false;
    this._pendingPopupUpdate = false;
    this._pendingJuiceUpdate = false;

    // Trigger initial UI updates
    this.onScoreChange(0, 0);
    this.onJuiceUpdate(0, JUICE_MAX);
  }

  /**
   * Flush all pending UI updates. Call this once per game frame.
   * This batches multiple merge callbacks into a single React update.
   */
  public flushUpdates() {
    if (this._pendingScoreUpdate) {
      this._pendingScoreUpdate = false;
      this.onScoreChange(this._lastScoreTotal, this._lastScoreAdded);
    }
    if (this._pendingPopupUpdate) {
      this._pendingPopupUpdate = false;
      this.onPopupUpdate(this._lastPopupStreak, this._lastPopupMult, this._lastPopupFever);
    }
    if (this._pendingJuiceUpdate) {
      this._pendingJuiceUpdate = false;
      this.onJuiceUpdate(this._lastJuiceCurrent, JUICE_MAX);
    }
  }

  /**
   * Main game loop update for time-based logic (Fever).
   * @param dtMs Delta time in milliseconds
   */
  public update(dtMs: number) {
    if (this.state.feverActive) {
      this.state.feverTimeRemaining -= dtMs;

      // Throttle fever tick to ~10 Hz (every 100ms) instead of every frame
      // This reduces React updates during fever mode
      if (!this._pendingFeverTick || this._lastFeverTickTime === 0 || (this._lastFeverTickTime - dtMs) <= 0) {
        this._lastFeverTickTime = 100;
        this.onFeverTick(Math.max(0, this.state.feverTimeRemaining), FEVER_DURATION_MS);
      } else {
        this._lastFeverTickTime -= dtMs;
      }

      if (this.state.feverTimeRemaining <= 0) {
        this.handleFeverEnd();
      }
    }
  }

  private _lastFeverTickTime = 0;
  private _pendingFeverTick = false;

  // --- Handlers ---

  public handleMerge(payload: { tier: number, isWatermelon?: boolean }): number {
    const { tier } = payload;

    // 1. Logic: Increment Chain (if Normal Mode)
    if (!this.state.feverActive) {
      this.state.chainCount++;
      if (this.state.chainCount <= 1) {
        this.state.chainMultiplier = 1;
      } else {
        this.state.chainMultiplier = Math.min(10, this.state.chainCount);
      }
    }

    // 2. Calculation: Get Points
    const points = this.calculateMergePoints(tier);

    // 3. Mutation: Update Scores (batched)
    this.applyScore(points);

    // 4. Side Effects: Update Fever Meter (Juice) (batched)
    if (!this.state.feverActive) {
      this.state.feverMeter = Math.min(JUICE_MAX, this.state.feverMeter + 50);
      this._queueJuiceUpdate(this.state.feverMeter);

      // Check for Fever Trigger
      if (this.state.feverMeter >= JUICE_MAX) {
        this.handleFeverStart();
      }
    }

    // 5. UI Updates (batched popup)
    const activeMult = this.getActiveMultiplier();
    if (this.state.feverActive || this.state.chainCount >= 2) {
      this._queuePopupUpdate(this.state.sessionAccumulator, activeMult, this.state.feverActive);
    }

    return points;
  }

  public handleTurnEnd(payload: { didMerge: boolean }) {
    if (this.state.feverActive) return;

    if (!payload.didMerge) {
      if (this.state.feverMeter >= JUICE_MAX) {
        return;
      }
      this.endNormalChain();
    }
  }

  public handleFeverStart() {
    if (this.state.feverActive) return;

    this.state.frozenChainMultiplier = this.state.chainMultiplier;
    this.state.stashedSessionAccumulator = this.state.sessionAccumulator;
    this.state.sessionAccumulator = 0;
    this.state.feverRoundCount++;
    this.state.feverMultiplier++;
    this.state.feverActive = true;
    this.state.feverTimeRemaining = FEVER_DURATION_MS;

    const totalMult = this.getActiveMultiplier();
    this.onFeverStart(totalMult);
    this._queuePopupUpdate(0, totalMult, true);
  }

  public handleFeverEnd() {
    if (!this.state.feverActive) return;

    const pointsToSuck = this.state.sessionAccumulator;
    this.onFeverEnd(pointsToSuck);
    this.onStreakEnd(pointsToSuck, this.state.totalScore);

    this.state.feverActive = false;
    this.state.feverMeter = 0;
    this.state.sessionAccumulator = 0;
    this.state.feverTimeRemaining = 0;

    if (this.state.stashedSessionAccumulator !== null) {
      this.state.sessionAccumulator = this.state.stashedSessionAccumulator;
      this.state.stashedSessionAccumulator = null;
    }

    this._queueJuiceUpdate(0);

    const restoredMult = this.state.chainMultiplier;
    this._queuePopupUpdate(this.state.sessionAccumulator, restoredMult, false);
  }

  public handleCelebration(payload: { points: number }) {
    const mult = this.getActiveMultiplier();
    const total = Math.floor(payload.points * mult);

    this.applyScore(total);
    this._queuePopupUpdate(this.state.sessionAccumulator, mult, this.state.feverActive);
  }

  private endNormalChain() {
    if (this.state.sessionAccumulator > 0) {
      this.onStreakEnd(this.state.sessionAccumulator, this.state.totalScore);
    }

    this.state.chainCount = 0;
    this.state.chainMultiplier = 1;
    this.state.sessionAccumulator = 0;

    this.onChainReset();
  }

  // --- Pure Calculations ---

  private calculateMergePoints(tier: number): number {
    const base = SCORE_BASE_MERGE * Math.pow(2, tier);
    const mult = this.getActiveMultiplier();
    return Math.floor(base * mult);
  }

  public getActiveMultiplier(): number {
    if (this.state.feverActive) {
      const frozen = this.state.frozenChainMultiplier || 1;
      return frozen * this.state.feverMultiplier;
    }
    return this.state.chainMultiplier;
  }

  // --- Core Mutation (Batched) ---

  private applyScore(amount: number) {
    this.state.totalScore += amount;
    this.state.sessionAccumulator += amount;
    // Queue instead of immediate callback
    this._queueScoreUpdate(this.state.totalScore, amount);
  }

  // --- Batched UI Update Queues ---
  // These accumulate updates and only fire the latest value when flushUpdates() is called.
  // This prevents React from re-rendering multiple times per frame during merge chains.

  private _queueScoreUpdate(total: number, added: number) {
    this._lastScoreTotal = total;
    this._lastScoreAdded = added;
    this._pendingScoreUpdate = true;
  }

  private _queuePopupUpdate(streak: number, mult: number, fever: boolean) {
    this._lastPopupStreak = streak;
    this._lastPopupMult = mult;
    this._lastPopupFever = fever;
    this._pendingPopupUpdate = true;
  }

  private _queueJuiceUpdate(current: number) {
    this._lastJuiceCurrent = current;
    this._pendingJuiceUpdate = true;
  }

  // --- Getters for UI/Debug ---
  public getScore() { return this.state.totalScore; }
  public getChainCount() { return this.state.chainCount; }
  public isFever() { return this.state.feverActive; }
  public getFeverMeter() { return this.state.feverMeter; }
  public getMultiplier() { return this.getActiveMultiplier(); }
}
