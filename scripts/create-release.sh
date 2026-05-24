#!/bin/bash
# Script to create a release ZIP for Manga Downloader
# Usage: ./scripts/create-release.sh

VERSION=$(grep '"version"' manifest.json | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')
ZIP_NAME="manga-downloader-v${VERSION}.zip"
BUILD_DIR="build"

echo "📦 Creating release package for v${VERSION}..."

# Create build directory
mkdir -p $BUILD_DIR
cd $BUILD_DIR

# Copy only necessary files
echo "📋 Copying files..."
cp -r ../background . || exit 1
cp -r ../content . || exit 1
cp -r ../popup . || exit 1
cp -r ../config . || exit 1
cp -r ../icons . || exit 1
cp -r ../utils . || exit 1
cp ../manifest.json . || exit 1

# Create ZIP
echo "🔧 Creating ZIP file..."
zip -r -q "$ZIP_NAME" \
  background/ \
  content/ \
  popup/ \
  config/ \
  icons/ \
  utils/ \
  manifest.json

if [ -f "$ZIP_NAME" ]; then
  echo "✅ Release package created: $ZIP_NAME"
  echo "📊 File size: $(du -h "$ZIP_NAME" | cut -f1)"
  cd ..
  echo ""
  echo "📖 Next steps:"
  echo "1. Go to: https://github.com/seaflower205/manga-downloader/releases"
  echo "2. Click 'Draft a new release'"
  echo "3. Tag version: v${VERSION}"
  echo "4. Upload: build/${ZIP_NAME}"
else
  echo "❌ Failed to create ZIP file"
  exit 1
fi
