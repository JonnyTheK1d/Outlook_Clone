# Prüfung von Postblick 0.2.1

In der Linux-Cloud erfolgreich ausgeführt:

| Prüfung | Ergebnis |
| --- | --- |
| TypeScript und Produktionsbuild | Erfolgreich |
| Kern-/Provider-/Migrationstests | 35 bestanden (32 App-/Protokolltests und 3 Compilerprüfungen) |
| Browser-Workflows | 11 bestanden |
| Nativer Electron-Test unter Xvfb | 1 bestanden |
| npm audit (einschließlich Entwicklung) | Keine bekannten Advisories |

Die neuen Tests prüfen Mehrkontenmigration, verschlüsselte Kontentrennung, Graph-Seitenverweise ohne Tokenweitergabe an fremde Hosts, mehr als 100 Nachrichten, Antwortbezüge und Bcc, Ordner-/Kalenderverwaltung, Serien, Suchfilter und Mailto-Validierung. Warteschlangentests prüfen dauerhaften Status vor Versand, fehlende Verbindung, Speicherausfall und Abbruch nach möglicher Annahme ohne Doppelversand.

UI-Tests prüfen unter anderem Mehrfachaktionen, Kategorien, eigene Ordner, formatierte Nachrichten, Bcc, Postausgang, lokale Entwurfswiederherstellung, Kalenderansichten und Sichtbarkeit sowie die Entfernung aktiver HTML-Inhalte und externer Bildquellen.

Der native Test prüft die echte IPC-Brücke, Schemas, Isolation, Cache-Neustart, Entwürfe und dauerhafte Warteschlange. Der OS-Schlüsselspeicher-Rundlauf wird geprüft, wenn verfügbar; Windows verlangt seine Verfügbarkeit. Linux benötigt ausschließlich im Container den dokumentierten Testparameter zum Deaktivieren der Chromium-Prozesssandbox. Dieser Parameter wird nicht in den Installer eingebaut.

Die Storage-Unit-Tests verwenden einen kontrollierten Ersatz für DPAPI. Sie belegen keine Windows-Kryptografie. Konto-, Tenant-, Einladung-, SMTP-Zustellungs-, Druck-, Mailto-Standard-App- und signierte Update-Ende-zu-Ende-Tests mit realen Benutzerkonten stehen aus. Ein unabhängiges Sicherheitsaudit fehlt.

[Windows-Build und nativer Electron-Test](https://github.com/JonnyTheK1d/Outlook_Clone/actions/runs/38410887461) erfolgreich: Produktionsinstaller gebaut, native IPC-/Neustarttests unter Windows sowie DPAPI-Verschlüsselungs-/Entschlüsselungsrundlauf bestanden. Die zusätzliche neue Speicherprüfung lief separat in Linux; die ursprünglichen 30 Kern-/Provider-Tests liefen auch unter Windows. [Erweiterte Windows-Prüfung](https://github.com/JonnyTheK1d/Outlook_Clone/actions/runs/38415018937) ebenfalls erfolgreich: 34 Unit-/Compilerprüfungen, nativer Electron-/DPAPI-Test, Windows-Build sowie Installation, Mailto-Registrierung, App-Start, Deinstallation und Erhalt einer Benutzerdatei. Die direkt ausgelieferte Cloud-EXE wird zusätzlich vor der Release-Veröffentlichung geprüft. Die angeforderte vollständige Outlook-Funktionsliste ist noch nicht umgesetzt; der genaue Stand steht in feature-status.md.

Der Linux-NSIS-Compiler benötigte länger als das feste Vier-Minuten-Limit von electron-builder. Der Build-Wrapper verlängert ausschließlich für diesen Compiler das Limit auf 20 Minuten, erhält Exitcodes und entfernt sensible Umgebungsvariablen. Tests prüfen Ein-/Ausgabe, Fehlercode, Abbruch und den Ausschluss von Tokens/Signierpasswörtern. Der Wiederholungsbuild nutzt die bereits gepackten App-Dateien.

Vorgängerversion 0.2.0 – vollständiger NSIS-Installer: 118.654.171 Bytes, 78 enthaltene Dateien; 7-Zip-Integritätsprüfung erfolgreich. SHA-256: 6a73704e011ed01545c2512a2da79eaafaccb2f12ce8cecb604469e3df0eede9. Update-Metadaten mit Version, Größe und SHA-512 stimmen mit der EXE überein.

## Korrekturen in 0.2.1

Zusätzliche Tests bestätigen, dass gleiche IMAP-Kennungen verschiedener Konten im gemeinsamen Posteingang getrennt bleiben und dass mehrere kleine Anhänge über einen Microsoft-Entwurf einzeln angehängt werden, statt die sendMail-Requestgrenze zu überschreiten. Graph-HTML wird für Suche und Antworten korrekt zu Text konvertiert; Serverentwürfe verwenden ihr Erstellungsdatum als Fallback. Windows erhält eine registrierte Benachrichtigungsidentität, ein physisches Symbol und einen Indikator für ungelesene Nachrichten. Die Benachrichtigungsregistrierung wird in den Windows-Installertests zusätzlich geprüft.

[Windows-Prüfung von 0.2.1](https://github.com/JonnyTheK1d/Outlook_Clone/actions/runs/38423800840) erfolgreich: 35 Kern-/Provider-/Compilerprüfungen, native Electron-/DPAPI-Prüfung, Produktionsbuild, Installation, Mailto- und Benachrichtigungsregistrierung, App-Start und Deinstallation mit Erhalt einer Benutzerdatei. Die elf Browser-Prüfungen liefen in Linux (zehn Basisszenarien und ein zusätzlicher Test der kontenübergreifenden IMAP-Kennungen). Das Erscheinen eines Toasts nach einer echten eingegangenen Mail wurde ohne Testkonto noch nicht Ende-zu-Ende geprüft.

Installer 0.2.1: 118633194 Bytes, SHA-256 0f9c25b67a9a100e49caccaee84ccece555ac392c9f53d1f4b2f0dfda0e3a721. Archiv-Integrität und SHA-512-/Größenangaben im Updatefeed geprüft.

[Release-Prüfung von 0.2.1](https://github.com/JonnyTheK1d/Outlook_Clone/actions/runs/38426198517) erfolgreich: die vollständige Cloud-EXE aus Git LFS unter Windows installiert, App gestartet, Mailto-/Benachrichtigungsregistrierung geprüft, deinstalliert und Benutzerdatei erhalten. Anschließend EXE, SHA256SUMS, Blockmap und Updatefeed veröffentlicht. Der öffentliche EXE-Download liefert HTTP 200, 118.633.194 Bytes und SHA-256 0f9c25b67a9a100e49caccaee84ccece555ac392c9f53d1f4b2f0dfda0e3a721; Windows-Header und Hash entsprechen der geprüften Datei.
