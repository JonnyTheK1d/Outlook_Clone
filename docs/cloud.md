# Cloud-Entwicklung

Die Task ist bereits isoliert. Nutze `/workspace/Outlook_Clone`; erstelle keinen zusätzlichen Git-Worktree, sofern der Benutzer dies nicht ausdrücklich verlangt.

## Installation

```sh
bash scripts/cloud-setup.sh
```

Das Skript nutzt `npm ci`, installiert das checksum-geprüfte Electron-Binary, baut die App und führt Kern-/Provider-Tests aus. npm- und Binary-Caches liegen unter `/workspace/.cache`. Xvfb wird aus signierten Debian-Metadaten bezogen und unter `/workspace/.tools` extrahiert; das System wird nicht verändert. Es wird nur für native Cloud-Tests gebraucht. Der Basismaschine müssen Debian-Laufzeitbibliotheken und Chromium zur Verfügung stehen.

## Start und Prüfung

Browser-Demo (keine echten Konten):

```sh
cd /workspace/Outlook_Clone
npm run dev:web
```

Danach `npm run test:ui` für die funktionalen Browser-Tests. Es wird eine lokale interne Verbindung auf Port 5173 verwendet; die Onboarding-Oberfläche stellt keinen öffentlichen Web-Preview bereit.

Native Electron-Prüfung in der Cloud:

```sh
export PATH=/workspace/.tools/debian/usr/bin:$PATH
export XDG_CACHE_HOME=/workspace/.cache
POSTBLICK_TEST_DISABLE_SANDBOX=1 xvfb-run -a npm run test:native
```

`--no-sandbox` ist ausschließlich eine Einschränkung des Linux-Testcontainers. Der Windows-Installer enthält diese Option nicht. Ein nativer Test prüft Desktop-Bridge, IPC-Validierung, CSP und Datenpersistenz nach einem Neustart. Der Cloud-Schlüsselspeicher ist nicht eingerichtet; echte Konten bleiben dort aus Sicherheitsgründen gesperrt.

Windows-Installer aus der Cloud:

```sh
export XDG_CACHE_HOME=/workspace/.cache
export ELECTRON_BUILDER_CACHE=/workspace/.cache/electron-builder
export NODE_USE_ENV_PROXY=1
npm run dist:win -- --config.electronDownload.cache=/workspace/.cache/electron
```

Die Build-Werkzeuge sind bereits installiert; bei neuen Tasks müssen Xvfb, Dev-Server und andere Prozesse neu gestartet werden. `npm run build` prüft Typen und erzeugt Web-/Desktop-Bundles. `npm audit` prüft die Abhängigkeiten. Logs dürfen keine Tokens, Passwörter oder Mailinhalte enthalten.

Microsoft benötigt für echte Kontotests die Anmeldung des Benutzers im Systembrowser und eine öffentliche Entra-Client-ID. Es werden keine geheimen Cloud-Variablen vorausgesetzt. Graph-Ziele sind `login.microsoftonline.com` und `graph.microsoft.com`. IMAP/SMTP werden vom installierten Windows-Client direkt beim jeweiligen Anbieter verwendet; sie sind kein Bestandteil eines funktionierenden Cloud-Demo-Workflows.

Windows-Paketierung verwendet scripts/dist-windows.cjs. Der Linux-NSIS-Compiler erhält ein erweitertes, begrenztes Zeitfenster; TLS- und Artifact-Prüfungen bleiben aktiv. Nach einem diagnostizierten Compilerabbruch kann bei unveränderten gepackten Programmdateien node scripts/dist-windows.cjs --prepackaged=release/win-unpacked verwendet werden. Unvollständige EXEs dürfen nicht verteilt werden; Integrität und Windows-Installation werden vor dem Release geprüft.
