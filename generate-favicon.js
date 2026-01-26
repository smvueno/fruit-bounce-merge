#!/usr/bin/env node

/**
 * Generate favicon.ico from SVG
 * Uses sharp to convert SVG to PNG at multiple sizes, then png-to-ico to create .ico
 */

import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [16, 32, 48, 64];
const svgPath = path.join(__dirname, 'public', 'favicon.svg');
const outputDir = path.join(__dirname, 'public');

async function generateFavicon() {
    console.log('🎨 Generating favicon from Rainbow Star...');

    // Check if SVG exists
    if (!fs.existsSync(svgPath)) {
        console.error('❌ favicon.svg not found at:', svgPath);
        process.exit(1);
    }

    try {
        // Generate PNG files at different sizes
        const pngBuffers = [];

        for (const size of sizes) {
            console.log(`📐 Generating ${size}x${size} PNG...`);
            const buffer = await sharp(svgPath)
                .resize(size, size, {
                    kernel: sharp.kernel.lanczos3,
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .png({
                    compressionLevel: 9,
                    adaptiveFiltering: true,
                    force: true
                })
                .toBuffer();

            pngBuffers.push(buffer);
        }

        // Convert PNGs to ICO
        console.log('🔧 Converting to .ico format...');
        const icoBuffer = await pngToIco(pngBuffers);

        // Write favicon.ico
        const icoPath = path.join(outputDir, 'favicon.ico');
        fs.writeFileSync(icoPath, icoBuffer);

        console.log('✅ favicon.ico created successfully at:', icoPath);
        console.log(`📦 Sizes included: ${sizes.join(', ')} pixels`);

    } catch (error) {
        console.error('❌ Error generating favicon:', error.message);
        process.exit(1);
    }
}

generateFavicon();
