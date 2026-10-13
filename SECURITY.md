# Sicherheitsmodell der Entwicklungsversion

Postblick 0.2 ist kein Ersatz für Outlooks durch Microsoft geprüfte Sicherheits- und Unternehmensfunktionen. Installation, App-Start und Deinstallation von Release 0.1.1 (Vorgängerversion) wurden auf einem Windows-Runner geprüft; ein unabhängiges Audit und Tests mit echten Konten stehen aus.

## Umgesetzte Schutzmaßnahmen

- Der Renderer hat keine Node-Integration. Context Isolation, Sandbox und Web Security sind aktiviert. Webviews, neue Fenster, fremde Navigationen, automatische Downloads sowie Browserberechtigungen werden blockiert.
- IPC-Aufrufe sind auf das eigene Hauptfenster begrenzt, werden seriell ausgeführt und mit strikten Schemas validiert. Die Brücke erlaubt keinen frei gewählten IPC-Kanal und keine beliebigen Dateipfade.
- Die produktive Oberfläche wird über ein eigenes internes Protokoll geladen. Asset-Pfade müssen innerhalb des gebündelten Web-Verzeichnisses bleiben. CSP begrenzt Skripte, Frames und Netzwerkverbindungen; HTML wird mit DOMPurify bereinigt. Skripte, Handler, Frames, SVG und CSS sind ausgeschlossen. Externe Bilder werden entfernt. HTTPS-Links öffnen nach nativer Zielbestätigung im Systembrowser.
- OAuth nutzt zufällige PKCE-Verifier, State-Vergleich und einen zeitlich begrenzten Loopback-Callback im Systembrowser. Microsoft-Tokens bleiben im Hauptprozess. HTTP-Redirects werden bei Token- und Graph-Anfragen nicht verfolgt.
- IMAP und SMTP erfordern TLS ≥1.2 und gültige Serverzertifikate. SMTP auf 587 muss STARTTLS erfolgreich verwenden. Es gibt keinen Schalter zum Deaktivieren der Verifikation.
- IMAP-Nachrichtenkennungen enthalten Ordner, UIDVALIDITY und UID. Nach einem serverseitigen Neuaufbau des Postfachs werden veraltete Kennungen abgelehnt, um Änderungen an einer falschen Nachricht zu vermeiden.
- Echte Zugangsdaten und der Kontocache werden mit Electron safeStorage verschlüsselt. Unter Windows verwendet dies DPAPI. Ohne sicheren Backend-Schlüsselspeicher werden echte Konten abgelehnt; Linux `basic_text` wird ausdrücklich nicht akzeptiert.
- Neue Dateien können ausschließlich über native Dateiauswahl autorisiert werden. Der Hauptprozess prüft Dateigröße und Herkunft. SMTP liest ausschließlich bereits geladene Bytes; Datei-/URL-Nachladen durch Nodemailer ist gesperrt.
- Ausgehende Anhänge sind begrenzt. Inbound-Downloads werden nicht geöffnet, sondern mit Dateiauswahl gespeichert. Endgültiges Löschen im Papierkorb wird bestätigt.
- Release-Fuses deaktivieren Electron RunAsNode, NODE_OPTIONS und CLI-Inspection. Die Windows-App lädt ausschließlich das ASAR-Bündel und prüft seine eingebettete Integrität. Das ersetzt keine Authenticode-Signatur.

## Grenzen

- DPAPI schützt gegenüber anderen Benutzerkonten und einfachen Festplattenkopien. Malware oder andere Prozesse unter demselben Windows-Benutzer können den Speicher möglicherweise entschlüsseln. Eine OS-Vollverschlüsselung bleibt sinnvoll.
- Die Oberfläche verarbeitet das eingegebene IMAP-App-Passwort kurzzeitig für die Übermittlung an den Hauptprozess. Gespeicherte Passwörter/Tokens werden nicht an den Renderer zurückgegeben. Keine Speicherung in Browser-LocalStorage für echte Konten.
- Demo-Daten sind bewusst unverschlüsselt. Betriebssystem-Backups, Speicherabbilder und bereits exportierte Anhänge liegen außerhalb der App-Löschgarantien.
- Keine Virenprüfung von Anhängen, Phishing-Erkennung, S/MIME, Exchange-DLP, Conditional Access-Integration oder automatische Sicherheitsupdates. Anbieterfunktionen gelten unabhängig von Postblick.
- Der Installer ist unsigniert. Vor einer öffentlichen Verteilung müssen Code-Signing, eine Update-Strategie und ein Sicherheitstest eingerichtet werden.
- Provider-Tests prüfen Protokollaufrufe mit kontrollierten Testdaten; sie beweisen keine echte Kontoanmeldung oder Zustellung. Echte Konto- und Windows-Sicherheitstests stehen aus.
- Die Linux-Cloud benötigt bei den nativen UI-Tests `--no-sandbox`, weil der Container keinen Chromium-Sandbox-Start erlaubt. Dieser Testparameter wird **nicht** in die App oder den Installer eingebaut. Context Isolation und deaktivierte Node-Integration werden auch dort geprüft; eine Windows-Prozesssandbox ist damit nicht validiert.

## Abhängigkeiten

`npm audit` und `npm audit --omit=dev` prüfen bekannte advisories; ein leerer Bericht ersetzt kein Audit. `global-agent` wird auf die korrigierte Version 4.1.3 überschrieben, da das Build-Werkzeug sonst eine verwundbare Logging-Abhängigkeit einzieht. Alle direkten Abhängigkeiten und der Lockfile sind festgeschrieben. TLS-, Release-Checksum- und APT-Signaturprüfung bleiben während des Cloud-Builds aktiv.

Bitte veröffentliche keine Sicherheitsberichte mit Zugangsdaten oder privaten Nachrichten. Private Meldestelle und signierte Veröffentlichungen müssen vor einem öffentlichen Produktstart ergänzt werden.

## Mehrkontenspeicher und Versand in 0.2

Alle Konten liegen in einem atomaren v2-Umschlag. Sobald ein echtes Konto vorhanden ist, wird der gesamte Umschlag einschließlich inaktiver Konten und Anhangssnapshots verschlüsselt. Renderer-Antworten enthalten Kontozusammenfassungen und Maildaten, keine Zugangstoken oder Passwörter. Bei Kontotrennung werden Warteschlangen- und Wiederherstellungsdaten entfernt; unreferenzierte Anhangssnapshots werden beim Speichern verworfen.

Vor Warteschlangenversand wird die Verbindung geprüft. Unmittelbar vor dem Sendaufruf wird „unklar“ dauerhaft gespeichert. Nach einem Abbruch an dieser Grenze wird nicht automatisch erneut gesendet. Dies schützt auch nach einem Absturz vor Doppelversand und erfordert gegebenenfalls manuelle Zustellungsprüfung.

Graph-Seitenverweise dürfen nur auf den eigenen Graph-Mailboxpfad zeigen. Große Uploads akzeptieren bekannte Microsoft-Hosts, HTTPS und keine Redirects. Bearer-Tokens gehen nicht an Uploadsession-URLs.

Automatische Updates bleiben deaktiviert. Aktivierung benötigt Authenticode-Herausgeber, signierten Build ohne unsignierten Fallback, Updatefeed und Windows-Signaturtests. Die manuelle Versionsprüfung ersetzt diese Voraussetzungen nicht.
