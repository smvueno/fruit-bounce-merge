#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "========================================"
echo "    Fruit Bounce Merge - Build & Test   "
echo "========================================"

# Clean up previous build
if [ -d "docs" ]; then
    echo "🧹 Cleaning previous build..."
    rm -rf docs
fi

# Run the build process
echo "🏗️  Building application..."
npm run build

echo "✅ Build complete!"
echo ""
echo "========================================"
echo "    Starting Local Preview Server       "
echo "========================================"
echo "ℹ️  The app will be served at: http://localhost:4173/fruit-bounce-merge/"
echo "ℹ️  Press Ctrl+C to stop the server"
echo ""

# Start the preview server with the correct base path configuration
# We pass --base to ensure assets load correctly locally
npm run preview -- --base=/fruit-bounce-merge/
