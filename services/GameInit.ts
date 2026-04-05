import * as PIXI from 'pixi.js';
import { GameEngine } from './GameEngine';
import { CloudRenderer } from './renderers/CloudRenderer';
import { WallRenderer } from './renderers/WallRenderer';
import { GroundRenderer } from './renderers/GroundRenderer';
import { JuiceRenderer } from './renderers/JuiceRenderer';

// Virtual resolution constants (must match GameEngine)
const V_WIDTH = 600;
const V_HEIGHT = 750;

/**
 * Handles Pixi.js application initialization, renderer setup, and
 * initial scene construction. Extracted from GameEngine to reduce file size.
 *
 * Responsibilities:
 * - Create and configure PIXI.Application
 * - Initialize all renderers (clouds, walls, ground, juice, render system)
 * - Set up the ticker with proper FPS settings
 * - Register input and visibility listeners
 * - Spawn the first fruit
 */
export class GameInit {
    private engine: GameEngine;

    constructor(engine: GameEngine) {
        this.engine = engine;
    }

    async initialize() {
        if (this.engine.destroyed) return;
        this.engine.initializing = true;
        this.engine.app = new PIXI.Application();

        try {
            const dpr = window.devicePixelRatio || 1;

            await this.engine.app.init({
                canvas: this.engine.canvasElement,
                backgroundAlpha: 0,
                width: this.engine.canvasElement.clientWidth,
                height: this.engine.canvasElement.clientHeight,
                antialias: true,
                resolution: dpr,
                autoDensity: true,
                preference: 'webgl',
                resizeTo: this.engine.canvasElement,
            });

            this.engine.app.renderer.on('resize', () => this.engine.handleResize());

        } catch (e) {
            console.error(`[GameInit] PIXI Init Error:`, e);
            this.engine.initializing = false;
            return;
        }

        this.engine.initializing = false;
        if (this.engine.destroyed) {
            if (this.engine.app) this.engine.app.destroy({ removeView: false });
            return;
        }
        if (!this.engine.app.renderer) return;

        // Initial Resize
        this.engine.handleResize();

        this.engine.app.stage.addChild(this.engine.container);

        // Initialize Render System
        this.engine.renderSystem.initialize(this.engine.app, this.engine.container);

        // Initialize Ground Renderer (inside the game container — virtual coords)
        this.engine.groundRenderer = new GroundRenderer(this.engine.container);

        // Initialize Juice Renderer (inside the game container — virtual coords)
        this.engine.juiceRenderer = new JuiceRenderer(this.engine.container);

        // Initialize Cloud Renderer (screen-space, on the stage)
        this.engine.cloudRenderer = new CloudRenderer(this.engine.app.stage, this.engine.app.renderer);

        // Initialize Wall Renderer (inside the game container — virtual coords)
        this.engine.wallRenderer = new WallRenderer(this.engine.container);

        // Re-run resize to update screen-space renderers now that they exist
        this.engine.handleResize();

        // Start Game
        this.engine.spawnNextFruit();

        // Ticker configuration
        this.engine.app.ticker.maxFPS = 0; // unlimited — runs at display refresh rate
        this.engine.app.ticker.minFPS = 30; // clamp deltaTime to prevent spiral of death
        this.engine.app.ticker.add(this.engine.update.bind(this));

        // Input Handling
        this.engine.app.stage.eventMode = 'static';
        if (this.engine.app.screen) this.engine.app.stage.hitArea = this.engine.app.screen;
        this.engine.gameInput!.registerListeners(this.engine.app.stage);

        // Handle Visibility Changes (Context Loss Prevention)
        const handlers = this.engine.gameVisibility!.registerListeners(this.engine.canvasElement);
        this.engine.visibilityHandler = handlers.visibilityHandler;
        this.engine.contextRestoredHandler = handlers.contextRestoredHandler;
    }
}
