import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.join(__dirname, 'public', 'favicon.svg');
const outputDir = path.join(__dirname, 'public');

const icons = [
    { name: 'pwa-192x192.png', size: 192 },
    { name: 'pwa-512x512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 }
];

async function generatePWAIcons() {
    console.log('🎨 Generating PWA icons from favicon.svg...');

    if (!fs.existsSync(svgPath)) {
        console.error('❌ favicon.svg not found at:', svgPath);
        process.exit(1);
    }

    try {
        for (const icon of icons) {
            const outputPath = path.join(outputDir, icon.name);
            console.log(`PLEASE WAIT: Generating ${icon.size}x${icon.size} to ${icon.name}...`);

            await sharp(svgPath)
                .resize(icon.size, icon.size)
                .png()
                .toFile(outputPath);

            console.log(`✅ Generated ${icon.name}`);
        }
        console.log('🎉 All PWA icons generated successfully!');
    } catch (error) {
        console.error('❌ Error generating icons:', error);
        process.exit(1);
    }
}

generatePWAIcons();
