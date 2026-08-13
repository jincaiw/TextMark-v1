#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_dir="$(cd "$script_dir/../.." && pwd)"
derived_dir="$script_dir/.derived-data"
output_dir="$script_dir/build"

if [[ "${TEXTMARK_SKIP_WEB_BUILD:-0}" != "1" ]]; then
  npm --prefix "$repo_dir" run build
fi
command -v xcodegen >/dev/null || { echo "xcodegen is required to build TextMark Quick Look" >&2; exit 1; }
xcodegen generate --spec "$script_dir/project.yml" --project "$script_dir/TextMarkQuickLook.xcodeproj"
xcodebuild -project "$script_dir/TextMarkQuickLook.xcodeproj" -scheme TextMarkQuickLook -configuration Release -derivedDataPath "$derived_dir" ARCHS="arm64 x86_64" ONLY_ACTIVE_ARCH=NO CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM= build
xcodebuild -project "$script_dir/TextMarkQuickLook.xcodeproj" -scheme TextMarkQuickLook -configuration Release -derivedDataPath "$derived_dir" CODE_SIGNING_ALLOWED=NO test
mkdir -p "$output_dir"
ditto "$derived_dir/Build/Products/Release/TextMarkQuickLook.appex" "$output_dir/TextMarkQuickLook.appex"
codesign --force --deep --sign - --entitlements "$script_dir/quicklook/TextMarkQuickLook.entitlements" "$output_dir/TextMarkQuickLook.appex"
plutil -lint "$output_dir/TextMarkQuickLook.appex/Contents/Info.plist"
test -s "$output_dir/TextMarkQuickLook.appex/Contents/Resources/dist/preview.html"
codesign --verify --deep --strict "$output_dir/TextMarkQuickLook.appex"
architectures=$(lipo -archs "$output_dir/TextMarkQuickLook.appex/Contents/MacOS/TextMarkQuickLook")
[[ " $architectures " == *" arm64 "* && " $architectures " == *" x86_64 "* ]]
