import * as PIXI from 'pixi.js';

/**
 * Renders animated clouds in Pixi.
 * Replaces CloudsCanvas.tsx — draws clouds using Pixi ticker instead of separate rAF loop.
 * Clouds live in the band above the game area.
 */
interface Cloud {
    sprite: PIXI.Graphics;
    yPercent: number;
    duration: number; // seconds for one full pass
    delay: number;    // seconds offset
    opacity: number;
}

export class CloudRenderer {
    private container: PIXI.Container;
    private clouds: Cloud[] = [];
    private zoneTop: number = 0;
    private zoneHeight: number = 180;
    private startTime: number = 0;

    constructor(parent: PIXI.Container) {
        this.container = new PIXI.Container();
        this.container.zIndex = -200; // Behind everything
        parent.addChild(this.container);

        this.createClouds();
    }

    private createClouds(): void {
        const cloudConfigs = [
            { yPercent: 0.75, scale: 0.5, opacity: 0.3, duration: 30, delay: 0 },
            { yPercent: 0.60, scale: 0.7, opacity: 0.4, duration: 25, delay: 5 },
            { yPercent: 0.35, scale: 0.9, opacity: 0.5, duration: 20, delay: 2 },
            { yPercent: 0.10, scale: 1.2, opacity: 0.6, duration: 15, delay: 0 },
            { yPercent: 0.05, scale: 1.3, opacity: 0.55, duration: 12, delay: 8 },
        ];

        for (const cfg of cloudConfigs) {
            const sprite = this.drawCloud(cfg.scale, cfg.opacity);
            this.container.addChild(sprite);
            this.clouds.push({
                sprite,
                yPercent: cfg.yPercent,
                duration: cfg.duration,
                delay: cfg.delay,
                opacity: cfg.opacity,
            });
        }
    }

    private drawCloud(scale: number, opacity: number): PIXI.Graphics {
        const g = new PIXI.Graphics();
        g.alpha = opacity;
        g.scale.set(scale);

        // Cloud shape: 3 overlapping circles
        g.circle(0, -20, 20);
        g.circle(30, -30, 28);
        g.circle(60, -20, 20);
        g.fill({ color: 0xFFFFFF });

        return g;
    }

    /**
     * Update cloud positions. Called from the Pixi ticker.
     * @param elapsedMs Time elapsed since last frame
     * @param screenPixelWidth Screen width in CSS pixels
     * @param containerScreenY Container Y position on screen (CSS pixels)
     */
    update(elapsedMs: number, screenPixelWidth: number, containerScreenY: number): void {
        if (this.startTime === 0) this.startTime = performance.now();
        const elapsed = (performance.now() - this.startTime) / 1000; // seconds

        const vw = screenPixelWidth / 100;
        const totalDistance = 160 * vw;
        const startX = -50 * vw;

        // Zone boundaries
        const zoneTop = containerScreenY - 140;
        const zoneH = this.zoneHeight;

        for (const cloud of this.clouds) {
            const cycleTime = cloud.duration;
            const delayMs = cloud.delay;
            const totalTime = elapsed - delayMs;

            let progress = (totalTime % cycleTime) / cycleTime;
            if (progress < 0) progress += 1;

            const currentX = startX + (totalDistance * progress);
            const canvasY = zoneTop + (cloud.yPercent * zoneH);

            cloud.sprite.x = currentX;
            cloud.sprite.y = canvasY;
        }
    }
}
