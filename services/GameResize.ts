import { GameEngine } from './GameEngine';

// Virtual resolution constants (must match GameEngine)
const V_WIDTH = 600;
const V_HEIGHT = 750;

/**
 * Handles canvas resizing and game area layout updates.
 * Extracted from GameEngine to reduce file size.
 *
 * Responsibilities:
 * - Recalculate scale factor when the canvas or game area changes
 * - Center the game container within the canvas
 * - Update all screen-space renderers (ground, walls, clouds)
 */
export class GameResize {
    private engine: GameEngine;

    constructor(engine: GameEngine) {
        this.engine = engine;
    }

    /** Called by Pixi renderer when the canvas is resized */
    handleResize() {
        if (!this.engine.app || !this.engine.app.screen) return;

        const actualW = this.engine.app.screen.width;
        const actualH = this.engine.app.screen.height;

        // If we have a game area rect, use it to calculate scale
        if (this.engine._gameAreaWidth > 0 && this.engine._gameAreaHeight > 0) {
            this.engine.scaleFactor = Math.min(
                this.engine._gameAreaWidth / V_WIDTH,
                this.engine._gameAreaHeight / V_HEIGHT
            );
            this.engine.container.scale.set(this.engine.scaleFactor);

            // Center container within the canvas
            const logicalW = V_WIDTH * this.engine.scaleFactor;
            const logicalH = V_HEIGHT * this.engine.scaleFactor;
            const xOffset = (actualW - logicalW) / 2;
            const yOffset = (actualH - logicalH) / 2;
            this.engine.container.position.set(xOffset, yOffset);
        } else {
            // Fallback: estimate from canvas size
            const viewW = actualW / 1.4;
            const viewH = actualH / 1.4;
            this.engine.scaleFactor = Math.min(viewW / V_WIDTH, viewH / V_HEIGHT);
            this.engine.container.scale.set(this.engine.scaleFactor);
            const logicalW = V_WIDTH * this.engine.scaleFactor;
            const logicalH = V_HEIGHT * this.engine.scaleFactor;
            const xOffset = (actualW - logicalW) / 2;
            const yOffset = (actualH - logicalH) / 2;
            this.engine.container.position.set(xOffset, yOffset);
        }

        // Track screen-space coordinates for wall/cloud/ground renderers
        this.engine._screenWidth = actualW;
        this.engine._screenHeight = actualH;
        this.engine._containerTop = this.engine._gameAreaHeight > 0
            ? (actualH - this.engine._gameAreaHeight) / 2
            : this.engine._containerTop;
        this.engine._containerLeft = this.engine._gameAreaWidth > 0
            ? (actualW - this.engine._gameAreaWidth) / 2
            : this.engine._containerLeft;

        // Update screen-space renderers (ground, walls)
        if (this.engine.groundRenderer) {
            this.engine.groundRenderer.draw(actualW, actualH, this.engine._gameAreaWidth, this.engine.scaleFactor, this.engine._containerLeft);
        }
        if (this.engine.wallRenderer) {
            this.engine.wallRenderer.draw(this.engine._gameAreaWidth, this.engine._gameAreaHeight, this.engine.scaleFactor, this.engine._containerLeft);
        }
    }

    /**
     * Called when the DOM layout changes (responsive resize).
     * Updates the game area rectangle and recalculates scale/position.
     */
    updateGameAreaRect(left: number, top: number, width: number, height: number): void {
        if (!this.engine.app || !this.engine.app.screen) return;

        this.engine._containerLeft = left;
        this.engine._containerTop = top;
        this.engine._gameAreaWidth = width;
        this.engine._gameAreaHeight = height;
        this.engine._screenWidth = this.engine.app.screen.width;
        this.engine._screenHeight = this.engine.app.screen.height;

        // Recalculate scale and container position
        this.engine.scaleFactor = Math.min(width / V_WIDTH, height / V_HEIGHT);
        this.engine.container.scale.set(this.engine.scaleFactor);

        // Center container within the canvas
        const logicalW = V_WIDTH * this.engine.scaleFactor;
        const logicalH = V_HEIGHT * this.engine.scaleFactor;
        const xOffset = (this.engine._screenWidth - logicalW) / 2;
        const yOffset = (this.engine._screenHeight - logicalH) / 2;
        this.engine.container.position.set(xOffset, yOffset);

        // Update screen-space renderers
        if (this.engine.groundRenderer) {
            this.engine.groundRenderer.draw(this.engine._screenWidth, this.engine._screenHeight, width, this.engine.scaleFactor, left);
        }
        if (this.engine.wallRenderer) {
            this.engine.wallRenderer.draw(width, height, this.engine.scaleFactor, left);
        }
    }
}
