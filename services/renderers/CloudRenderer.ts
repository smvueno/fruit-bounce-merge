import * as PIXI from 'pixi.js';

/**
 * Renders animated clouds using Pixi.js v8 ParticleContainer.
 * Uses lightweight Particle objects instead of Sprites — GPU instanced, 1 draw call.
 * Handles 100K+ particles at 60fps.
 * 
 * Clouds span full viewport width, live in the band above the game area.
 */
interface CloudData {
    particle: PIXI.Particle;
    yPercent: number;
    duration: number;
    delay: number;
}

export class CloudRenderer {
    private pc: PIXI.ParticleContainer;
    private clouds: CloudData[] = [];
    private startTime: number = 0;

    constructor(stage: PIXI.Container, renderer: PIXI.Renderer) {
        // Pre-render cloud texture at high resolution for sharpness
        const cloudTexture = this.createCloudTexture(renderer);

        // ParticleContainer — GPU instanced, 1 draw call for all clouds
        // Only position is dynamic (default) — scale and alpha are static
        this.pc = new PIXI.ParticleContainer({
            dynamicProperties: {
                position: true,
                scale: false,
                rotation: false,
                color: false,
            },
        });
        this.pc.zIndex = -200;
        stage.addChild(this.pc);

        this.createClouds(cloudTexture);
    }

    private createCloudTexture(renderer: PIXI.Renderer): PIXI.Texture {
        const g = new PIXI.Graphics();
        g.circle(0, -20, 20);
        g.circle(30, -30, 28);
        g.circle(60, -20, 20);
        g.fill({ color: 0xFFFFFF });

        const texture = renderer.generateTexture({
            target: g,
            resolution: 4,
            antialias: true,
        });
        g.destroy();
        return texture;
    }

    private createClouds(texture: PIXI.Texture): void {
        const cloudConfigs = [
            { yPercent: 0.75, scale: 0.5, opacity: 0.3, duration: 30, delay: 0 },
            { yPercent: 0.60, scale: 0.7, opacity: 0.4, duration: 25, delay: 5 },
            { yPercent: 0.35, scale: 0.9, opacity: 0.5, duration: 20, delay: 2 },
            { yPercent: 0.10, scale: 1.2, opacity: 0.6, duration: 15, delay: 0 },
            { yPercent: 0.05, scale: 1.3, opacity: 0.55, duration: 12, delay: 8 },
        ];

        for (const cfg of cloudConfigs) {
            const particle = new PIXI.Particle(texture);
            particle.x = -100;
            particle.y = 0;
            particle.alpha = cfg.opacity;
            particle.scaleX = cfg.scale;
            particle.scaleY = cfg.scale;

            this.pc.addParticle(particle);
            this.clouds.push({
                particle,
                yPercent: cfg.yPercent,
                duration: cfg.duration,
                delay: cfg.delay,
            });
        }
    }

    /**
     * Update cloud positions. Called from the Pixi ticker.
     * @param screenWidth Screen width in CSS pixels
     * @param containerTop Container Y position on screen (CSS pixels)
     */
    update(screenWidth: number, containerTop: number): void {
        if (this.startTime === 0) this.startTime = performance.now();
        const elapsed = (performance.now() - this.startTime) / 1000;

        const vw = screenWidth;
        const totalDistance = vw * 1.6;
        const startX = -100;

        for (const cloud of this.clouds) {
            const cycleTime = cloud.duration;
            const totalTime = elapsed - cloud.delay;

            let progress = (totalTime % cycleTime) / cycleTime;
            if (progress < 0) progress += 1;

            cloud.particle.x = startX + (totalDistance * progress);
            cloud.particle.y = cloud.yPercent * containerTop;
        }
    }
}
