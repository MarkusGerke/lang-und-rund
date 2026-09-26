#!/usr/bin/env bash
# Baut dist-chrome und erzeugt daraus ein Safari-Xcode-Projekt.
# Konvertierung läuft über /tmp (Desktop-Pfade sind für Xcode-Tools oft gesperrt).
set -euo pipefail

EXT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$EXT_DIR/../.." && pwd)"
DIST_CHROME="$EXT_DIR/dist-chrome"
OUT_DIR="$EXT_DIR/safari/xcode"
TMP_SRC="/tmp/lang-und-rund-dist-chrome"
TMP_OUT="/tmp/lang-und-rund-safari-xcode"
CONVERTER="/Applications/Xcode.app/Contents/Developer/usr/bin/safari-web-extension-converter"

export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"

if [[ ! -x "$CONVERTER" ]]; then
  echo "Fehler: safari-web-extension-converter nicht gefunden. Xcode installieren." >&2
  exit 1
fi

if ! xcodebuild -license check 2>/dev/null; then
  echo "Fehler: Xcode-Lizenz nicht akzeptiert." >&2
  echo "Als Admin einmal: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer && sudo xcodebuild -license accept" >&2
  exit 1
fi

echo "→ Extension bauen…"
(cd "$REPO_ROOT" && pnpm --filter @langs/extension build)

if [[ ! -f "$DIST_CHROME/manifest.json" ]]; then
  echo "Fehler: $DIST_CHROME/manifest.json fehlt." >&2
  exit 1
fi

echo "→ Dist nach /tmp kopieren (TCC)…"
rm -rf "$TMP_SRC" "$TMP_OUT"
cp -R "$DIST_CHROME" "$TMP_SRC"
xattr -cr "$TMP_SRC" 2>/dev/null || true

# Safari-Warnungen vermeiden (Keys nur Chrome/Firefox)
python3 - "$TMP_SRC/manifest.json" <<'PY'
import json, sys
from pathlib import Path
p = Path(sys.argv[1])
m = json.loads(p.read_text(encoding="utf-8"))
if isinstance(m.get("background"), dict):
    m["background"].pop("type", None)
if isinstance(m.get("options_ui"), dict):
    m["options_ui"].pop("open_in_tab", None)
