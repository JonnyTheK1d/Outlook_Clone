# Prüfung von Postblick 0.2.0

In der Linux-Cloud erfolgreich ausgeführt:

| Prüfung | Ergebnis |
| --- | --- |
| TypeScript und Produktionsbuild | Erfolgreich |
| Kern-/Provider-/Migrationstests | 34 bestanden (31 App-/Protokolltests und 3 Compilerprüfungen) |
| Browser-Workflows | 10 bestanden |
| Nativer Electron-Test unter Xvfb | 1 bestanden |
| npm audit (einschließlich Entwicklung) | Keine bekannten Advisories |

Die neuen Tests prüfen Mehrkontenmigration, verschlüsselte Kontentrennung, Graph-Seitenverweise ohne Tokenweitergabe an fremde Hosts, mehr als 100 Nachrichten, Antwortbezüge und Bcc, Ordner-/Kalenderverwaltung, Serien, Suchfilter und Mailto-Validierung. Warteschlangentests prüfen dauerhaften Status vor Versand, fehlende Verbindung, Speicherausfall und Abbruch nach möglicher Annahme ohne Doppelversand.

UI-Tests prüfen unter anderem Mehrfachaktionen, Kategorien, eigene Ordner, formatierte Nachrichten, Bcc, Postausgang, lokale Entwurfswiederherstellung, Kalenderansichten und Sichtbarkeit sowie die Entfernung aktiver HTML-Inhalte und externer Bildquellen.

Der native Test prüft die echte IPC-Brücke, Schemas, Isolation, Cache-Neustart, Entwürfe und dauerhafte Warteschlange. Der OS-Schlüsselspeicher-Rundlauf wird geprüft, wenn verfügbar; Windows verlangt seine Verfügbarkeit. Linux benötigt ausschließlich im Container den dokumentierten Testparameter zum Deaktivieren der Chromium-Prozesssandbox. Dieser Parameter wird nicht in den Installer eingebaut.

Die Storage-Unit-Tests verwenden einen kontrollierten Ersatz für DPAPI. Sie belegen keine Windows-Kryptografie. Konto-, Tenant-, Einladung-, SMTP-Zustellungs-, Druck-, Mailto-Standard-App- und signierte Update-Ende-zu-Ende-Tests mit realen Benutzerkonten stehen aus. Ein unabhängiges Sicherheitsaudit fehlt.

[Windows-Build und nativer Electron-Test](https://github.com/JonnyTheK1d/Outlook_Clone/actions/runs/38410887461) erfolgreich: Produktionsinstaller gebaut, native IPC-/Neustarttests unter Windows sowie DPAPI-Verschlüsselungs-/Entschlüsselungsrundlauf bestanden. Die zusätzliche neue Speicherprüfung lief separat in Linux; die ursprünglichen 30 Kern-/Provider-Tests liefen auch unter Windows. [Erweiterte Windows-Prüfung](https://github.com/JonnyTheK1d/Outlook_Clone/actions/runs/38415018937) ebenfalls erfolgreich: 34 Unit-/Compilerprüfungen, nativer Electron-/DPAPI-Test, Windows-Build sowie Installation, Mailto-Registrierung, App-Start, Deinstallation und Erhalt einer Benutzerdatei. Die direkt ausgelieferte Cloud-EXE wird zusätzlich vor der Release-Veröffentlichung geprüft. Die angeforderte vollständige Outlook-Funktionsliste ist noch nicht umgesetzt; der genaue Stand steht in feature-status.md.

Der Linux-NSIS-Compiler benötigte länger als das feste Vier-Minuten-Limit von electron-builder. Der Build-Wrapper verlängert ausschließlich für diesen Compiler das Limit auf 20 Minuten, erhält Exitcodes und entfernt sensible Umgebungsvariablen. Tests prüfen Ein-/Ausgabe, Fehlercode, Abbruch und den Ausschluss von Tokens/Signierpasswörtern. Der Wiederholungsbuild nutzt die bereits gepackten App-Dateien.

Vollständiger NSIS-Installer: 118.654.171 Bytes, 78 enthaltene Dateien; 7-Zip-Integritätsprüfung erfolgreich. SHA-256: 6a73704e011ed01545c2512a2da79eaafaccb2f12ce8cecb604469e3df0eede9. Update-Metadaten mit Version, Größe und SHA-512 stimmen mit der EXE überein.
