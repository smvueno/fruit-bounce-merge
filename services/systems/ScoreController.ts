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

export interface ScoreEvent {
  type: ScoreEventType;
  payload?: any;
  timestamp: number;
}

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
  private eventQueue: ScoreEvent[] = [];
  private isProcessing: boolean = false;

  // Callbacks (View Layer Bindings)
  public onScoreChange: (totalScore: number, addedPoints: number) => void = () => {};
  public onPopupUpdate: (currentStreak: number, multiplier: number, isFever: boolean) => void = () => {};
  public onJuiceUpdate: (current: number, max: number) => void = () => {};
  public onFeverStart: (totalMultiplier: number) => void = () => {};
  public onFeverTick: (remaining: number, total: number) => void = () => {};
  public onFeverEnd: (suckedPoints: number) => void = () => {};
  public onStreakEnd: (suckedPoints: number, totalScore: number) => void = () => {};
  public onChainReset: () => void = () => {}; // Visual reset of chain counter

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
      feverMultiplier: 1, // Starts at 1x (normal), increments to 2x, 3x...
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
    this.eventQueue = [];
    this.isProcessing = false;

    // Trigger initial UI updates
    this.onScoreChange(0, 0);
    this.onJuiceUpdate(0, JUICE_MAX);
    this.onPopupUpdate(0, 1, false);
  }

  /**
   * Main game loop update for time-based logic (Fever).
   * @param dtMs Delta time in milliseconds
   */
  public update(dtMs: number) {
    if (this.state.feverActive) {
      this.state.feverTimeRemaining -= dtMs;

      this.onFeverTick(Math.max(0, this.state.feverTimeRemaining), FEVER_DURATION_MS);

      if (this.state.feverTimeRemaining <= 0) {
        this.queueEvent({ type: 'FEVER_END', timestamp: Date.now() });
      }
    }
  }

  /**
   * Enqueues an event to be processed synchronously/sequentially.
   */
  public queueEvent(event: Omit<ScoreEvent, 'timestamp'>) {
    this.eventQueue.push({
      ...event,
      timestamp: Date.now()
    });

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  // --- Event Processing ---

  private processQueue() {
    this.isProcessing = true;

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (event) {
        this.handleEvent(event);
      }
    }

    this.isProcessing = false;
  }

  private handleEvent(event: ScoreEvent) {
    switch (event.type) {
      case 'MERGE':
        this.handleMerge(event.payload);
        break;
      case 'TURN_END':
        this.handleTurnEnd(event.payload);
        break;
      case 'FEVER_START':
        this.handleFeverStart();
        break;
      case 'FEVER_END':
        this.handleFeverEnd();
        break;
      case 'CELEBRATION':
        this.handleCelebration(event.payload);
        break;
      case 'RESET':
        this.reset();
        break;
    }
  }

  // --- Handlers ---

  private handleMerge(payload: { tier: number, isWatermelon?: boolean }) {
    const { tier } = payload;

    // 1. Logic: Increment Chain (if Normal Mode)
    // In Fever Mode, chain is frozen, so we don't touch chainCount.
    if (!this.state.feverActive) {
      this.state.chainCount++;

      // Chain 1 (First Merge) -> 1x
      // Chain 2 (Second Merge) -> 2x
      // Chain 3 -> 3x...
      // Chain 10+ -> 10x
      if (this.state.chainCount <= 1) {
        this.state.chainMultiplier = 1;
      } else {
        this.state.chainMultiplier = Math.min(10, this.state.chainCount);
      }
    }

    // 2. Calculation: Get Points
    const points = this.calculateMergePoints(tier);

    // 3. Mutation: Update Scores
    this.applyScore(points);

    // 4. Side Effects: Update Fever Meter (Juice)
    if (!this.state.feverActive) {
      // Add juice (e.g. 50 per merge)
      // Old code: this.juice = Math.min(JUICE_MAX, this.juice + 50);
      this.state.feverMeter = Math.min(JUICE_MAX, this.state.feverMeter + 50);
      this.onJuiceUpdate(this.state.feverMeter, JUICE_MAX);

      // Check for Fever Trigger
      if (this.state.feverMeter >= JUICE_MAX) {
        this.queueEvent({ type: 'FEVER_START', timestamp: Date.now() });
      }
    }

    // 5. UI Updates
    // Update the "Streak/Accumulator" popup
    // Only show if multiplier > 1 or in Fever
    const activeMult = this.getActiveMultiplier();

    if (this.state.feverActive || this.state.chainCount >= 2) {
        this.onPopupUpdate(this.state.sessionAccumulator, activeMult, this.state.feverActive);
    }
  }

  private handleTurnEnd(payload: { didMerge: boolean }) {
    // If we are in Fever, turns don't matter for chaining.
    if (this.state.feverActive) return;

    // If no merge happened this turn, the chain breaks.
    if (!payload.didMerge) {
      // Exception: If Fever is about to start (Meter Full), preserve chain for Fever.
      if (this.state.feverMeter >= JUICE_MAX) {
        return;
      }

      this.endNormalChain();
    }
  }

  private handleFeverStart() {
    if (this.state.feverActive) return;

    // 1. Snapshot Chain State
    // "Fever uses frozen chain + fever bonus"
    this.state.frozenChainMultiplier = this.state.chainMultiplier;

    // 2. Stash Normal Session Accumulator (Streak Score)
    // So we can restore it later.
    this.state.stashedSessionAccumulator = this.state.sessionAccumulator;
    this.state.sessionAccumulator = 0; // Reset for Fever Round

    // 3. Increment Fever Round
    this.state.feverRoundCount++;
    // "Fever multiplier increments globally"
    // "5x * 2x = 10x" implies the fever multiplier is the round count (or close to it).
    // Let's assume it increments per round.
    this.state.feverMultiplier++;

    // 4. Activate Fever
    this.state.feverActive = true;
    this.state.feverTimeRemaining = FEVER_DURATION_MS;

    // 5. Notify UI
    const totalMult = this.getActiveMultiplier();
    this.onFeverStart(totalMult);
    // Show Fever Popup (Starting at 0, with new Total Multiplier)
    this.onPopupUpdate(0, totalMult, true);
  }

  private handleFeverEnd() {
    if (!this.state.feverActive) return;

    // 1. Suck up Fever Points
    const pointsToSuck = this.state.sessionAccumulator;
    this.onFeverEnd(pointsToSuck); // Legacy/Audio triggers
    this.onStreakEnd(pointsToSuck, this.state.totalScore); // Visual suck up

    // 2. Reset Fever State
    this.state.feverActive = false;
    this.state.feverMeter = 0; // Reset Juice
    this.state.sessionAccumulator = 0; // Clear accumulator
    this.state.feverTimeRemaining = 0;

    // 3. Restore Normal Chain & Stashed Accumulator
    if (this.state.stashedSessionAccumulator !== null) {
        this.state.sessionAccumulator = this.state.stashedSessionAccumulator;
        this.state.stashedSessionAccumulator = null;
    }

    // Update Juice UI
    this.onJuiceUpdate(0, JUICE_MAX);

    // 4. Update UI for return to normal
    // "Restored upon exiting Fever to allow the player to continue their previous chain."
    // We show the old multiplier and the old accumulator.
    const restoredMult = this.state.chainMultiplier;
    this.onPopupUpdate(this.state.sessionAccumulator, restoredMult, false);

    // Since we restored the session accumulator, we do NOT reset the chain.
    // The player can continue from here.
  }

  private handleCelebration(payload: { points: number }) {
    // Celebrations (Watermelon Crush) are direct point injections.
    // "Points from Celebrations... always multiplied by the current active multiplier"

    const mult = this.getActiveMultiplier();
    const total = Math.floor(payload.points * mult);

    this.applyScore(total);

    // Celebration effect typically has its own popup logic (Watermelon Crush).
    // We treat it as adding to the current session accumulator.
    this.onPopupUpdate(this.state.sessionAccumulator, mult, this.state.feverActive);
  }

  private endNormalChain() {
    if (this.state.sessionAccumulator > 0) {
      // Suck up the accumulated streak points
      this.onStreakEnd(this.state.sessionAccumulator, this.state.totalScore);
    }

    // Reset Chain State
    this.state.chainCount = 0;
    this.state.chainMultiplier = 1;
    this.state.sessionAccumulator = 0;

    this.onChainReset();
    this.onPopupUpdate(0, 1, false);
  }

  // --- Pure Calculations ---

  private calculateMergePoints(tier: number): number {
    // Base Points * 2^tier * ActiveMultiplier
    const base = SCORE_BASE_MERGE * Math.pow(2, tier);
    const mult = this.getActiveMultiplier();
    return Math.floor(base * mult);
  }

  public getActiveMultiplier(): number {
    if (this.state.feverActive) {
      // Logic: Frozen Chain * Fever Round Multiplier
      // Example: 5x (Chain) * 2x (Fever) = 10x
      const frozen = this.state.frozenChainMultiplier || 1;
      return frozen * this.state.feverMultiplier;
    }
    return this.state.chainMultiplier;
  }

  // --- Core Mutation ---

  private applyScore(amount: number) {
    this.state.totalScore += amount;
    this.state.sessionAccumulator += amount;
    this.onScoreChange(this.state.totalScore, amount);
  }

  // --- Getters for UI/Debug ---
  public getScore() { return this.state.totalScore; }
  public getChainCount() { return this.state.chainCount; }
  public isFever() { return this.state.feverActive; }
  public getFeverMeter() { return this.state.feverMeter; }
  public getMultiplier() { return this.getActiveMultiplier(); }
}
