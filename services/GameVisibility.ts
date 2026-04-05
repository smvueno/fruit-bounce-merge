import { GameEngine } from './GameEngine';

/**
 * Handles app visibility changes (background/foreground) and WebGL context
 * loss/restoration. Extracted from GameEngine to reduce file size.
 *
 * When the app goes to background:
 *   - Pauses the game and stops the ticker
 * When it returns to foreground:
 *   - Retries graphics restoration with exponential backoff
 *   - Resumes the ticker and game loop
 */
export class GameVisibility {
    private engine: GameEngine;
    private wasPausedBySystem: boolean = false;

    constructor(engine: GameEngine) {
        this.engine = engine;
    }

    /** Called by document visibilitychange event */
    handleVisibilityChange() {
        if (document.hidden) {
            console.log('[GameVisibility] App backgrounded - pausing');
            if (!this.engine.paused) {
                this.engine.setPaused(true);
                this.wasPausedBySystem = true;
            } else {
                this.wasPausedBySystem = false;
            }
            if (this.engine.app) {
                this.engine.app.ticker.stop();
            }
        } else {
            console.log('[GameVisibility] App foregrounded - restoring');
            this.attemptRestoration(0);
        }
    }

    /** Retry graphics restoration with exponential backoff (200ms, 400ms, 800ms, ...) */
    private attemptRestoration(attempt: number) {
        if (attempt > 4) {
            console.error('[GameVisibility] Failed to restore graphics after multiple attempts.');
            this.resumeAfterRestore();
            return;
        }

        const delay = 200 * Math.pow(2, attempt);
        console.log(`[GameVisibility] Restoration attempt ${attempt + 1} scheduled in ${delay}ms`);

        setTimeout(() => {
            const success = this.restoreGraphics();
            if (success) {
                console.log('[GameVisibility] Restoration successful.');
                this.resumeAfterRestore();
            } else {
                console.warn(`[GameVisibility] Restoration attempt ${attempt + 1} failed. Retrying...`);
                this.attemptRestoration(attempt + 1);
            }
        }, delay);
    }

    /** Resume game after graphics restoration */
    private resumeAfterRestore() {
        if (this.wasPausedBySystem) {
            this.engine.setPaused(false);
            this.wasPausedBySystem = false;
        }
        if (this.engine.app) {
            this.engine.app.ticker.start();
        }
    }

    /** Restore WebGL context and re-create all fruit sprites and renderers */
    restoreGraphics(): boolean {
        if (!this.engine.app || !this.engine.app.renderer) return false;

        console.log('[GameVisibility] Restoring graphics context...');
        const success = this.engine.renderSystem.refreshGraphics();
        if (!success) return false;

        // Restore current fruit sprite
        if (this.engine.currentFruit) {
            this.engine.renderSystem.createSprite(this.engine.currentFruit);
        }

        // Restore all active fruits
        for (const p of this.engine.fruits) {
            this.engine.renderSystem.createSprite(p);
        }

        // Redraw static elements
        this.engine.renderSystem.drawDangerLine(
            this.engine.width, this.engine.height, this.engine.isOverLimit
        );

        // Redraw environment (ground + walls)
        if (this.engine.groundRenderer) {
            this.engine.groundRenderer.draw(
                this.engine._screenWidth, this.engine._screenHeight,
                this.engine._gameAreaWidth, this.engine.scaleFactor, this.engine._containerLeft
            );
        }
        if (this.engine.wallRenderer) {
            this.engine.wallRenderer.draw(
                this.engine._screenWidth, this.engine._screenHeight,
                this.engine.scaleFactor, this.engine._containerLeft
            );
        }

        const actualW = this.engine.app.screen.width;
        const actualH = this.engine.app.screen.height;
        this.engine.renderSystem.updateEnvironment(
            actualW, actualH, 600, 750, this.engine.scaleFactor
        );
        this.engine.groundRenderer?.draw(actualW, actualH, this.engine._gameAreaWidth, this.engine.scaleFactor, this.engine._containerLeft);
        this.engine.wallRenderer?.draw(actualW, actualH, this.engine.scaleFactor, this.engine._containerLeft);

        return true;
    }

    /** Register event listeners on the canvas and document */
    registerListeners(canvasElement: HTMLCanvasElement): { visibilityHandler: () => void; contextRestoredHandler: () => void } {
        const visibilityHandler = () => this.handleVisibilityChange();
        const contextRestoredHandler = () => {
            console.log('[GameVisibility] WebGL context restored');
            this.restoreGraphics();
        };

        document.addEventListener('visibilitychange', visibilityHandler);
        canvasElement.addEventListener('webglcontextrestored', contextRestoredHandler);

        return { visibilityHandler, contextRestoredHandler };
    }

    /** Remove event listeners (cleanup) */
    unregisterListeners(canvasElement: HTMLCanvasElement, visibilityHandler: () => void, contextRestoredHandler: () => void) {
        document.removeEventListener('visibilitychange', visibilityHandler);
        canvasElement.removeEventListener('webglcontextrestored', contextRestoredHandler);
    }
}
