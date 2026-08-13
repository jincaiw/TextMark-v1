#!/bin/sh
set -e

for alias in /usr/bin/tm /usr/bin/text-mark; do
  if [ -L "$alias" ] && [ "$(readlink "$alias")" = "/usr/bin/textmark" ]; then rm -f "$alias"; fi
done

if command -v qtpaths6 >/dev/null 2>&1; then
  plugin_root=$(qtpaths6 --plugin-dir 2>/dev/null || true)
  plugin_link="$plugin_root/kf6/thumbcreator/textmarkthumbnail.so"
  if [ -n "$plugin_root" ] && [ -L "$plugin_link" ] && [ "$(readlink "$plugin_link")" = "/usr/lib/textmark/platform/kde/textmarkthumbnail.so" ]; then rm -f "$plugin_link"; fi
fi

command -v update-mime-database >/dev/null 2>&1 && update-mime-database /usr/share/mime || true
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database /usr/share/applications || true
command -v kbuildsycoca6 >/dev/null 2>&1 && kbuildsycoca6 --noincremental || true
