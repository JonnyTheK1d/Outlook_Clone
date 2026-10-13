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

[Windows-Build und nativer Electron-Test](https://github.com/JonnyTheK1d/Outlook_Clone/actions/runs/38410887461) erfolgreich: Produktionsinstaller gebaut, native IPC-/Neustarttests unter Windows sowie DPAPI-Verschlüsselungs-/Entschlüsselungsrundlauf bestanden. Die zusätzliche neue Speicherprüfung lief separat in Linux; die ursprünglichen 30 Kern-/Provider-Tests liefen auch unter Windows. Die Prüfung des ausgelieferten Installers im Release-Workflow folgt. Die angeforderte vollständige Outlook-Funktionsliste ist noch nicht umgesetzt; der genaue Stand steht in feature-status.md.

Der Linux-NSIS-Compiler benötigte länger als das feste Vier-Minuten-Limit von electron-builder. Der Build-Wrapper verlängert ausschließlich für diesen Compiler das Limit auf 20 Minuten, erhält Exitcodes und entfernt sensible Umgebungsvariablen. Tests prüfen Ein-/Ausgabe, Fehlercode, Abbruch und den Ausschluss von Tokens/Signierpasswörtern. Der Wiederholungsbuild nutzt die bereits gepackten App-Dateien.
