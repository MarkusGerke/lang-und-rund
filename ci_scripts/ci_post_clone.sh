#!/bin/sh
# Xcode Cloud: Watch-Projekt erzeugen, falls nur project.yml im Repo liegt.
set -euo pipefail

WATCH_DIR="${CI_PRIMARY_REPOSITORY_PATH:-}/packages/extension/safari/watch"
if [[ -z "${CI_PRIMARY_REPOSITORY_PATH:-}" ]]; then
  WATCH_DIR="$(cd "$(dirname "$0")/../../packages/extension/safari/watch" && pwd)"
fi

cd "$WATCH_DIR"

if [[ ! -f LangUndRundWatch.xcodeproj/project.pbxproj ]]; then
  echo "→ LangUndRundWatch.xcodeproj fehlt — xcodegen…"
  if ! command -v xcodegen >/dev/null 2>&1; then
    brew install xcodegen
  fi
  xcodegen generate
fi

echo "→ Watch-Projekt bereit: $WATCH_DIR/LangUndRundWatch.xcodeproj"
