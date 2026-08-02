#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
APP_NAME="TextMark"
PROCESS_NAME="textmark"
BUNDLE_ID="app.textmark.desktop"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_BUNDLE="$ROOT_DIR/src-tauri/target/release/bundle/macos/$APP_NAME.app"
APP_BINARY="$ROOT_DIR/src-tauri/target/release/$PROCESS_NAME"

cd "$ROOT_DIR"
pkill -x "$PROCESS_NAME" >/dev/null 2>&1 || true

npm run tauri build -- --bundles app

if [[ ! -d "$APP_BUNDLE" ]]; then
  echo "TextMark bundle was not created at $APP_BUNDLE" >&2
  exit 1
fi

open_app() {
  /usr/bin/open -n "$APP_BUNDLE"
}

case "$MODE" in
  run)
    open_app
    ;;
  --debug|debug)
    lldb -- "$APP_BINARY"
    ;;
  --logs|logs)
    open_app
    /usr/bin/log stream --info --style compact --predicate "process == \"$PROCESS_NAME\""
    ;;
  --telemetry|telemetry)
    open_app
    /usr/bin/log stream --info --style compact --predicate "subsystem == \"$BUNDLE_ID\""
    ;;
  --verify|verify)
    open_app
    for _ in {1..20}; do
      pgrep -x "$PROCESS_NAME" >/dev/null && exit 0
      sleep 0.25
    done
    echo "TextMark did not remain running after launch." >&2
    exit 1
    ;;
  *)
    echo "usage: $0 [run|--debug|--logs|--telemetry|--verify]" >&2
    exit 2
    ;;
esac
