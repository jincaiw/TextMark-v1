#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then echo "usage: $0 TextMark.dmg" >&2; exit 2; fi
dmg=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
mount_dir=$(mktemp -d /tmp/textmark-dmg.XXXXXX)
sample=
thumbnail=
cleanup() {
  hdiutil detach "$mount_dir" -quiet >/dev/null 2>&1 || true
  [ -z "$sample" ] || rm -f "$sample"
  [ -z "$thumbnail" ] || rm -f "$thumbnail"
  rm -rf "$mount_dir"
}
trap cleanup EXIT INT TERM

hdiutil attach "$dmg" -nobrowse -readonly -mountpoint "$mount_dir" -quiet
app=$(find "$mount_dir" -maxdepth 1 -name 'TextMark.app' -print -quit)
test -n "$app"
appex="$app/Contents/PlugIns/TextMarkQuickLook.appex"
test -s "$appex/Contents/Resources/dist/preview.html"
test -x "$app/Contents/Resources/bin/tm"
test -x "$app/Contents/Resources/bin/text-mark"
test -s "$app/Contents/Resources/THIRD_PARTY_NOTICES.md"
plutil -lint "$appex/Contents/Info.plist"
codesign --verify --deep --strict "$app"
codesign --verify --deep --strict "$appex"
test "$(defaults read "$appex/Contents/Info" CFBundleShortVersionString)" = "0.3.0"

sample=$(mktemp -t textmark-cli.XXXXXX.md)
thumbnail=$(mktemp -t textmark-cli.XXXXXX.png)
printf '# TextMark CLI alias\n' > "$sample"
"$app/Contents/Resources/bin/tm" --thumbnail "$sample" "$thumbnail" 128
test -s "$thumbnail"

# The Xcode test host performs the actual Markdown/local-image render. Here we
# additionally ask Launch Services to accept the exact extension shipped in
# the mounted release bundle.
pluginkit -a "$appex"
pluginkit -m -A -D -v -i app.textmark.desktop.quicklook | grep -q 'app.textmark.desktop.quicklook'
pluginkit -r "$appex" || true
echo "TextMark DMG/Quick Look registration smoke passed."
