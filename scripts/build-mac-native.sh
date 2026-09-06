#!/bin/zsh
set -euo pipefail

project_dir="${0:A:h:h}"
version="$(cd "$project_dir" && node -p "require('./package.json').version")"
node_binary="${NODE_BINARY:-$(command -v node)}"
output_dir="$project_dir/desktop-dist"
app="$output_dir/Lux Link.app"
resources="$app/Contents/Resources"
staging="$output_dir/dmg-root"
dmg="$output_dir/Lux-Link-$version-mac-arm64.dmg"
trap 'rm -rf "$staging"' EXIT

if [[ "$(file "$node_binary")" != *arm64* ]]; then
  echo "NODE_BINARY must be an Apple silicon Node.js executable." >&2
  exit 1
fi

cd "$project_dir"
pnpm run desktop:web
rm -rf "$app" "$staging" "$dmg"
mkdir -p "$app/Contents/MacOS" "$resources/dashboard" "$staging"
/usr/bin/swiftc -target arm64-apple-macos13.0 native-mac/LuxLinkHost.swift -o "$app/Contents/MacOS/Lux Link" -framework AppKit -framework Foundation
cp native-mac/Info.plist "$app/Contents/Info.plist"
cp public/app-icon.icns public/app-icon.png "$resources/"
cp "$node_binary" "$resources/node"
cp scripts/native-server.cjs "$resources/server.cjs"
cp package.json "$resources/package.json"
cp -R electron lib "$resources/"
cp -R desktop-web/. "$resources/dashboard/"
chmod 755 "$app/Contents/MacOS/Lux Link" "$resources/node"
/usr/bin/codesign --force --deep --sign - "$app"
cp -R "$app" "$staging/"
ln -s /Applications "$staging/Applications"
/usr/bin/hdiutil create -volname "Lux Link $version" -size 250m -fs HFS+ -srcfolder "$staging" -ov -format UDZO "$dmg"
echo "$dmg"
