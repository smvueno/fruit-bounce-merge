import * as PIXI from 'pixi.js';
import { Particle } from '../../types/GameObjects';
import { SPAWN_Y_PERCENT } from '../../constants';

export interface InputContext {
    containerY: number;
    scaleFactor: number;
    width: number;
    height: number;
    paused: boolean;
    currentFruit: Particle | null;
    canDrop: boolean;
}

export interface DragResult {
    vx: number;
    vy: number;
}

export class InputSystem {
    isAiming: boolean = false;
    aimX: number = 0;
    dragAnchorX: number = 0;
    dragAnchorY: number = 0;
    pointerHistory: { x: number, y: number, time: number }[] = [];

    // Helper: Reset state
    reset() {
        this.isAiming = false;
        this.pointerHistory = [];
        this.dragAnchorX = 0;
        this.dragAnchorY = 0;
    }

    getVirtualPos(globalX: number, globalY: number, ctx: InputContext) {
        return {
            x: globalX / ctx.scaleFactor,
            y: (globalY - ctx.containerY) / ctx.scaleFactor
        };
    }

    onPointerDown(e: PIXI.FederatedPointerEvent, ctx: InputContext): boolean {
        if (ctx.paused) return false;
        if (!ctx.currentFruit || !ctx.canDrop) return false;

        this.isAiming = true;
        const p = this.getVirtualPos(e.global.x, e.global.y, ctx);
        this.updateAim(p.x, p.y, ctx);
        this.pointerHistory = [];
        return true; // Return true to indicate interaction started
    }

    onPointerMove(e: PIXI.FederatedPointerEvent, ctx: InputContext) {
        if (ctx.paused) return;
        if (!this.isAiming) return;
        const p = this.getVirtualPos(e.global.x, e.global.y, ctx);
        this.updateAim(p.x, p.y, ctx);
        const now = performance.now();
        this.pointerHistory.push({ x: p.x, y: p.y, time: now });
        if (this.pointerHistory.length > 8) this.pointerHistory.shift();
    }

    onPointerUp(e: PIXI.FederatedPointerEvent, ctx: InputContext): DragResult | null {
        if (ctx.paused) return null;
        if (!this.isAiming || !ctx.currentFruit) return null;

        this.isAiming = false;
        let vx = 0;
        let vy = 0;

        if (this.pointerHistory.length >= 2) {
            const newest = this.pointerHistory[this.pointerHistory.length - 1];
            const oldest = this.pointerHistory[0];
            const dt = newest.time - oldest.time;
            if (dt > 0) {
                // BOOSTED THROW POWER! (Was 15, GameEngine has 22)
                vx = (newest.x - oldest.x) / dt * 22;
                vy = (newest.y - oldest.y) / dt * 22;
            }
        }
        const maxSpeed = 40; // INCREASED MAX SPEED
        const len = Math.sqrt(vx * vx + vy * vy);
        if (len > maxSpeed) {
            vx = (vx / len) * maxSpeed;
            vy = (vy / len) * maxSpeed;
        }
        if (vy < -15) vy = -15;

        return { vx, vy };
    }

    updateAim(x: number, y: number, ctx: InputContext) {
        const r = ctx.currentFruit ? ctx.currentFruit.radius : 20;
        this.aimX = Math.max(r, Math.min(ctx.width - r, x));
        this.dragAnchorX = this.aimX;
        this.dragAnchorY = (ctx.height * SPAWN_Y_PERCENT) + (Math.min(y, ctx.height * 0.4) - ctx.height * 0.2) * 0.1;
    }
}
