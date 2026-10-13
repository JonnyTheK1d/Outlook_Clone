# Prüfung der ersten Version

In dieser Linux-Cloud ausgeführt:

| Prüfung | Ergebnis |
| --- | --- |
| `bash scripts/cloud-setup.sh` | Installation mit Lockfile, Electron-Checksum-Prüfung, Build und damalige 10 Kern-/Provider-Tests erfolgreich; anschließend ergänzte Tests separat ausgeführt |
| `npm run build` | TypeScript-Prüfungen und Produktionsbundles erfolgreich |
| `npm test` | 13 Tests bestanden: Mailzustand, Schema-/Empfängerprüfung, OAuth-Callback/PKCE, Provideraufrufe, UIDVALIDITY und atomare Speicherung |
| `npm run test:ui` | 5 Tests bestanden: Mailabläufe, Entwurf/Versand, Kalender/Kontakte/Aufgaben, Demo-Sperren/Darstellung und HTML-Textansicht |
| `npm run test:native` unter Xvfb | 1 Test bestanden: echte Electron-Bridge, IPC-Validierung, CSP, lokale Entwürfe und Persistenz nach Neustart |
| `npm audit` | Keine bekannten Schwachstellen im aktuellen Lockfile |
| Windows x64 NSIS-Build | Erfolgreich; Installer enthält 78 Dateien, ca. 113 MiB |
| Installerprüfung mit `7zz t` | NSIS/LZMA-Archiv vollständig lesbar, Integritätsprüfung erfolgreich |
| `sha256sum -c SHA256SUMS` im Release-Verzeichnis | Prüfsumme bestätigt |
| Gepackte Windows-Fuses/ASAR | RunAsNode, NODE_OPTIONS und CLI-Inspection aus; ASAR-Integritätsprüfung und ausschließliche ASAR-Ladung an; aktuelle App-Bundles vorhanden |

Die fünf UI-Tests laufen gegen die Browser-Demo. Der native Test startet echte Electron-Prozesse; die Chromium-Prozesssandbox muss ausschließlich in diesem Linux-Container per Testoption deaktiviert werden. Diese Option ist nicht im Windows-Programm enthalten. Die Storage-Unit-Tests verwenden einen kontrollierten Ersatz für den OS-Schlüsselspeicher; sie prüfen Zustandskonsistenz und Sperren, keine DPAPI-Kryptografie.

Noch nicht ausgeführt: Windows-Installation/Deinstallation auf einem echten Windows-System, Windows-DPAPI-Test, Microsoft-Anmeldung mit realer App-Registrierung/Testkonto, echter IMAP/SMTP-Verbindungs- und Versandtest, unabhängiges Sicherheitsaudit und macOS-Build. Provider- und OAuth-Tests verwenden kontrollierte Antworten bzw. einen echten lokalen Callback, kein externes Mailkonto.

Der Quellcode ist auf GitHub unter `main` verfügbar. Der Windows-Workflow ist vorbereitet; sein Ergebnis auf GitHub wurde noch nicht überprüft. Der lokal gebaute Installer liegt im Workspace und ist als Build-Artefakt vom Git-Repository ausgeschlossen. Die Cloud-Installations- und Startanweisungen sind als Konfigurationsentwurf gespeichert. Veröffentlichung der Cloud-Umgebung und Wiederherstellung in einer neuen Task sind noch nicht überprüft.
