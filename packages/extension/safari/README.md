# lang & rund — Safari

Safari-Pakete erfordern Xcode (`xcrun safari-web-extension-converter`).

```bash
pnpm build:extension
xcrun safari-web-extension-converter packages/extension/dist-chrome \
  --project-location packages/extension/safari \
  --app-name "lang & rund" \
  --bundle-identifier de.langundrund.app \
  --force
```

Dann in Xcode öffnen, Signing setzen, auf dem Mac / iOS-Gerät laufen lassen.
