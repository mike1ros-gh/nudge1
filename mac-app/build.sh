#!/bin/bash
# Builds Nudge1.app from source. Run this after cloning the repo, from
# anywhere — it locates itself and writes the finished app next to this
# script. macOS only, needs the Xcode Command Line Tools (swiftc, iconutil,
# codesign — run `xcode-select --install` first if you don't have them).
#
# If site-url.txt exists next to this script (one line, the deployed
# web app's URL), it gets bundled in and the app opens straight to it —
# no manual entry needed. Without it, the app asks on first launch.
#
# Usage: ./build.sh
# Then:  open Nudge1.app   (or drag it into /Applications)

set -euo pipefail
cd "$(dirname "$0")"

echo "Building app icon..."
swiftc gen_icon.swift -o /tmp/nudge1_gen_icon
rm -rf AppIcon.iconset AppIcon.icns
/tmp/nudge1_gen_icon AppIcon.iconset
iconutil -c icns AppIcon.iconset -o AppIcon.icns

echo "Compiling..."
rm -rf Nudge1.app
mkdir -p Nudge1.app/Contents/MacOS Nudge1.app/Contents/Resources
swiftc main.swift -o Nudge1.app/Contents/MacOS/Nudge1
cp Info.plist Nudge1.app/Contents/Info.plist
cp AppIcon.icns Nudge1.app/Contents/Resources/AppIcon.icns
if [ -f site-url.txt ]; then
  cp site-url.txt Nudge1.app/Contents/Resources/site-url.txt
  echo "Bundled site-url.txt — app will open straight to it, no prompt."
fi
# Bake in the actual repo path, whatever it's called and wherever it was
# cloned to — the worker is launched from here, so this can't be guessed.
(cd .. && pwd) > Nudge1.app/Contents/Resources/project-dir.txt

echo "Signing..."
codesign --force --deep -s - Nudge1.app

echo ""
echo "Done — mac-app/Nudge1.app is ready."
echo "Open it, or drag it into /Applications."
