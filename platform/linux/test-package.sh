#!/bin/sh
set -eu

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then echo "usage: $0 deb|rpm package [with-kde]" >&2; exit 2; fi
kind=$1
package=$(realpath "$2")
integration=${3:-standard}
preview_plugin=/usr/lib/textmark/platform/kde/textmarkthumbnail.so

as_root() {
  if [ "$(id -u)" -eq 0 ]; then "$@"; else sudo "$@"; fi
}

cleanup() {
  if [ "$kind" = deb ]; then
    package_name=$(dpkg-deb -f "$package" Package 2>/dev/null || true)
    [ -z "$package_name" ] || as_root dpkg --purge "$package_name" >/dev/null 2>&1 || true
  else
    package_name=$(rpm -qp --queryformat '%{NAME}' "$package" 2>/dev/null || true)
    [ -z "$package_name" ] || as_root rpm -e "$package_name" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

if [ "$kind" = deb ]; then
  as_root dpkg -i "$package"
elif [ "$kind" = rpm ]; then
  as_root dnf install -y "$package"
else
  echo "unsupported package kind: $kind" >&2
  exit 2
fi

test -x /usr/bin/textmark
test "$(readlink /usr/bin/tm)" = /usr/bin/textmark
test "$(readlink /usr/bin/text-mark)" = /usr/bin/textmark
test -s /usr/share/mime/packages/app.textmark.xml
test -s /usr/share/thumbnailers/textmark.thumbnailer
grep -q '^Exec=textmark --thumbnail %i %o %s$' /usr/share/thumbnailers/textmark.thumbnailer

if [ "$integration" = with-kde ]; then
  test -s "$preview_plugin"
else
  test ! -e "$preview_plugin"
fi

sample=$(mktemp --suffix=.md)
thumbnail=$(mktemp --suffix=.png)
printf '# TextMark\n\nLinux package smoke test.\n' > "$sample"
/usr/bin/textmark --thumbnail "$sample" "$thumbnail" 256
file "$thumbnail" | grep -q 'PNG image data'
rm -f "$sample" "$thumbnail"

if [ "$integration" = with-kde ] && command -v qtpaths6 >/dev/null 2>&1; then
  plugin_root=$(qtpaths6 --plugin-dir)
  test "$(readlink "$plugin_root/kf6/thumbcreator/textmarkthumbnail.so")" = "$preview_plugin"
fi

cleanup
trap - EXIT INT TERM
test ! -e /usr/bin/tm
test ! -e /usr/bin/text-mark
test ! -e "$preview_plugin"
echo "TextMark $kind install/thumbnail/uninstall smoke passed."
