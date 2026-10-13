# Prüfung von Version 0.1.1

In dieser Linux-Cloud ausgeführt:

| Prüfung | Ergebnis |
| --- | --- |
| `bash scripts/cloud-setup.sh` | Installation mit Lockfile, Electron-Checksum-Prüfung, Build und damalige 10 Kern-/Provider-Tests erfolgreich; anschließend ergänzte Tests separat ausgeführt |
| `npm run build` | TypeScript-Prüfungen und Produktionsbundles erfolgreich |
| `npm test` | 13 Tests bestanden: Mailzustand, Schema-/Empfängerprüfung, OAuth-Callback/PKCE, Provideraufrufe, UIDVALIDITY und atomare Speicherung |
| `npm run test:ui` | 5 Tests bestanden: Mailabläufe, Entwurf/Versand, Kalender/Kontakte/Aufgaben, Demo-Sperren/Darstellung und HTML-Textansicht |
| `npm run test:native` unter Xvfb | 1 Test bestanden: echte Electron-Bridge, IPC-Validierung, CSP, lokale Entwürfe und Persistenz nach Neustart |
| `npm audit` | Keine bekannten Schwachstellen im aktuellen Lockfile |
| Windows x64 NSIS-Cross-Build in Linux | Erfolgreich; Installer enthält 78 Dateien, 117.968.186 Bytes (ca. 113 MiB) |
| Installerprüfung mit `7zz t` | NSIS/LZMA-Archiv vollständig lesbar, Integritätsprüfung erfolgreich |
| `sha256sum -c SHA256SUMS` im Release-Verzeichnis | Prüfsumme bestätigt |
| Gepackte Windows-Fuses/ASAR | RunAsNode, NODE_OPTIONS und CLI-Inspection aus; ASAR-Integritätsprüfung und ausschließliche ASAR-Ladung an; aktuelle App-Bundles vorhanden |

Auf dem GitHub-Windows-Runner ausgeführt: [Release-Prüfung](https://github.com/JonnyTheK1d/Outlook_Clone/actions/runs/38371328558).

- Vollständigen Installer aus Git LFS geladen, MZ-Header und SHA-256 geprüft.
- Installer unter Windows ausgeführt; Programmdateien vorhanden.
- Installierte App gestartet; Desktop-Fenster geöffnet.
- App beendet und Uninstaller ausgeführt; Programm entfernt.
- Eine zusätzliche Benutzerdatei im Installationsverzeichnis bleibt erhalten.
- Release v0.1.1 mit EXE und Prüfsummen veröffentlicht.

Anschließend wurden EXE und Prüfsummen vom öffentlichen Release erneut heruntergeladen (HTTP 200). Der Download hat 117.968.186 Bytes und SHA-256 `47a28c0d8a2b19490fa39bd0d6a3dfc37caa02089a2b23176c0fb8f97153aa76`; er entspricht dem lokal gebauten Installer. Damit wird auch der bisherige Downloadfehler vermieden: kleine Git-LFS-Verweise aus Repository-ZIPs sind keine Windows-Programme.

Die fünf UI-Tests laufen gegen die Browser-Demo. Der native Test startet echte Electron-Prozesse; die Chromium-Prozesssandbox muss ausschließlich in diesem Linux-Container per Testoption deaktiviert werden. Diese Option ist nicht im Windows-Programm enthalten. Die Storage-Unit-Tests verwenden einen kontrollierten Ersatz für den OS-Schlüsselspeicher; sie prüfen Zustandskonsistenz und Sperren, keine DPAPI-Kryptografie.

Noch nicht ausgeführt: umfassende Tests auf dem Windows-11-Rechner des Benutzers, Windows-DPAPI-Test, Microsoft-Anmeldung mit realer App-Registrierung/Testkonto, echter IMAP/SMTP-Verbindungs- und Versandtest, unabhängiges Sicherheitsaudit und macOS-Build. Provider- und OAuth-Tests verwenden kontrollierte Antworten bzw. einen echten lokalen Callback, kein externes Mailkonto.

Der Quellcode ist auf GitHub unter `main` verfügbar. Der Release-Workflow hat erfolgreich den bereitgestellten Installer auf Windows geprüft und veröffentlicht. Frühere separate Windows-Neubuild-Läufe sind fehlgeschlagen; die Diagnose dieses unabhängigen Build-Workflows läuft separat. Der geprüfte Installer ist als [direktes Release-Asset](https://github.com/JonnyTheK1d/Outlook_Clone/releases/tag/v0.1.1) sowie über Git LFS unter `installers/Postblick-0.1.1-Windows-x64-Setup.exe` verfügbar. Generierte Build-Ausgaben unter `release/` bleiben vom Git-Repository ausgeschlossen. Die Cloud-Installations- und Startanweisungen sind als Konfigurationsentwurf gespeichert. Veröffentlichung der Cloud-Umgebung und Wiederherstellung in einer neuen Task sind noch nicht überprüft.
