import * as PIXI from 'pixi.js';

/**
 * Renders the juice/water overlay in Pixi (virtual coords inside game container).
 * Replaces JuiceOverlay.tsx CSS mask approach.
 * Water rises from bottom to danger line (13% from top) based on juice level.
 * Animated wave on top edge.
 */
export class JuiceRenderer {
    private graphics: PIXI.Graphics;
    private waveGraphics: PIXI.Graphics;
    private currentLevel: number = 0;
    private targetLevel: number = 0;
    private fever: boolean = false;
    private waveOffset: number = 0;

    constructor(parent: PIXI.Container) {
        this.graphics = new PIXI.Graphics();
        this.waveGraphics = new PIXI.Graphics();
        this.graphics.zIndex = -10;
        this.waveGraphics.zIndex = -9;
        parent.addChild(this.graphics);
        parent.addChild(this.waveGraphics);
    }

    /**
     * Update juice level and fever state.
     * @param level 0-100
     * @param isFever
     */
    update(level: number, isFever: boolean): void {
        this.targetLevel = level;
        this.fever = isFever;
    }

    /**
     * Render the juice overlay. Call every frame.
     * @param dt Delta time in seconds
     */
    render(dt: number): void {
        const V_WIDTH = 600;
        const V_HEIGHT = 750;
        const DANGER_Y = V_HEIGHT * 0.13; // 97.5
        const MAX_HEIGHT = V_HEIGHT - DANGER_Y; // 652.5

        // Smooth interpolation to target level
        const speed = 2.0; // units per second
        const targetHeight = (this.targetLevel / 100) * MAX_HEIGHT;
        if (Math.abs(this.currentLevel - targetHeight) > 0.5) {
            this.currentLevel += (targetHeight - this.currentLevel) * speed * dt;
        } else {
            this.currentLevel = targetHeight;
        }

        const waterTop = V_HEIGHT - this.currentLevel;
        const baseColor = this.fever ? 0xA855F7 : 0x60A5FA;

        // Update wave animation
        this.waveOffset += dt * 2; // wave speed

        // Draw main water body
        this.graphics.clear();
        if (this.currentLevel > 0) {
            const waveAmp = 4;
            const waveFreq = 0.05;
            const step = 5;

            // Water body fill
            const points: number[] = [];
            points.push(0, V_HEIGHT + 100);
            points.push(0, waterTop);
            for (let x = 0; x <= V_WIDTH; x += step) {
                const waveY = waterTop + Math.sin(x * waveFreq + this.waveOffset) * waveAmp;
                points.push(x, waveY);
            }
            points.push(V_WIDTH, waterTop + Math.sin(V_WIDTH * waveFreq + this.waveOffset) * waveAmp);
            points.push(V_WIDTH, V_HEIGHT + 100);

            this.graphics.poly(points);
            this.graphics.fill({ color: baseColor, alpha: 0.4 });
        }

        // Draw wave edge (top of water) as a thicker, brighter line
        this.waveGraphics.clear();
        if (this.currentLevel > 0) {
            const waveAmp = 4;
            const waveFreq = 0.05;
            const step = 5;

            const wavePoints: number[] = [];
            for (let x = 0; x <= V_WIDTH; x += step) {
                const waveY = waterTop + Math.sin(x * waveFreq + this.waveOffset) * waveAmp;
                wavePoints.push(x, waveY);
            }

            if (wavePoints.length >= 4) {
                this.waveGraphics.moveTo(wavePoints[0], wavePoints[1]);
                for (let i = 2; i < wavePoints.length; i += 2) {
                    this.waveGraphics.lineTo(wavePoints[i], wavePoints[i + 1]);
                }
            }
            this.waveGraphics.stroke({ width: 6, color: baseColor, alpha: 0.6 });
        }
    }
}
