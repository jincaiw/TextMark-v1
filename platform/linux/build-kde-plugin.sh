#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_dir=$(CDPATH= cd -- "$script_dir/../.." && pwd)
build_dir=${TEXTMARK_KDE_BUILD_DIR:-"$script_dir/build/kde"}
package_dir="$script_dir/build/package"

cmake -S "$script_dir/kde" -B "$build_dir" -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=ON
cmake --build "$build_dir" --parallel
ctest --test-dir "$build_dir" --output-on-failure

plugin=$(find "$build_dir" -type f \( -name 'textmarkthumbnail.so' -o -name 'libtextmarkthumbnail.so' \) -print -quit)
test -n "$plugin"
mkdir -p "$package_dir"
cp "$plugin" "$package_dir/textmarkthumbnail.so"
test -s "$package_dir/textmarkthumbnail.so"

if [ -x "$repo_dir/src-tauri/target/release/textmark" ]; then
  "$repo_dir/src-tauri/target/release/textmark" --thumbnail "$repo_dir/README.md" "$package_dir/textmark-smoke.png" 256
  file "$package_dir/textmark-smoke.png" | grep -q 'PNG image data'
  rm -f "$package_dir/textmark-smoke.png"
fi
