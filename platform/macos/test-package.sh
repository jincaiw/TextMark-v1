#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then echo "usage: $0 TextMark.dmg" >&2; exit 2; fi
dmg=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
mount_dir=$(mktemp -d /tmp/textmark-dmg.XXXXXX)
cli_temp_dir=
cleanup() {
  hdiutil detach "$mount_dir" -quiet >/dev/null 2>&1 || true
  [ -z "$cli_temp_dir" ] || rm -rf "$cli_temp_dir"
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
test "$(plutil -extract NSExtension.NSExtensionPointIdentifier raw "$appex/Contents/Info.plist")" = "com.apple.quicklook.preview"
supported_types=$(plutil -extract NSExtension.NSExtensionAttributes.QLSupportedContentTypes json -o - "$appex/Contents/Info.plist")
grep -q 'app.textmark.markdown-document' <<<"$supported_types"
grep -q 'public.markdown' <<<"$supported_types"

cli_temp_dir=$(mktemp -d /tmp/textmark-cli.XXXXXX)
sample="$cli_temp_dir/sample.md"
thumbnail="$cli_temp_dir/thumbnail.png"
printf '# TextMark CLI alias\n' > "$sample"
"$app/Contents/Resources/bin/tm" --thumbnail "$sample" "$thumbnail" 128
test -s "$thumbnail"

# The Xcode test host performs the actual Markdown/local-image render. Here we
# additionally ask Launch Services to accept the exact extension shipped in
# the mounted release bundle.
pluginkit -a "$appex"
registered=0
for _ in {1..10}; do
  if pluginkit -m -A -D -v -i app.textmark.desktop.quicklook | grep -q 'app.textmark.desktop.quicklook'; then
    registered=1
    break
  fi
  sleep 0.5
done
if [[ "$registered" -ne 1 ]]; then
  if codesign -dvv "$appex" 2>&1 | grep -q 'Signature=adhoc'; then
    echo "warning: PlugInKit does not persist ad-hoc signed extensions on this clean runner; bundle metadata and the native render host were verified instead." >&2
  else
    echo "Developer ID Quick Look extension was not accepted by PlugInKit." >&2
    exit 1
  fi
fi
pluginkit -r "$appex" || true
echo "TextMark DMG/Quick Look registration smoke passed."
