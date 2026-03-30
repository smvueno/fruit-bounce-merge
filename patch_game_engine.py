import re

with open('services/GameEngine.ts', 'r') as f:
    content = f.read()

# Make handleResize correctly render the floor using PIXI's ticker or manually.
new_handle_resize = """    handleResize() {
        if (!this.app || !this.app.screen || !this.container) return;

        const actualW = this.app.screen.width;
        const actualH = this.app.screen.height;

        // Determine logical scale to fit within viewport.
        const maxGameWidth = Math.min(actualW * 0.95, 600); // Max logical width 600
        const maxGameHeight = actualH * 0.75; // Leave 25% height for UI

        // Ensure scale is constrained
        this.scaleFactor = Math.min(maxGameWidth / V_WIDTH, maxGameHeight / V_HEIGHT);

        // Force minimum scale to ensure it isn't tiny on extreme screens
        this.scaleFactor = Math.max(this.scaleFactor, 0.4);

        // Apply scale to PIXI Container
        this.container.scale.set(this.scaleFactor);

        const logicalW = V_WIDTH * this.scaleFactor;
        const logicalH = V_HEIGHT * this.scaleFactor;

        // Position Container in center
        const xOffset = (actualW - logicalW) / 2;
        const yOffset = (actualH - logicalH) / 2 + (actualH * 0.05);

        this.container.position.set(xOffset, yOffset);

        console.log(`[handleResize] Drawing floor: w=${this.width}, h=${this.height}, scale=${this.scaleFactor}`);

        // Update floor (since we just resized, we redraw once rather than doing it every frame)
        this.renderSystem.drawFloor(
            this.width,
            this.height,
            this.scaleFactor,
            this.app.screen.height,
            this.container.y,
            this.app.screen.width
        );
    }"""

# Safely replace just the handleResize block
pattern = re.compile(r'\s*handleResize\(\)\s*\{[^{}]*(?:{[^{}]*}[^{}]*)*\s*\}', re.DOTALL)
content = pattern.sub('\n' + new_handle_resize + '\n\n', content, count=1)

with open('services/GameEngine.ts', 'w') as f:
    f.write(content)
