import * as PIXI from 'pixi.js';

/**
 * Renders animated clouds using Pixi.js v8 ParticleContainer.
 * Uses lightweight Particle objects — GPU instanced, 1 draw call.
 * 
 * Depth-based clouds: big/fast/bright (near) vs small/slow/dim (far).
 * Two cloud shapes: 3-ball and 2-ball.
 * Clouds spawn off-screen left, drift right, and respawn off-screen when fully off-screen right.
 */
interface CloudData {
    particle: PIXI.Particle;
    speed: number;
    yPercent: number;
    cloudWidth: number;
}

interface CloudLayer {
    scale: number;
    alpha: number;
    speed: number;       // pixels per second at 1280px width
    yPercent: number;    // 0=top of zone, 1=bottom of zone
    texIndex: number;    // 0=3-ball, 1=2-ball
}

export class CloudRenderer {
    private pc: PIXI.ParticleContainer;
    private clouds: CloudData[] = [];
    private textures: PIXI.Texture[] = [];
    private layers: CloudLayer[] = [];

    // 3-ball cloud width in local coords: 60+20=80, 2-ball: 28+24=52
    private readonly CLOUD_WIDTH_3 = 100;
    private readonly CLOUD_WIDTH_2 = 65;

    constructor(stage: PIXI.Container, renderer: PIXI.Renderer) {
        this.textures = this.createCloudTextures(renderer);

        // Depth layers: near (big/fast) → far (small/slow)
        this.layers = [
            { scale: 1.4, alpha: 0.65, speed: 55, yPercent: 0.15, texIndex: 0 },
            { scale: 1.1, alpha: 0.55, speed: 40, yPercent: 0.30, texIndex: 0 },
            { scale: 0.8, alpha: 0.40, speed: 28, yPercent: 0.50, texIndex: 0 },
            { scale: 0.6, alpha: 0.30, speed: 20, yPercent: 0.70, texIndex: 1 },
            { scale: 0.4, alpha: 0.20, speed: 14, yPercent: 0.85, texIndex: 1 },
        ];

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
        const g3 = new PIXI.Graphics();
        g3.circle(0, -20, 20);
        g3.circle(30, -30, 28);
        g3.circle(60, -20, 20);
        g3.fill({ color: 0xFFFFFF });
        const t3 = renderer.generateTexture({ target: g3, resolution: 4, antialias: true });
        g3.destroy();

        const g2 = new PIXI.Graphics();
        g2.circle(0, -15, 18);
        g2.circle(28, -25, 24);
        g2.fill({ color: 0xFFFFFF });
        const t2 = renderer.generateTexture({ target: g2, resolution: 4, antialias: true });
        g2.destroy();

        return [t3, t2];
    }

    private createClouds(): void {
        const vw = 1280;

        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i];
            const texture = this.textures[layer.texIndex];
            const cloudWidth = layer.texIndex === 0 ? this.CLOUD_WIDTH_3 : this.CLOUD_WIDTH_2;
            const scaledWidth = cloudWidth * layer.scale;

            const particle = new PIXI.Particle(texture);
            particle.alpha = layer.alpha;
            particle.scaleX = layer.scale;
            particle.scaleY = layer.scale;

            // Spread initial X positions across the screen + off-screen left
            // Stagger so they don't all start at the same position
            const stagger = (vw + scaledWidth * 2) / this.layers.length;
            particle.x = -scaledWidth + (i * stagger);

            this.pc.addParticle(particle);
            this.clouds.push({
                particle,
                speed: layer.speed,
                yPercent: layer.yPercent,
                cloudWidth: scaledWidth,
            });
        }
    }

    /**
     * Update cloud positions. Called from the Pixi ticker.
     * Clouds drift right continuously. When fully off-screen right, respawn off-screen left.
     */
    update(screenWidth: number, containerTop: number, _deltaMs?: number): void {
        const speedFactor = screenWidth / 1280;

        for (const cloud of this.clouds) {
            cloud.particle.x += cloud.speed * speedFactor * (1 / 60); // per-frame at 60fps
            cloud.particle.y = cloud.yPercent * containerTop;

            // Respawn off-screen left when fully off-screen right
            if (cloud.particle.x > screenWidth + cloud.cloudWidth) {
                cloud.particle.x = -cloud.cloudWidth;
            }
        }
    }
}
