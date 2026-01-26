#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "========================================"
echo "    FRUITY FUSE: Flick & Bounce - Build & Test   "
echo "========================================"

# Clean up previous build
if [ -d "dist" ]; then
    echo "🧹 Cleaning previous build..."
    rm -rf dist
fi

echo "🏗️  Building application..."
npm run build

echo "✅ Build complete!"
echo ""
echo "========================================"
echo "    Starting Local Preview Server       "
echo "========================================"
echo "ℹ️  The app will be served at: http://localhost:4173/"
echo "ℹ️  Press Ctrl+C to stop the server"
echo ""

# Start the preview server
# Vite preview will automatically use the base from vite.config
npm run preview
