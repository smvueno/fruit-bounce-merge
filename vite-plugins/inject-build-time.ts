import fs from 'fs';
import path from 'path';
import { Plugin } from 'vite';

/**
 * Vite plugin to inject build timestamp into service worker
 * Replaces {{BUILD_TIME}} with actual timestamp
 */
export function injectBuildTime(): Plugin {
    return {
        name: 'inject-build-time',
        apply: 'build',
        closeBundle() {
            const buildTime = Date.now().toString();
            const swPath = path.resolve(__dirname, '../dist/sw.js');

            if (fs.existsSync(swPath)) {
                let content = fs.readFileSync(swPath, 'utf-8');
                content = content.replace(/\{\{BUILD_TIME\}\}/g, buildTime);
                fs.writeFileSync(swPath, content, 'utf-8');
                console.log(`✅ Injected build time ${buildTime} into service worker`);
            } else {
                console.warn('⚠️  Service worker not found at:', swPath);
            }
        }
    };
}
