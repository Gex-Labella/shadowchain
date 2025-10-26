ona#!/bin/bash

# Shadow Chain Shared Crypto Build Script

echo "🔧 Building @shadowchain/crypto module..."

# Clean previous build
echo "📦 Cleaning previous build..."
rm -rf dist/

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build TypeScript
echo "🔨 Compiling TypeScript..."
npm run build

# Check if build was successful
if [ -d "dist" ] && [ -f "dist/index.js" ]; then
    echo "✅ Build successful!"
    echo "📁 Output in: dist/"
    ls -la dist/
else
    echo "❌ Build failed!"
    echo "Please check for TypeScript errors."
    exit 1
fi

echo "🎉 @shadowchain/crypto module is ready!"