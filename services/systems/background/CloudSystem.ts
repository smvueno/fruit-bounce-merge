import * as PIXI from 'pixi.js';

interface CloudConfig {
    yPercent: number;
    scale: number;
    opacity: number;
    duration: number;
    delay: number;
}

const CLOUD_CONFIGS: CloudConfig[] = [
    { yPercent: 0.75, scale: 0.5, opacity: 0.3, duration: 30, delay: 0 },
    { yPercent: 0.60, scale: 0.7, opacity: 0.4, duration: 25, delay: 5 },
    { yPercent: 0.35, scale: 0.9, opacity: 0.5, duration: 20, delay: 2 },
    { yPercent: 0.10, scale: 1.2, opacity: 0.6, duration: 15, delay: 0 },
    { yPercent: 0.05, scale: 1.3, opacity: 0.55, duration: 12, delay: 8 },
];

export class CloudSystem {
    public container: PIXI.Container;
    private app: PIXI.Application;
    private clouds: PIXI.Sprite[] = [];
    private gameAreaTop: number = 0;
    private elapsedSeconds: number = 0;

    constructor(app: PIXI.Application) {
        this.app = app;
        this.container = new PIXI.Container();
        this.container.interactive = false;
        this.container.interactiveChildren = false;

        this.initClouds();
    }

    private initClouds() {
        // Create a single cloud texture using PIXI.Graphics
        const graphics = new PIXI.Graphics();
        // Since PIXI.Graphics in v8 might be different, let's use the v8 api
        graphics.circle(0, -20, 20).fill(0xFFFFFF);
        graphics.circle(30, -30, 28).fill(0xFFFFFF);
        graphics.circle(60, -20, 20).fill(0xFFFFFF);

        // Generate texture from graphics
        const texture = this.app.renderer.generateTexture(graphics);

        // Create cloud sprites
        for (const config of CLOUD_CONFIGS) {
            const cloud = new PIXI.Sprite(texture);

            // Adjust anchor because the graphics were drawn relative to 0,0
            // but the circles go upwards (negative y) and to the right (positive x).
            // A typical center anchor works fine if we just want to scale and position it.
            cloud.anchor.set(0.5, 0.5);

            cloud.scale.set(config.scale);
            cloud.alpha = config.opacity;

            this.container.addChild(cloud);
            this.clouds.push(cloud);
        }
    }

    public updateGameAreaTop(top: number) {
        this.gameAreaTop = top;
    }

    public update(dtSeconds: number) {
        this.elapsedSeconds += dtSeconds;

        const vw = window.innerWidth / 100;
        const totalDistance = 160 * vw;
        const startX = -50 * vw;

        const zoneTop = this.gameAreaTop - 140;
        const zoneHeight = 180;

        for (let i = 0; i < this.clouds.length; i++) {
            const cloud = this.clouds[i];
            const config = CLOUD_CONFIGS[i];

            const cycleTime = config.duration;
            const delay = config.delay;

            // Allow time to be negative if we are in delay
            const totalTime = this.elapsedSeconds - delay;

            let progress = (totalTime % cycleTime) / cycleTime;
            if (progress < 0) progress += 1;

            const currentX = startX + (totalDistance * progress);
            const currentY = zoneTop + (config.yPercent * zoneHeight);

            cloud.x = currentX;
            cloud.y = currentY;
        }
    }
}
