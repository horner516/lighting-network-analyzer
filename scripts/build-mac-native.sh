#!/bin/zsh
set -euo pipefail

project_dir="${0:A:h:h}"
version="$(cd "$project_dir" && node -p "require('./package.json').version")"
node_binary="${NODE_BINARY:-$(command -v node)}"
output_dir="$project_dir/desktop-dist"
app="$output_dir/Lux Link.app"
resources="$app/Contents/Resources"
reader_app="$resources/MA Web Remote Reader.app"
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
mkdir -p "$reader_app/Contents/MacOS"
/usr/bin/clang -fobjc-arc -mmacosx-version-min=13.0 native-mac/MAWebRemoteReader.m -o "$reader_app/Contents/MacOS/MA Web Remote Reader" -framework AppKit -framework Foundation -framework Vision -framework WebKit
cp native-mac/Info.plist "$app/Contents/Info.plist"
cp public/app-icon.icns public/app-icon.png "$resources/"
cp "$node_binary" "$resources/node"
cp scripts/native-server.cjs "$resources/server.cjs"
cp package.json "$resources/package.json"
mkdir -p "$resources/electron" "$resources/lib"
for source in electron/*.cjs; do
  case "${source:t}" in
    fixture-output.cjs|mvr-fixtures.cjs) continue ;;
  esac
  cp "$source" "$resources/electron/"
done
cp -R lib/. "$resources/lib/"
cp -R desktop-web/. "$resources/dashboard/"
cp native-mac/MAWebRemoteReader-Info.plist "$reader_app/Contents/Info.plist"
chmod 755 "$app/Contents/MacOS/Lux Link" "$resources/node" "$reader_app/Contents/MacOS/MA Web Remote Reader"
/usr/bin/codesign --force --deep --sign - "$app"
cp -R "$app" "$staging/"
ln -s /Applications "$staging/Applications"
/usr/bin/hdiutil create -volname "Lux Link $version" -size 250m -fs HFS+ -srcfolder "$staging" -ov -format UDZO "$dmg"
echo "$dmg"
