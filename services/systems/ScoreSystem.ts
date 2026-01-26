import { SCORE_BASE_MERGE } from '../../constants';

export class ScoreSystem {
    // Persistent Global Score (Safe Bank)
    private _totalRealScore: number = 0;

    // Normal Mode State
    private _normalStreakScore: number = 0;
    private _normalChainCount: number = 0;

    // Fever Mode State
    private _feverStreakScore: number = 0;
    private _feverMultiplier: number = 1;
    private _isFeverActive: boolean = false;
    private _feverRoundCount: number = 0; // Starts at 0, increments on enter

    constructor() {}

    get totalRealScore() { return this._totalRealScore; }
    get currentStreakScore() { return this._isFeverActive ? this._feverStreakScore : this._normalStreakScore; }
    get currentMultiplier() { return this._isFeverActive ? this._feverMultiplier : this.calculateNormalMultiplier(); }
    get isFeverActive() { return this._isFeverActive; }
    get normalChainCount() { return this._normalChainCount; }
    get feverRoundCount() { return this._feverRoundCount; }

    reset() {
        this._totalRealScore = 0;
        this._normalStreakScore = 0;
        this._normalChainCount = 0;
        this._feverStreakScore = 0;
        this._feverMultiplier = 1;
        this._isFeverActive = false;
        this._feverRoundCount = 0;
    }

    // --- Core Scoring ---

    /**
     * Calculates and adds points for a merge event.
     * Automatically handles Chain incrementing if in Normal mode.
     */
    addMergePoints(tier: number): number {
        // 1. Update Chain if Normal Mode
        // We increment BEFORE calculating score so the player gets the benefit of the new merge
        if (!this._isFeverActive) {
            this._normalChainCount++;
        }

        // 2. Calculate Points
        const basePoints = SCORE_BASE_MERGE * Math.pow(2, tier);
        const multiplier = this.currentMultiplier;
        const total = Math.floor(basePoints * multiplier);

        // 3. Bank Real Score Immediately
        this._totalRealScore += total;

        // 4. Add to Transient Streak
        if (this._isFeverActive) {
            this._feverStreakScore += total;
        } else {
            this._normalStreakScore += total;
        }

        return total;
    }

    /**
     * Adds arbitrary points (e.g. Celebration) to the current active state.
     * These points are affected by the current multiplier?
     * Usually Celebrations have their own logic, but if we want them to "swell" the streak:
     */
    addDirectPoints(amount: number) {
        const added = Math.floor(amount);
        this._totalRealScore += added;

        if (this._isFeverActive) {
            this._feverStreakScore += added;
        } else {
            this._normalStreakScore += added;
        }
    }

    // --- State Management ---

    /**
     * Resets the Normal Mode chain.
     * Call this when the player misses the combo window.
     * Returns the 'lost' streak score that should be sucked up (or discarded?).
     * Usually if chain breaks, we bank the streak?
     * Actually, in this game, streak score IS the score. It's just a visual grouper.
     * The points are already in _totalRealScore.
     * So we just return the value so UI can show a "final" popup if needed, or 0.
     */
    resetNormalChain(): number {
        if (!this._isFeverActive) {
            const finalStreak = this._normalStreakScore;
            this._normalChainCount = 0;
            this._normalStreakScore = 0;
            return finalStreak;
        }
        return 0;
    }

    calculateNormalMultiplier(): number {
        // "normal multiplyer should go up to 10x."
        // Chain 0 -> 1x
        // Chain 1 -> 2x
        // ...
        // Chain 9 -> 10x
        // Chain 10+ -> 10x
        return 1 + Math.min(this._normalChainCount, 9);
    }

    // --- Fever Logic ---

    enterFever() {
        if (this._isFeverActive) return;

        this._feverRoundCount++;
        this._isFeverActive = true;
        this._feverStreakScore = 0;

        // Formula: Normal Multiplier * Fever Round
        // Example: Normal 10x * Fever Round 3 = 30x
        const normalMult = this.calculateNormalMultiplier();
        const feverBoost = this._feverRoundCount;
        this._feverMultiplier = normalMult * feverBoost;
    }

    exitFever(): { suckedPoints: number } {
        if (!this._isFeverActive) return { suckedPoints: 0 };

        const suckedPoints = this._feverStreakScore;

        this._isFeverActive = false;
        this._feverStreakScore = 0;
        this._feverMultiplier = 1;

        // Normal chain resumes automatically (values were preserved)
        return { suckedPoints };
    }

    // Helper to get stashed state for UI restoration
    getStashedNormalState() {
        return {
            score: this._normalStreakScore,
            multiplier: this.calculateNormalMultiplier()
        };
    }
}
