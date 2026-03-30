import re

with open('services/systems/RenderSystem.ts', 'r') as f:
    content = f.read()

# Replace drawFloor logic
new_draw_floor = """    drawFloor(width: number, height: number, scaleFactor: number, screenHeight: number, containerY: number, screenWidth: number) {
        this.floorGraphics.clear();

        // The game physics operates in a V_WIDTH x V_HEIGHT (600x750) logical space.
        // We draw the floor inside the scaled container so it aligns perfectly with the physics engine.

        // We want the floor to stretch far to the left and right to cover the whole screen,
        // regardless of the aspect ratio. So we'll use large static logical bounds.
        const startX = -2000;
        const endX = 2600; // 600 + 2000
        const bottomY = 2000; // Stretch far down
        const step = 5;

        if (Math.random() < 0.05) {
            console.log(`[drawFloor] Drawing wide floor from X: ${startX} to ${endX}`);
        }

        this.floorGraphics.moveTo(startX, bottomY);
        this.floorGraphics.lineTo(startX, this.getFloorY(startX, height));

        for (let x = startX; x <= endX; x += step) {
            this.floorGraphics.lineTo(x, this.getFloorY(x, height));
        }

        this.floorGraphics.lineTo(endX, this.getFloorY(endX, height));
        this.floorGraphics.lineTo(endX, bottomY);
        this.floorGraphics.closePath();

        // Fill and stroke
        this.floorGraphics.fill({ color: 0x76C043 });
        this.floorGraphics.stroke({ width: 6, color: 0x2E5A1C, alignment: 0 });

        // Decorations - keep relative to game area center
        this.floorGraphics.circle(50, height, 15);
        this.floorGraphics.circle(80, height + 20, 20);
        this.floorGraphics.fill({ color: 0x558B2F, alpha: 0.2 });
        this.floorGraphics.circle(width - 100, height, 25);
        this.floorGraphics.fill({ color: 0x558B2F, alpha: 0.2 });
    }"""

pattern = re.compile(r'\s*drawFloor\(.*?\)\s*\{.*?(?=\s*drawDangerLine)', re.DOTALL)
content = pattern.sub('\n' + new_draw_floor + '\n\n', content)

with open('services/systems/RenderSystem.ts', 'w') as f:
    f.write(content)
