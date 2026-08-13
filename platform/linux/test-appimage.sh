#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then echo "usage: $0 TextMark.AppImage" >&2; exit 2; fi
appimage=$(realpath "$1")
sample=$(mktemp --suffix=.md)
thumbnail=$(mktemp --suffix=.png)
cleanup() { rm -f "$sample" "$thumbnail"; }
trap cleanup EXIT INT TERM

printf '# TextMark\n\nAppImage portable thumbnail smoke test.\n' > "$sample"
chmod +x "$appimage"
"$appimage" --appimage-extract-and-run --thumbnail "$sample" "$thumbnail" 256
file "$thumbnail" | grep -q 'PNG image data'

extracted=$(mktemp -d)
trap 'cleanup; rm -rf "$extracted"' EXIT INT TERM
(cd "$extracted" && "$appimage" --appimage-extract >/dev/null)
test -x "$extracted/squashfs-root/usr/bin/textmark"
test ! -e "$extracted/squashfs-root/usr/share/thumbnailers/textmark.thumbnailer"
echo "TextMark AppImage portable smoke passed."
