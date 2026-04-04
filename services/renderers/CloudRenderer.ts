import * as PIXI from 'pixi.js';

/**
 * Renders animated clouds using Pixi.js v8 ParticleContainer.
 * Uses lightweight Particle objects — GPU instanced, 1 draw call.
 * 
 * Depth-based clouds: big/fast/bright (near) vs small/slow/dim (far).
 * Two cloud shapes: 3-ball and 2-ball.
 */
interface CloudData {
    particle: PIXI.Particle;
    speed: number;
    yPercent: number;
    startX: number;
    totalDistance: number;
}

interface CloudLayer {
    scale: number;
    alpha: number;
    speed: number;       // virtual units per second
    yPercent: number;    // 0=top of zone, 1=bottom of zone
    texIndex: number;    // 0=3-ball, 1=2-ball
}

export class CloudRenderer {
    private pc: PIXI.ParticleContainer;
    private clouds: CloudData[] = [];
    private textures: PIXI.Texture[] = [];
    private layers: CloudLayer[] = [];
    private startTime: number = 0;

    constructor(stage: PIXI.Container, renderer: PIXI.Renderer) {
        // Create cloud textures
        this.textures = this.createCloudTextures(renderer);

        // Define depth layers: near (big/fast) → far (small/slow)
        // Speeds halved for gentle, natural drift
        this.layers = [
            // Near layer — big, fast, bright, 3-ball
            { scale: 1.4, alpha: 0.65, speed: 55, yPercent: 0.15, texIndex: 0 },
            { scale: 1.1, alpha: 0.55, speed: 40, yPercent: 0.30, texIndex: 0 },
            // Mid layer — medium speed, 3-ball or 2-ball
            { scale: 0.8, alpha: 0.40, speed: 28, yPercent: 0.50, texIndex: 0 },
            { scale: 0.6, alpha: 0.30, speed: 20, yPercent: 0.70, texIndex: 1 },
            // Far layer — small, slow, dim, 2-ball
            { scale: 0.4, alpha: 0.20, speed: 14, yPercent: 0.85, texIndex: 1 },
        ];

        // ParticleContainer — only position is dynamic
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

        this.createClouds();
    }

    private createCloudTextures(renderer: PIXI.Renderer): PIXI.Texture[] {
        // 3-ball cloud
        const g3 = new PIXI.Graphics();
        g3.circle(0, -20, 20);
        g3.circle(30, -30, 28);
        g3.circle(60, -20, 20);
        g3.fill({ color: 0xFFFFFF });
        const t3 = renderer.generateTexture({ target: g3, resolution: 4, antialias: true });
        g3.destroy();

        // 2-ball cloud
        const g2 = new PIXI.Graphics();
        g2.circle(0, -15, 18);
        g2.circle(28, -25, 24);
        g2.fill({ color: 0xFFFFFF });
        const t2 = renderer.generateTexture({ target: g2, resolution: 4, antialias: true });
        g2.destroy();

        return [t3, t2];
    }

    private createClouds(): void {
        const vw = 1280; // base viewport width for initial placement

        for (const layer of this.layers) {
            const texture = this.textures[layer.texIndex];
            // 1 cloud per layer (5 total) — half the previous count
            const particle = new PIXI.Particle(texture);
            const startX = Math.random() * (vw + 200) - 100;

            particle.x = startX;
            particle.alpha = layer.alpha;
            particle.scaleX = layer.scale;
            particle.scaleY = layer.scale;

            this.pc.addParticle(particle);
            this.clouds.push({
                particle,
                speed: layer.speed,
                yPercent: layer.yPercent,
                startX,
                totalDistance: vw + 300,
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

        const speedFactor = screenWidth / 1280;

        for (const cloud of this.clouds) {
            const distance = cloud.speed * speedFactor * elapsed;
            const totalRange = cloud.totalDistance * speedFactor;

            let x = cloud.startX + (distance % totalRange);
            if (x > screenWidth + 100) x = -100;

            cloud.particle.x = x;
            cloud.particle.y = cloud.yPercent * containerTop;
        }
    }
}
