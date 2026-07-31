#!/bin/bash
set -e

# Ensure we run from the directory containing this script
cd "$(dirname "$0")"

# Target directories
PUBLISH_DIR="bin/Release/net10.0/osx-x64/publish"
APP_NAME="InventorySystem"
APP_DIR="bin/Release/net10.0/osx-x64/${APP_NAME}.app"
CONTENTS_DIR="${APP_DIR}/Contents"
MACOS_DIR="${CONTENTS_DIR}/MacOS"
RESOURCES_DIR="${CONTENTS_DIR}/Resources"

echo "Packaging macOS App Bundle: ${APP_DIR}"

# Clean up any existing app bundles first to prevent recursive nesting or stale files
rm -rf "${APP_DIR}"
rm -rf "${PUBLISH_DIR}/${APP_NAME}.app"
rm -rf "${PUBLISH_DIR}/InventorySystem.app"

# Create bundle directory structure
mkdir -p "${MACOS_DIR}"
mkdir -p "${RESOURCES_DIR}"

# Copy all files into MacOS directory
cp -R "${PUBLISH_DIR}/" "${MACOS_DIR}/"

# Copy icon
if [ -f "AppIcon.icns" ]; then
    cp "AppIcon.icns" "${RESOURCES_DIR}/AppIcon.icns"
fi

# Write Info.plist
cat <<EOF > "${CONTENTS_DIR}/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>Desktop</string>
    <key>CFBundleIdentifier</key>
    <string>com.inventory.desktop</string>
    <key>CFBundleName</key>
    <string>Single-Store Inventory System</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon.icns</string>
</dict>
</plist>
EOF

# Ensure the main executable has correct execution permissions
chmod +x "${MACOS_DIR}/Desktop"

echo "Done! You can double-click ${APP_DIR} to run the app without a terminal."
