import * as PIXI from 'pixi.js';
import { GameEngine } from './GameEngine';
import { InputContext } from './systems/InputSystem';
import { FruitTier } from '../types';
import { FRUIT_DEFS, GAME_CONFIG, SPAWN_Y_PERCENT } from '../constants';
import { Particle as GameParticle } from '../types/GameObjects';

/**
 * Handles all input events (pointer down/move/up) and fruit spawning logic.
 * Extracted from GameEngine to reduce file size.
 *
 * Responsibilities:
 * - Convert Pixi federated events to input system calls
 * - Handle fruit drop on pointer up (apply velocity, start physics)
 * - Spawn next fruit with delay
 * - Force fruit tier (debug/cheat)
 */
export class GameInput {
    private engine: GameEngine;

    constructor(engine: GameEngine) {
        this.engine = engine;
    }

    /** Build the input context from current engine state */
    getInputContext(): InputContext {
        return {
            containerX: this.engine.container.position.x,
            containerY: this.engine.container.position.y,
            scaleFactor: this.engine.scaleFactor,
            width: this.engine.width,
            height: this.engine.height,
            paused: this.engine.paused,
            currentFruit: this.engine.currentFruit,
            canDrop: this.engine.canDrop
        };
    }

    /** Handle pointer down — start aiming */
    onPointerDown(e: PIXI.FederatedPointerEvent) {
        if (this.engine.paused) return;
        this.engine.audio.resume();
        this.engine.inputSystem.onPointerDown(e, this.getInputContext());
    }

    /** Handle pointer move — update aim position */
    onPointerMove(e: PIXI.FederatedPointerEvent) {
        this.engine.inputSystem.onPointerMove(e, this.getInputContext());
    }

    /** Handle pointer up — drop fruit into physics */
    onPointerUp(e: PIXI.FederatedPointerEvent) {
        const result = this.engine.inputSystem.onPointerUp(e, this.getInputContext());
        if (result && this.engine.currentFruit) {
            // Notify ScoreController about turn end
            this.engine.scoreController.handleTurnEnd({ didMerge: this.engine.didMergeThisTurn });
            this.engine.didMergeThisTurn = false;

            this.engine.currentFruit.isStatic = false;
            this.engine.currentFruit.vx = result.vx;
            this.engine.currentFruit.vy = result.vy;
            this.engine.currentFruit.angularVelocity = result.vx * 0.05;
            this.engine.fruits.push(this.engine.currentFruit);
            this.engine.currentFruit = null;
            this.engine.canDrop = false;

            // Clear any existing timeout just in case
            if (this.engine.spawnTimeout) clearTimeout(this.engine.spawnTimeout);

            this.engine.spawnTimeout = setTimeout(() => {
                this.engine.canDrop = true;
                this.engine.spawnTimeout = null;
                this.spawnNextFruit();
            }, GAME_CONFIG.spawnDelay);
        }
    }

    /** Register pointer event listeners on the Pixi stage */
    registerListeners(stage: PIXI.Container) {
        stage.on('pointerdown', this.onPointerDown.bind(this));
        stage.on('pointermove', this.onPointerMove.bind(this));
        stage.on('pointerup', this.onPointerUp.bind(this));
        stage.on('pointerupoutside', this.onPointerUp.bind(this));
    }

    /** Spawn the next fruit at the top of the game area */
    spawnNextFruit() {
        if (!this.engine.canDrop) return;

        let maxTier = FruitTier.CHERRY;
        for (const p of this.engine.fruits) {
            if (!p.isStatic && p.tier !== FruitTier.TOMATO && p.tier !== FruitTier.BOMB && p.tier !== FruitTier.RAINBOW) {
                if (p.tier > maxTier) maxTier = p.tier;
            }
        }
        this.engine.onMaxFruit(maxTier);
        if (maxTier > this.engine.stats.maxTier) {
            this.engine.stats.maxTier = maxTier;
        }

        let tier = this.engine.nextFruitQueue.shift();
        if (tier === undefined) tier = this.engine.pickRandomFruit(maxTier);

        const nextLookahead = this.engine.pickRandomFruit(maxTier);
        this.engine.nextFruitQueue.push(nextLookahead);

        this.engine.onNextFruit(nextLookahead);

        this.engine.nextFruitTier = tier;
        this.engine.canSwap = true;
        this.engine.currentFruit = new GameParticle(
            this.engine.width / 2,
            this.engine.height * SPAWN_Y_PERCENT,
            FRUIT_DEFS[tier],
            this.engine.nextId++
        );
        this.engine.currentFruit.isStatic = true;

        // Input System Update for Anchor
        this.engine.inputSystem.dragAnchorX = this.engine.width / 2;
        this.engine.inputSystem.dragAnchorY = this.engine.height * SPAWN_Y_PERCENT;

        this.engine.renderSystem.createSprite(this.engine.currentFruit);
    }

    /** Force current fruit to a specific tier (debug/cheat) */
    forceCurrentFruit(tier: FruitTier) {
        if (!this.engine.currentFruit) return;

        this.engine.renderSystem.removeSprite(this.engine.currentFruit);

        this.engine.nextFruitTier = tier;
        this.engine.currentFruit = new GameParticle(
            this.engine.currentFruit.x,
            this.engine.currentFruit.y,
            FRUIT_DEFS[tier],
            this.engine.nextId++
        );
        this.engine.currentFruit.isStatic = true;
        this.engine.renderSystem.createSprite(this.engine.currentFruit);
    }
}
