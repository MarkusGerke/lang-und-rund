#!/usr/bin/env bash
# Dünner Wrapper: nur User-Build, kein sudo.
set -euo pipefail
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
cd /Users/markusgerke/Desktop/Langes-rundes-s-Erweiterung
./packages/extension/scripts/build-safari.sh
