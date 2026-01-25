import * as PIXI from 'pixi.js';
import { EffectParticle } from '../../types/GameObjects';

export class EffectRenderer {
    container: PIXI.Container;
    graphics: PIXI.Graphics;

    constructor(parent: PIXI.Container) {
        this.container = new PIXI.Container();
        this.graphics = new PIXI.Graphics();
        this.container.addChild(this.graphics);
        parent.addChild(this.container);

        // Z-Index: Effect Particles are usually on top of everything inside the game world
        // (RenderSystem will handle layer ordering by where it inserts this container)
    }

    render(particles: EffectParticle[]) {
        this.graphics.clear();

        if (particles.length === 0) return;

        for (const p of particles) {
            // Color Conversion
            // PIXI accepts 0xRRGGBB numbers or hex strings. 
            // Our EffectParticle.color is 'string | number'.
            const color = p.color;
            const alpha = p.alpha;

            if (p.type === 'star') {
                this.drawStar(p.x, p.y, p.size, color, alpha, p.rotation);
            }
            else if (p.type === 'bomb-ghost') {
                this.graphics.circle(p.x, p.y, p.size);
                this.graphics.fill({ color: 0x212121, alpha: alpha });
            }
            else {
                // Circle (default, suck, etc.)
                this.graphics.circle(p.x, p.y, p.size);
                this.graphics.fill({ color: color, alpha: alpha });
            }
        }
    }

    private drawStar(cx: number, cy: number, size: number, color: string | number, alpha: number, rotation: number) {
        const spikes = 5;
        const outerRadius = size;
        const innerRadius = size * 0.4;

        // We can draw manually using trig, or building a poly.
        // Graphics context doesn't have native 'rotate' for just one shape easily without matrix mess.
        // Manual trig is safest for batch drawing in one Graphics context.

        const path: number[] = [];

        for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (Math.PI * i) / spikes + rotation;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            path.push(x, y);
        }

        this.graphics.poly(path);
        this.graphics.fill({ color: color, alpha: alpha });
    }
}
