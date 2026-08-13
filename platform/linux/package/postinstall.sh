#!/bin/sh
set -e

ln -sfn /usr/bin/textmark /usr/bin/tm
ln -sfn /usr/bin/textmark /usr/bin/text-mark

if [ -f /usr/lib/textmark/platform/kde/textmarkthumbnail.so ] && command -v qtpaths6 >/dev/null 2>&1; then
  plugin_root=$(qtpaths6 --plugin-dir 2>/dev/null || true)
  if [ -n "$plugin_root" ]; then
    mkdir -p "$plugin_root/kf6/thumbcreator"
    ln -sfn /usr/lib/textmark/platform/kde/textmarkthumbnail.so "$plugin_root/kf6/thumbcreator/textmarkthumbnail.so"
  fi
fi

command -v update-mime-database >/dev/null 2>&1 && update-mime-database /usr/share/mime || true
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database /usr/share/applications || true
command -v kbuildsycoca6 >/dev/null 2>&1 && kbuildsycoca6 --noincremental || true
