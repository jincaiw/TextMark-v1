#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_dir="$(cd "$script_dir/../.." && pwd)"
derived_dir="$script_dir/.derived-data"
output_dir="$script_dir/build"
app_version=$(node -p "require('$repo_dir/package.json').version")
signing_identity="${APPLE_SIGNING_IDENTITY:-}"

if [[ -n "$signing_identity" && "$signing_identity" != Developer\ ID\ Application:* ]]; then
  echo "APPLE_SIGNING_IDENTITY must name a Developer ID Application identity when supplied." >&2
  exit 1
fi

if [[ "${TEXTMARK_SKIP_WEB_BUILD:-0}" != "1" ]]; then
  npm --prefix "$repo_dir" run build
fi
command -v xcodegen >/dev/null || { echo "xcodegen is required to build TextMark Quick Look" >&2; exit 1; }
xcodegen generate --spec "$script_dir/project.yml" --project "$script_dir"
xcodebuild -project "$script_dir/TextMarkQuickLook.xcodeproj" -scheme TextMarkQuickLook -configuration Release -derivedDataPath "$derived_dir" ARCHS="arm64 x86_64" ONLY_ACTIVE_ARCH=NO CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM= MARKETING_VERSION="$app_version" CURRENT_PROJECT_VERSION="$app_version" CODE_SIGNING_ALLOWED=NO build
xcodebuild -project "$script_dir/TextMarkQuickLook.xcodeproj" -scheme TextMarkQuickLook -configuration Release -derivedDataPath "$derived_dir" MARKETING_VERSION="$app_version" CURRENT_PROJECT_VERSION="$app_version" CODE_SIGNING_ALLOWED=NO test
mkdir -p "$output_dir"
ditto "$derived_dir/Build/Products/Release/TextMarkQuickLook.appex" "$output_dir/TextMarkQuickLook.appex"
if [[ -n "$signing_identity" ]]; then
  codesign --force --deep --sign "$signing_identity" --options runtime --timestamp --entitlements "$script_dir/quicklook/TextMarkQuickLook.entitlements" "$output_dir/TextMarkQuickLook.appex"
else
  # CI may build an ad-hoc extension for native rendering tests. The release
  # workflow always supplies Developer ID and separately notarizes the DMGs.
  codesign --force --deep --sign - --entitlements "$script_dir/quicklook/TextMarkQuickLook.entitlements" "$output_dir/TextMarkQuickLook.appex"
fi
plutil -lint "$output_dir/TextMarkQuickLook.appex/Contents/Info.plist"
test -s "$output_dir/TextMarkQuickLook.appex/Contents/Resources/dist/preview.html"
codesign --verify --deep --strict "$output_dir/TextMarkQuickLook.appex"
architectures=$(lipo -archs "$output_dir/TextMarkQuickLook.appex/Contents/MacOS/TextMarkQuickLook")
[[ " $architectures " == *" arm64 "* && " $architectures " == *" x86_64 "* ]]
