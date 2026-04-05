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
    private skySprite: PIXI.Sprite;
    private clouds: CloudData[] = [];
    private textures: PIXI.Texture[] = [];
    private layers: CloudLayer[] = [];
    private _skyTexture: PIXI.Texture | null = null;
    private _lastSkyWidth = 0;
    private _lastSkyHeight = 0;

    // 3-ball cloud width in local coords: 60+20=80, 2-ball: 28+24=52
    private readonly CLOUD_WIDTH_3 = 100;
    private readonly CLOUD_WIDTH_2 = 65;

    constructor(stage: PIXI.Container, renderer: PIXI.Renderer) {
        this.textures = this.createCloudTextures(renderer);

        // Depth layers: near (big/fast/bright) → far (small/slow/dimmer)
        this.layers = [
            { scale: 1.6, alpha: 0.85, speed: 55, yPercent: 0.10, texIndex: 0 },
            { scale: 1.3, alpha: 0.75, speed: 40, yPercent: 0.25, texIndex: 0 },
            { scale: 1.0, alpha: 0.65, speed: 28, yPercent: 0.40, texIndex: 0 },
            { scale: 0.8, alpha: 0.55, speed: 20, yPercent: 0.60, texIndex: 1 },
            { scale: 0.55, alpha: 0.45, speed: 14, yPercent: 0.80, texIndex: 1 },
        ];

        // Sky gradient backdrop (Sprite with canvas gradient texture)
        this.skySprite = new PIXI.Sprite();
        this.skySprite.zIndex = -210;
        stage.addChild(this.skySprite);

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
     * Update cloud positions and sky gradient.
     * @param screenWidth Screen width in CSS pixels
     * @param containerTop Container Y position on screen (CSS pixels)
     */
    update(screenWidth: number, containerTop: number): void {
        // Update sky gradient using canvas for proper gradient blending
        const gradientHeight = containerTop;
        if (gradientHeight > 0) {
            // Only recreate texture when size changes (avoid per-frame allocation)
            if (!this._skyTexture || this._lastSkyWidth !== screenWidth || this._lastSkyHeight !== gradientHeight) {
                if (this._skyTexture) this._skyTexture.destroy(true);

                const canvas = document.createElement('canvas');
                canvas.width = screenWidth;
                canvas.height = gradientHeight;
                const ctx = canvas.getContext('2d')!;

                // Smooth vertical gradient from dark blue (top) to transparent (bottom)
                const gradient = ctx.createLinearGradient(0, 0, 0, gradientHeight);
                gradient.addColorStop(0, 'rgba(37, 99, 235, 0.55)');     // #2563EB dark blue
                gradient.addColorStop(0.3, 'rgba(59, 130, 246, 0.35)');   // #3B82F6
                gradient.addColorStop(0.6, 'rgba(96, 165, 250, 0.18)');   // #60A5FA
                gradient.addColorStop(0.85, 'rgba(147, 197, 253, 0.06)'); // #93C5FD
                gradient.addColorStop(1, 'rgba(147, 197, 253, 0)');       // transparent

                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, screenWidth, gradientHeight);

                this._skyTexture = PIXI.Texture.from(canvas);
                this._lastSkyWidth = screenWidth;
                this._lastSkyHeight = gradientHeight;
            }

            this.skySprite.texture = this._skyTexture;
            this.skySprite.width = screenWidth;
            this.skySprite.height = gradientHeight;
            this.skySprite.visible = true;
        } else {
            this.skySprite.visible = false;
        }

        const speedFactor = screenWidth / 1280;

        for (const cloud of this.clouds) {
            cloud.particle.x += cloud.speed * speedFactor * (1 / 60);
            cloud.particle.y = cloud.yPercent * containerTop;

            if (cloud.particle.x > screenWidth + cloud.cloudWidth) {
                cloud.particle.x = -cloud.cloudWidth;
            }
        }
    }
}
