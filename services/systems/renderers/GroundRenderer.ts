import * as PIXI from 'pixi.js';

export class GroundRenderer {
    container: PIXI.Container;
    graphics: PIXI.Graphics;

    constructor(container: PIXI.Container) {
        this.container = container;
        this.graphics = new PIXI.Graphics();
        this.container.addChild(this.graphics);
    }

    draw(width: number, height: number, scaleFactor: number, screenHeight: number, containerY: number, containerLeft: number, screenWidth: number) {
        this.graphics.clear();

        // Match GroundCanvas.tsx math
        // V_WIDTH = 600
        // virtualFloorOffset = 15

        // In Pixi, 'height' passed here is usually the logical game height (e.g. 800)
        // 'containerY' is the vertical offset of the game container.

        // We need to fill the entire screen background with green, 
        // ensuring the wave matches the physics floor.

        // From GroundCanvas.tsx:
        // const gameFloorY = containerTop + gameAreaHeight - gameFloorOffset;
        // where gameFloorOffset = 15 * scaleFactor;

        // In our Pixi setup, the 'gameContainer' is centered.
        // The backgroundContainer is separate (at 0,0).
        // So we need to calculate where the floor should be relative to the screen (0,0).

        // The floor in the game logic is at Y = 800 (height of game).
        // But there is a conceptual "floor line" at height - 15 in virtual coords?
        // Wait, GroundCanvas says: "The floor is at height - 15 in VIRTUAL coordinates."

        // Let's rely on the coordinate system passed to us.
        // RenderSystem.drawFloor was passing 'height' which seemed to be the game height.

        // To match visual parity EXACTLY, let's look at the wave function:
        // const getVirtualFloorOffset = (virtualX: number): number => {
        //     return Math.sin(virtualX * 0.015) * 10 + Math.cos(virtualX * 0.04) * 5;
        // };

        // We need to expand this to cover the whole screen width.
        // We need to know the 'virtualX' for every screen pixel X.

        // Screen X to Virtual X:
        // Virtual 0 is at containerLeft.
        // So: VirtualX = (ScreenX - containerLeft) / scaleFactor

        // Calculate Game Floor Y in Screen Coordinates
        // The game area ends at 'containerY + height * scaleFactor' roughly?
        // Actually, 'containerY' in RenderSystem usage seems to be the top of the game container?
        // Let's verify how RenderSystem is called. 
        // But assuming 'containerY' is the top of the game in screen pixels:
        // gameFloorY (screen) = containerY + height * scaleFactor - (15 * scaleFactor)

        const virtualFloorOffset = 15;
        // const gameFloorOffset = virtualFloorOffset * scaleFactor;

        // We need the vertical position of the game bottom on screen.
        // existing gameContainer is centered.
        // Height of game is 'height' (virtual).
        const gameHeightScreen = height * scaleFactor;
        const gameBottomScreen = containerY + gameHeightScreen;

        // Adjust for the 15px virtual floor offset
        const floorBaseYScreen = gameBottomScreen - (virtualFloorOffset * scaleFactor);

        // Draw Logic
        // We iterate across the screen width.
        const step = 5;

        this.graphics.beginPath();
        this.graphics.moveTo(0, screenHeight); // Bottom Left
        this.graphics.lineTo(0, floorBaseYScreen); // Start of wave (approx)

        // Wave loop
        for (let x = 0; x <= screenWidth; x += step) {
            // Convert Screen X to Virtual X relative to game
            const virtualX = (x - containerLeft) / scaleFactor;

            // Calculate Wave Offset (Virtual)
            const waveOffsetVirtual = Math.sin(virtualX * 0.015) * 10 + Math.cos(virtualX * 0.04) * 5;

            // Convert to Screen Offset
            const waveOffsetScreen = waveOffsetVirtual * scaleFactor;

            // Final Y
            const y = floorBaseYScreen + waveOffsetScreen;

            if (x === 0) this.graphics.moveTo(x, y);
            else this.graphics.lineTo(x, y);
        }

        this.graphics.lineTo(screenWidth, screenHeight); // Bottom Right
        this.graphics.lineTo(0, screenHeight); // Close loop
        this.graphics.closePath();

        // Fill
        this.graphics.fill({ color: 0x76C043 });

        // Stroke (Stroke only top edge)
        // Pixi Graphics doesn't support 'stroke top only' easily on a shape.
        // We should draw the line separately or stroke the shape and mask the bottom?
        // GroundCanvas draws the fill, then strokes a line on top.

        this.graphics.stroke({ width: 0 }); // Clear stroke on the shape

        // Draw the top line separately
        this.graphics.beginPath();
        for (let x = 0; x <= screenWidth; x += step) {
            // VirtualX = (x - containerLeft) / scaleFactor
            const virtualX = (x - containerLeft) / scaleFactor;

            const waveOffsetVirtual = Math.sin(virtualX * 0.015) * 10 + Math.cos(virtualX * 0.04) * 5;
            const waveOffsetScreen = waveOffsetVirtual * scaleFactor;
            const y = floorBaseYScreen + waveOffsetScreen;

            if (x === 0) this.graphics.moveTo(x, y);
            else this.graphics.lineTo(x, y);
        }
        this.graphics.stroke({ width: 4, color: 0x2E5A1C, cap: 'round', join: 'round' });


        // Decorations (Circles) from GroundCanvas.tsx
        // addDecoration(containerLeft + 50, gameFloorY, 15);
        // addDecoration(containerLeft + 80, gameFloorY + 20, 20);
        // addDecoration(containerLeft + gameAreaWidth - 100, gameFloorY, 25);

        // containerLeft corresponds to gameTopLeftScreenX;
        const gameLeftScreen = containerLeft;
        const gameWidthScreen = width * scaleFactor; // 600 * scaleFactor

        const drawDeco = (x: number, y: number, r: number) => {
            // x, y, r are in Screen Coords (or relative to game?)
            // GroundCanvas arguments:
            // x is relative to screen (containerLeft + offset)
            // y is gameFloorY

            // Our Y needs to follow the wave? 
            // GroundCanvas: addDecoration(containerLeft + 50, gameFloorY, 15);
            // It uses rigid Y (gameFloorY). It does NOT follow the wave for decorations.

            this.graphics.beginPath();
            this.graphics.circle(x, y, r);
            this.graphics.fill({ color: 0x558B2F, alpha: 0.2 });
        };

        // Left decorations
        drawDeco(gameLeftScreen + 50 * scaleFactor, floorBaseYScreen, 15 * scaleFactor);
        drawDeco(gameLeftScreen + 80 * scaleFactor, floorBaseYScreen + 20 * scaleFactor, 20 * scaleFactor);

        // Right decorations
        drawDeco(gameLeftScreen + gameWidthScreen - (100 * scaleFactor), floorBaseYScreen, 25 * scaleFactor);

        // Extended areas (Screen wider than game)
        if (gameLeftScreen > 100 * scaleFactor) {
            drawDeco(50 * scaleFactor, floorBaseYScreen + 10 * scaleFactor, 18 * scaleFactor);
        }
        if (screenWidth - (gameLeftScreen + gameWidthScreen) > 100 * scaleFactor) {
            drawDeco(screenWidth - 50 * scaleFactor, floorBaseYScreen + 10 * scaleFactor, 18 * scaleFactor);
        }
    }
}
