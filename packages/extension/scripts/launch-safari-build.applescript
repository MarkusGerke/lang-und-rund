tell application "Terminal"
	activate
	do script "export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer; cd /Users/markusgerke/Desktop/Langes-rundes-s-Erweiterung && ./packages/extension/scripts/build-safari.sh; echo DONE; exec bash"
end tell
