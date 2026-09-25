#!/usr/bin/env bash
# Doppelklick / open: Safari-Build ohne Admin-Rechte.
# Voraussetzung: Ein Admin hat einmal `sudo xcodebuild -license accept` ausgeführt.
set -euo pipefail

REPO="/Users/markusgerke/Desktop/Langes-rundes-s-Erweiterung"
LOG="$REPO/packages/extension/safari/build.log"
mkdir -p "$(dirname "$LOG")"
exec > >(tee "$LOG") 2>&1

cd "$REPO"
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer

echo "=== $(date) Safari-Build starten ==="
./packages/extension/scripts/build-safari.sh
echo
echo "=== Fertig ==="
echo "DONE" >> "$LOG"
read -r -p "Enter zum Schließen…" _