p.write_text(json.dumps(m, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
PY

echo "→ Safari-Projekt erzeugen…"
"$CONVERTER" "$TMP_SRC" \
  --project-location "$TMP_OUT" \
  --app-name "LangUndRund" \
  --bundle-identifier de.langundrund.app \
  --copy-resources \
  --swift \
  --no-open \
  --no-prompt \
  --force

# Converter legt App-Name als Unterordner an: TMP_OUT/LangUndRund/*.xcodeproj
XCODEPROJ="$(find "$TMP_OUT" -name '*.xcodeproj' -print -quit 2>/dev/null || true)"
if [[ -z "$XCODEPROJ" ]]; then
  echo "Fehler: Converter hat kein Xcode-Projekt erzeugt." >&2
  ls -laR "$TMP_OUT" 2>/dev/null || true
  exit 1
fi

APP_DIR="$(dirname "$XCODEPROJ")"
rm -rf "$OUT_DIR"
mkdir -p "$(dirname "$OUT_DIR")"
mv "$APP_DIR" "$OUT_DIR"
rm -rf "$TMP_SRC" "$TMP_OUT"

# Host-App: volle Reader-UI (IIFE) in App-Resources
APP_VC_SRC="$EXT_DIR/safari/app/ViewController.swift"
APP_VC_DST="$OUT_DIR/Shared (App)/ViewController.swift"
APP_RES="$OUT_DIR/Shared (App)/Resources"
DIST_APP="$EXT_DIR/dist-app"

if [[ -f "$APP_VC_SRC" ]]; then
  cp "$APP_VC_SRC" "$APP_VC_DST"
  echo "→ Host-App ViewController eingesetzt"
fi

if [[ -d "$DIST_APP" && -f "$DIST_APP/Style.css" && -f "$DIST_APP/Script.js" ]]; then
  mkdir -p "$APP_RES/Base.lproj"
  cp "$DIST_APP/Style.css" "$APP_RES/Style.css"
  cp "$DIST_APP/Script.js" "$APP_RES/Script.js"
  cp "$DIST_APP/Base.lproj/Main.html" "$APP_RES/Base.lproj/Main.html"
  if [[ -f "$DIST_APP/impressum.html" ]]; then
    cp "$DIST_APP/impressum.html" "$APP_RES/impressum.html"
  fi
  if [[ -f "$DIST_APP/datenschutz.html" ]]; then
    cp "$DIST_APP/datenschutz.html" "$APP_RES/datenschutz.html"
  fi
  echo "→ Host-App UI (Main.html / Style.css / Script.js) eingesetzt"
else
  echo "Hinweis: dist-app fehlt — pnpm --filter @langs/extension build ausführen." >&2
fi

# Fenster skalierbar machen (Converter liefert oft nur titled+closable)
STORYBOARD="$OUT_DIR/macOS (App)/Base.lproj/Main.storyboard"
if [[ -f "$STORYBOARD" ]]; then
  python3 - "$STORYBOARD" <<'PY'
from pathlib import Path
import re, sys
p = Path(sys.argv[1])
text = p.read_text(encoding="utf-8")
text2, n = re.subn(
    r'<windowStyleMask key="styleMask"[^/]*/>',
    '<windowStyleMask key="styleMask" titled="YES" closable="YES" miniaturizable="YES" resizable="YES"/>',
    text,
    count=1,
)
if n:
    text = text2
    print("→ macOS-Fenster skalierbar (resizable)")

text, nsize = re.subn(
    r'width="425" height="325"',
    'width="960" height="1200"',
    text,
)
if nsize:
    print(f"→ macOS-Startgröße 960×1200 ({nsize} Stellen)")

# Edit-Menü (Cmd+A/C/X/V/Z) — Converter liefert nur App + Help
if 'title="Edit"' not in text and 'keyEquivalent="c"' not in text:
    edit_menu = '''                            <menuItem title="Edit" id="lang-edit-root">
                                <modifierMask key="keyEquivalentModifierMask"/>
                                <menu key="submenu" title="Edit" id="lang-edit-menu">
                                    <items>
                                        <menuItem title="Undo" keyEquivalent="z" id="lang-edit-undo">
                                            <connections>
                                                <action selector="undo:" target="Ady-hI-5gd" id="lang-edit-undo-act"/>
                                            </connections>
                                        </menuItem>
                                        <menuItem title="Redo" keyEquivalent="Z" id="lang-edit-redo">
                                            <modifierMask key="keyEquivalentModifierMask" shift="YES" command="YES"/>
                                            <connections>
                                                <action selector="redo:" target="Ady-hI-5gd" id="lang-edit-redo-act"/>
                                            </connections>
                                        </menuItem>
                                        <menuItem isSeparatorItem="YES" id="lang-edit-sep1"/>
                                        <menuItem title="Cut" keyEquivalent="x" id="lang-edit-cut">
                                            <connections>
                                                <action selector="cut:" target="Ady-hI-5gd" id="lang-edit-cut-act"/>
                                            </connections>
                                        </menuItem>
                                        <menuItem title="Copy" keyEquivalent="c" id="lang-edit-copy">
                                            <connections>
                                                <action selector="copy:" target="Ady-hI-5gd" id="lang-edit-copy-act"/>
                                            </connections>
                                        </menuItem>
                                        <menuItem title="Paste" keyEquivalent="v" id="lang-edit-paste">
                                            <connections>
                                                <action selector="paste:" target="Ady-hI-5gd" id="lang-edit-paste-act"/>
                                            </connections>
                                        </menuItem>
                                        <menuItem title="Select All" keyEquivalent="a" id="lang-edit-select">
                                            <connections>
                                                <action selector="selectAll:" target="Ady-hI-5gd" id="lang-edit-select-act"/>
                                            </connections>
                                        </menuItem>
                                    </items>
                                </menu>
                            </menuItem>
'''
    # Nach dem App-Menü-Eintrag, vor Help einfügen
    m = re.search(
        r'(</menuItem>\s*)(<menuItem title="Help")',
        text,
        flags=re.DOTALL,
    )
    if m:
        # Finde das Ende des ersten Top-Level-Menüs (App) genauer:
        # Einfügen vor Help
        text = text[: m.start(2)] + edit_menu + text[m.start(2) :]
        print("→ Edit-Menü (Cut/Copy/Paste/Select All) eingesetzt")
    else:
        print("Hinweis: Help-Menü nicht gefunden — Edit-Menü nicht eingefügt.", file=sys.stderr)

p.write_text(text, encoding="utf-8")
PY
fi

# macOS-Fenstertitel (Converter liefert oft „LangUndRund“)
STORYBOARD_MAC="$OUT_DIR/macOS (App)/Base.lproj/Main.storyboard"
if [[ -f "$STORYBOARD_MAC" ]]; then
  python3 - "$STORYBOARD_MAC" <<'PY'
from pathlib import Path
import re, sys
p = Path(sys.argv[1])
text = p.read_text(encoding="utf-8")
text2, n = re.subn(
    r'(<window key="window" title=")[^"]*(")',
    r'\1lang &amp; rund\2',
    text,
    count=1,
)
if n:
    p.write_text(text2, encoding="utf-8")
    print("→ macOS-Fenstertitel: lang & rund")
PY
fi

# MARKETING_VERSION aus Extension-package.json (Converter bleibt oft bei 1.0)
APP_VER="$(node -p "require('$EXT_DIR/package.json').version" 2>/dev/null || true)"
if [[ -n "${APP_VER:-}" ]]; then
  PBXPROJ="$OUT_DIR/LangUndRund.xcodeproj/project.pbxproj"
  if [[ -f "$PBXPROJ" ]]; then
    # Xcode MARKETING_VERSION oft ohne Patch (1.1); CURRENT_PROJECT_VERSION = Build
    SHORT_VER="${APP_VER%.*}"
    [[ "$SHORT_VER" == "$APP_VER" ]] && SHORT_VER="$APP_VER"
    python3 - "$PBXPROJ" "$SHORT_VER" "$APP_VER" <<'PY'
from pathlib import Path
import re, sys
p = Path(sys.argv[1])
short, full = sys.argv[2], sys.argv[3]
text = p.read_text(encoding="utf-8")
text2, n = re.subn(
    r"MARKETING_VERSION = [^;]+;",
    f"MARKETING_VERSION = {short};",
    text,
)
# Build-Nummer als numerische Form 1.1.0 → belassen wir als String in manifest;
# CURRENT_PROJECT_VERSION oft Integer — nur setzen wenn vorhanden und wir Patch als Build nutzen
build = full.replace(".", "")
text2, n2 = re.subn(
    r"CURRENT_PROJECT_VERSION = [^;]+;",
    f"CURRENT_PROJECT_VERSION = {build};",
    text2,
)
p.write_text(text2, encoding="utf-8")
print(f"→ Xcode MARKETING_VERSION = {short} ({n}×), CURRENT_PROJECT_VERSION = {build} ({n2}×)")
PY
  fi
fi

echo "→ Watch-Daten backen & Xcode-Projekt erzeugen…"
(cd "$EXT_DIR" && node scripts/bake-watch-data.mjs)
WATCH_DIR="$EXT_DIR/safari/watch"
if command -v xcodegen >/dev/null 2>&1; then
  (cd "$WATCH_DIR" && xcodegen generate)
  echo "→ Watch-App: $WATCH_DIR/LangUndRundWatch.xcodeproj"
else
  echo "Hinweis: xcodegen fehlt — Watch-Projekt nicht generiert (brew install xcodegen)." >&2
fi

echo
echo "Fertig. Xcode öffnen mit:"
echo "  open \"$OUT_DIR\"/LangUndRund.xcodeproj"
echo "Scheme „LangUndRund“ (macOS oder iOS) ▶ Run — Text einfügen & analysieren."
echo "Extension weiter über Safari → Einstellungen → Erweiterungen."
echo "Watch: open \"$WATCH_DIR\"/LangUndRundWatch.xcodeproj — Scheme LangUndRundWatch ▶ Run."
