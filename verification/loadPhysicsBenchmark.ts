import { PhysicsSystem } from '../services/systems/PhysicsSystem';
import { Particle } from '../types/GameObjects';
import { FRUIT_DEFS } from '../services/fruitConfig';

export function runPhysicsBenchmark(): Promise<number> {
    return new Promise((resolve) => {
        console.log("Starting Physics Benchmark...");

        const physics = new PhysicsSystem();
        const fruits: Particle[] = [];
        const width = 600;
        const height = 800;

        // Spawn 50 particles
        for (let i = 0; i < 50; i++) {
            const def = FRUIT_DEFS[i % 5];
            const p = new Particle(
                Math.random() * width,
                Math.random() * height * 0.5,
                def,
                i
            );
            fruits.push(p);
        }

        const ctx: any = {
            fruits,
            activeTomatoes: [],
            activeBombs: [],
            celebrationEffect: null,
            currentFruit: null,
            isAiming: false,
            dragAnchorX: 0,
            dragAnchorY: 0,
            width,
            height
        };

        const callbacks: any = {
            onMerge: () => { },
            onBombExplosion: () => { },
            onTomatoCollision: () => { },
            onCelebrationMatch: () => { }
        };

        let totalTime = 0;
        const frames = 500;

        for (let f = 0; f < frames; f++) {
            const start = performance.now();
            physics.update(16, ctx, callbacks);
            const end = performance.now();
            totalTime += (end - start);
        }

        const avg = totalTime / frames;
        console.log(`Physics Benchmark Complete. Average: ${avg.toFixed(3)}ms per frame.`);
        resolve(avg);
    });
}

// Expose to window for Playwright
(window as any).runPhysicsBenchmark = runPhysicsBenchmark;
