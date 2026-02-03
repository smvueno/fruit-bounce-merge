import { Particle } from '../../../types/GameObjects';

export class SpatialHash {
    private cellSize: number;
    private grid: Map<string, Particle[]>;
    private queryIds: Set<number>; // Reusable set for deduplication in queries if needed, though ID check is faster

    constructor(cellSize: number) {
        this.cellSize = cellSize;
        this.grid = new Map();
        this.queryIds = new Set();
    }

    /**
     * Clear the grid for the next frame
     */
    clear() {
        this.grid.clear();
    }

    /**
     * Add a particle to the grid cells it overlaps
     */
    insert(particle: Particle) {
        const startX = Math.floor((particle.x - particle.radius) / this.cellSize);
        const endX = Math.floor((particle.x + particle.radius) / this.cellSize);
        const startY = Math.floor((particle.y - particle.radius) / this.cellSize);
        const endY = Math.floor((particle.y + particle.radius) / this.cellSize);

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const key = `${x}:${y}`;
                if (!this.grid.has(key)) {
                    this.grid.set(key, []);
                }
                this.grid.get(key)!.push(particle);
            }
        }
    }

    /**
     * Retrieve potential colliders for a particle.
     * Note: This returns a list that may contain duplicates if a neighbor spans multiple cells.
     * The collision loop MUST handle duplicates (e.g. via ID check: p1.id < p2.id).
     */
    query(particle: Particle): Particle[] {
        const startX = Math.floor((particle.x - particle.radius) / this.cellSize);
        const endX = Math.floor((particle.x + particle.radius) / this.cellSize);
        const startY = Math.floor((particle.y - particle.radius) / this.cellSize);
        const endY = Math.floor((particle.y + particle.radius) / this.cellSize);

        const neighbors: Particle[] = [];

        // We don't dedupe here for performance (allocating a Set per query is slow).
        // Instead, we just dump everything into an array.
        // It is the caller's responsibility to filter processed pairs.

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const key = `${x}:${y}`;
                const cell = this.grid.get(key);
                if (cell) {
                    for (let i = 0; i < cell.length; i++) {
                        neighbors.push(cell[i]);
                    }
                }
            }
        }

        return neighbors;
    }
}
