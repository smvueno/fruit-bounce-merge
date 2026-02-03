import * as PIXI from 'pixi.js';
import { EffectParticle } from '../../../types/GameObjects';

export class EffectRenderer {
    container: PIXI.Container;
    textures: Record<string, PIXI.Texture>;
    pool: PIXI.Sprite[] = [];
    activeSprites: PIXI.Sprite[] = [];

    constructor(container: PIXI.Container, textures: Record<string, PIXI.Texture>) {
        this.container = container;
        this.textures = textures;
    }

    render(particles: EffectParticle[]) {
        // 1. Reset all currently active sprites to pool
        // We could optimize this by only adding/removing diff, but full reset is safer and fast enough for sprites.
        // Actually, for a pool, we usually iterate and assign.

        let poolIndex = 0;

        // Hide/Remove all current children?
        // Better: Reuse current children if possible, or use a separate list.

        // Strategy:
        // Use 'poolIndex' to track assigned sprites.
        // If we need more, grab from pool or create new.
        // If we have excess, hide them.

        for (const p of particles) {
            let sprite: PIXI.Sprite;

            if (poolIndex < this.container.children.length) {
                sprite = this.container.children[poolIndex] as PIXI.Sprite;
                sprite.visible = true;
            } else {
                // Check pool extension (if we removed them from container previously)
                // But generally keeping them in container and toggling visibility is fastest for Pixi?
                // Or removing from parent is better for large numbers of inactive?
                // TASKS.md says: If inactive: sprite.visible = false.

                // So we assume container.children IS the pool?
                // But we need to switch textures.

                sprite = new PIXI.Sprite();
                sprite.anchor.set(0.5);
                this.container.addChild(sprite);
            }

            // Update Sprite
            const textureKey = this.getTextureKey(p.type);
            if (this.textures[textureKey]) {
                sprite.texture = this.textures[textureKey];
            }

            // Apply Properties
            // Particles are in VIRTUAL coordinates.
            // GameEngine/RenderSystem usually handles the container scaling.
            // THIS EffectRenderer is attached to 'effectContainer'.
            // 'effectContainer' is a child of 'rootContainer'.
            // 'gameContainer' is scaled and centered.
            // 'effectContainer' is likely NOT scaled by default in GameEngine?

            // Checking GameEngine:
            // this.gameContainer.scale.set(this.scaleFactor);
            // this.gameContainer.position.set(...)
            // this.effectContainer is added to rootContainer, but handleResize() ONLY scales gameContainer!

            // This is a disconnect. TASKS.md Task 1.1 says: "Apply scaleFactor ONLY to this.gameContainer".
            // So 'effectContainer' is 1:1 with screen pixels (or root logic).
            // BUT GameEngine passes 'scaleFactor' to RenderContext.

            // EffectCanvas.ts handled manual scaling:
            // drawX = globalOffsetX + (p.x * scale);
            // where globalOffsetX = canvasLeft + offsetX;

            // Since EffectRenderer is inside 'effectContainer' which is at (0,0) of Root (Screen 1:1),
            // We need to manually project the particle positions onto the screen.

            // Wait, if GameEngine moves gameContainer, the effects should probably move with it?
            // Task 1.1: "Center this.gameContainer within this.rootContainer".

            // If effects are spawned at "Game Coordinates", we need to transform them.
            // Ideally, 'effectContainer' should just be a child of 'gameContainer' to inherit transform?
            // "Task 1.2: Update RenderSystem... Store references... Ensure Z-Order: Background -> Game -> Effects".
            // If Effects is a sibling of Game, we need to match transform.

            // OR we can set effectContainer's transform to match gameContainer's in RenderSystem?
            // That would be cleanest.

            // Let's assume RenderSystem updates effectContainer transform or we do it here.
            // But 'EffectRenderer.render' just takes particles.
            // Let's assume coordinates need to be local to effectContainer.

            // If 'effectContainer' is aligned with 'gameContainer', then p.x/p.y work directly.
            // If 'effectContainer' is Screen Space, we need to scale/translate.

            // Let's check RenderSystem/GameEngine logic.
            // GameEngine.handleResize only touches gameContainer.

            // I will update RenderSystem logic to sync effectContainer transform OR 
            // I will handle projection here.

            // TASKS.md says: "Visual particles (stars, ghosts) appear exactly where fruits merge."

            // I'll make EffectRenderer assume coordinates are local to Game Area, 
            // and I will ensure effectContainer is transformed to match Game Area in RenderSystem.

            sprite.x = p.x;
            sprite.y = p.y;
            sprite.width = p.size * 2; // Size is radius? EffectCanvas: drawSize = p.size * scale. ctx.arc(..., drawSize).
            // Canvas arc radius = drawSize. Sprite width = radius * 2?
            // p.size seems to be radius in Canvas. "ctx.arc(..., p.size, ...)"
            // So width/height = p.size * 2.

            sprite.height = p.size * 2;
            sprite.rotation = p.rotation;
            sprite.alpha = p.alpha;

            if (p.color) {
                // Sprite tint? Canvas uses fillStyle.
                // If texture is white, tint works.
                sprite.tint = p.color;
            } else {
                sprite.tint = 0xFFFFFF;
            }

            poolIndex++;
        }

        // Hide remaining
        for (let i = poolIndex; i < this.container.children.length; i++) {
            this.container.children[i].visible = false;
        }
    }

    getTextureKey(type: string): string {
        // Map 'star', 'bomb-ghost' to keys
        // TASKS.md mentions 'Star', 'Circle', 'Glow'.
        // EffectCanvas uses 'star', 'bomb-ghost', else Circle.

        switch (type) {
            case 'star': return 'star';
            case 'bomb-ghost': return 'circle'; // Fallback or specific? Canvas draws a filled circle for bomb-ghost!
            default: return 'circle'; // Default to circle
        }
    }
}
