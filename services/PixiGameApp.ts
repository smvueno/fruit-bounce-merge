import * as PIXI from 'pixi.js';

/**
 * Pure Pixi.js application wrapper.
 * Manages PIXI.Application lifecycle, canvas element, and scene graph.
 * Decoupled from game logic — just handles rendering infrastructure.
 */
export interface PixiGameAppConfig {
    canvas: HTMLCanvasElement;
    transparent?: boolean;
    antialias?: boolean;
    resizeTo?: HTMLElement;
    /** Max DPR cap. Mobile capped at 2 by default. */
    maxDpr?: number;
}

export class PixiGameApp {
    app: PIXI.Application | null = null;
    /** Root container for all game objects. */
    container: PIXI.Container;
    /** The canvas element we were given. */
    canvas: HTMLCanvasElement;

    private _destroyed = false;
    private _resizeHandler: (() => void) | null = null;

    constructor(config: PixiGameAppConfig) {
        this.canvas = config.canvas;
        this.container = new PIXI.Container();
    }

    async init(config?: PixiGameAppConfig): Promise<void> {
        if (this._destroyed) return;

        const cfg = config || { canvas: this.canvas };
        const canvas = cfg.canvas || this.canvas;

        const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
        const maxDpr = cfg.maxDpr ?? (isMobile ? 2 : undefined);
        const rawDpr = window.devicePixelRatio || 1;
        const dpr = maxDpr ? Math.min(rawDpr, maxDpr) : rawDpr;

        this.app = new PIXI.Application();

        await this.app.init({
            canvas,
            backgroundAlpha: cfg.transparent !== false ? 0 : undefined,
            width: canvas.clientWidth || 600,
            height: canvas.clientHeight || 750,
            antialias: cfg.antialias ?? !isMobile,
            resolution: dpr,
            autoDensity: true,
            preference: 'webgl',
        });

        this.canvas = canvas;
    }

    /**
     * Add the root container to the stage.
     */
    mount(): void {
        if (!this.app) throw new Error('[PixiGameApp] Call init() before mount()');
        this.app.stage.addChild(this.container);
    }

    /**
     * Remove the root container from the stage (does not destroy it).
     */
    unmount(): void {
        if (!this.app) return;
        this.app.stage.removeChild(this.container);
    }

    /**
     * Register a resize callback. The Pixi app handles canvas resizing automatically
     * via autoDensity + resizeTo, but game logic may need to react to size changes.
     */
    onResize(handler: () => void): void {
        if (!this.app) throw new Error('[PixiGameApp] Call init() before onResize()');
        this._resizeHandler = handler;
        this.app.renderer.on('resize', handler);
    }

    /**
     * Register a ticker callback for the game loop.
     */
    onTick(handler: (ticker: PIXI.Ticker) => void): void {
        if (!this.app) throw new Error('[PixiGameApp] Call init() before onTick()');
        this.app.ticker.add(handler);
    }

    /**
     * Set the ticker max FPS (e.g., 60 for consistent physics).
     */
    setMaxFps(fps: number): void {
        if (!this.app) return;
        this.app.ticker.maxFPS = fps;
    }

    /**
     * Start the ticker.
     */
    start(): void {
        if (!this.app) return;
        this.app.ticker.start();
    }

    /**
     * Stop the ticker.
     */
    stop(): void {
        if (!this.app) return;
        this.app.ticker.stop();
    }

    /**
     * Whether the ticker is currently running.
     */
    get isRunning(): boolean {
        return this.app?.ticker.started ?? false;
    }

    /**
     * Set up pointer input on the stage.
     */
    enableInput(handlers: {
        onPointerDown?: (e: PIXI.FederatedPointerEvent) => void;
        onPointerMove?: (e: PIXI.FederatedPointerEvent) => void;
        onPointerUp?: (e: PIXI.FederatedPointerEvent) => void;
    }): void {
        if (!this.app || !this.app.stage) return;
        this.app.stage.eventMode = 'static';
        if (this.app.screen) this.app.stage.hitArea = this.app.screen;

        if (handlers.onPointerDown) this.app.stage.on('pointerdown', handlers.onPointerDown);
        if (handlers.onPointerMove) this.app.stage.on('pointermove', handlers.onPointerMove);
        if (handlers.onPointerUp) this.app.stage.on('pointerup', handlers.onPointerUp);
        this.app.stage.on('pointerupoutside', handlers.onPointerUp ?? (() => { }));
    }

    /**
     * Current screen dimensions from Pixi renderer.
     */
    get screen(): { width: number; height: number } {
        if (!this.app) return { width: 0, height: 0 };
        return { width: this.app.screen.width, height: this.app.screen.height };
    }

    /**
     * Destroy the Pixi application and clean up resources.
     */
    destroy(): void {
        this._destroyed = true;
        if (this.app) {
            try {
                this.app.destroy({ removeView: false });
            } catch {
                // Ignore destruction errors
            }
            this.app = null;
        }
    }

    get destroyed(): boolean {
        return this._destroyed;
    }
}
