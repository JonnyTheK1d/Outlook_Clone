# Funktionsvergleich mit Outlook – Postblick 0.3.0

„Implementiert“ bezeichnet den vorhandenen Code, nicht eine Prüfung mit echten Konten. Microsoft- und IMAP-Testkonten fehlen. Eine vollständige Outlook-Parität und ein vergleichbares Sicherheitsniveau sind nicht nachgewiesen.

| Bereich | Implementiert in 0.3.0 | Noch offen |
| --- | --- | --- |
| Konten | Verschlüsselter Mehrkontenspeicher, Kontowechsel, gemeinsamer Posteingang aus dem Cache | OAuth anderer Anbieter; Herausgeber-Client-ID für Microsoft |
| Serverkonfiguration | Vorgaben für Gmail, GMX, WEB.DE, Yahoo, iCloud | Allgemeines Autodiscover; getrennte SMTP-Zugangsdaten |
| Empfang | Hintergrundabruf, Kontointervall, Windows-Benachrichtigungen und Taskleistenindikator | IMAP IDLE/Graph Push; geschlossene App |
| Ordner | Erstellen, Umbenennen, Löschen leerer zusätzlicher Ordner; Unterordner; Favoriten | Suchordner; komplexe IMAP-Hierarchieanzeige |
| Suche | Seitenabruf, alle geladenen Ordner, Filtergrammatik, Graph-/IMAP-Serversuche | Graph maximal 1000 Suchtreffer je Ordner; großer lokaler Suchindex |
| Organisation | Kategorien, Pinning, Mehrfachaktionen mit Strg-/Umschalt-Auswahl, Rückgängig für Verschieben/Löschen (Strg+Z), Absender blockieren, Drag-and-drop auf alle Ordner, Kontextmenüs für Nachrichten und Ordner, „Alle als gelesen markieren“, „Ordner leeren“, Sortierung und Datumsgruppen, Unterhaltungsverlauf im Lesebereich | Relevant/Sonstige; Kennzeichnung mit Fälligkeit; Zurückstellen |
| Regeln | Lokale Absender-/Betreffbedingungen, Verschieben und Gelesen-Markierung | Serverregelverwaltung, Auto-Weiterleitung, Quick Steps |
| Abwesenheit | Microsoft-Antwort aktivieren/deaktivieren | Andere Anbieter; Zeitplan |
| HTML | DOMPurify-Bereinigung, Formatierung, Listen, HTTPS-Links mit Zielbestätigung, vorhandene Datenbilder | Vollständiger CSS-/Schrift-/Tabelleneditor, CID-Bilder und Bildauswahl |
| Schreiben | Bcc, Signatur, Vorlagen, Kontaktvorschläge, OS-Rechtschreibung, lokale Autosicherung mit Anhangssnapshot | Vollständige Empfängerchips; allgemeine serverseitige IMAP-Autosicherung |
| Versand | Priorität, Lesebestätigung, Microsoft-Zustellbestätigungsanforderung, geplante Warteschlange | Rückruf; Versand bei geschlossener App; Zustellung ist nicht garantiert |
| Antworten | Reply-To, Graph-Antwort-/Weiterleitungsaktionen, IMAP-Referenzen, Weiterleitungsanhänge | Bearbeitung ursprünglicher HTML-Unterhaltungen |
| Anhänge | 20 MB/20 neue Dateien, Dateien per Drag-and-drop in den Editor, Graph-Uploadsession, Entwurfsanhänge entfernen, Download | Vorschau, Cloud-Dateilinks und Virenscan |
| Offline | Geladener Cache, Entwurfswiederherstellung, dauerhafte Versandwarteschlange | Warteschlange für andere Änderungen; Konfliktauflösung |
| Kalender | Tag/Woche mit Stundenraster und Doppelklick auf eine Uhrzeit, Monat mit Wochentagen und Heute-Markierung, mehrere Kalender, Sichtbarkeit, Ganztag, einfache Serien, Erinnerungen | Freigaben, freie Zeitzonenauswahl, Serienausnahmen, uneingeschränkter Zeitraum |
| Besprechungen | Microsoft-Teilnehmer, Antworten, Teams-Erstellung für unterstützte Konten | Verfügbarkeit, Terminvorschläge, Räume, IMAP-Einladungen |
| Kontakte | Weitere Adressen/Telefone und Gruppen im Kontaktdialog, Gruppen-Bcc, CSV, Absender aus einer Nachricht übernehmen | Fotos, Firmenadressbuch, vCard, Outlook-Verteilerobjekte |
| Aufgaben | Listenbezeichnung, Notizen, Unteraufgaben, Erinnerungen, Wiederholung, Microsoft To Do | Listenübergreifendes Verschieben, delegierte Aufgaben, alle Outlook-Felder |
| Exchange | Eigene Graph-Mailbox | Freigegebene Postfächer, Stellvertretung, Senden als, öffentliche Ordner, Gruppen |
| Daten | Rekonstruierter EML-Export, lokaler EML-Import, CSV-Kontakte, ICS-Kalender, Drucken | PST/MSG, MIME-Originalarchiv, EML-Importanhänge, komplexer ICS-Serienimport |
| Windows | Mailto-Parser, Standard-App-Registrierung, Drucken, Lesebereich rechts/unten/aus, Dichte, eigene Lese- und Verfassenfenster (Doppelklick/Eingabe), Outlook-Tastenkürzel, Menüband „Ansicht“, Bearbeiten-/Rechtschreibmenü in Textfeldern | Spaltenansicht, Add-ins, Fensterpositionen merken |
| Updates | Versionsprüfung/Download-Link; Signaturprüfung für spätere automatische Updates vorbereitet | Automatische Installation bleibt ohne Zertifikat und Signaturtests deaktiviert |
| Sicherheit | Isolation, Mehrkontenverschlüsselung, TLS, PKCE, IPC-Validierung, HTML-Bereinigung | S/MIME, Microsoft-Nachrichtenverschlüsselung, Phishing-/Malware-Prüfung, Unternehmensrichtlinien, Audit |

## Seit 0.3.0 (Entwicklungsstand, noch nicht als Installer veröffentlicht)

- **Rückgängig:** Nach Verschieben, Archivieren oder Löschen bietet die Meldung „Rückgängig“ an, alternativ Strg+Z. Bei Microsoft-Konten und IMAP-Servern mit UIDPLUS wird die neue Nachrichtenkennung übernommen; ohne diese Angabe des Servers wird kein Rückgängig angeboten. Endgültiges Löschen bleibt endgültig.
- **Absender:** „Zu Kontakten hinzufügen“ und „Absender blockieren“ im Lesebereich und im Kontextmenü. Blockieren legt eine Junk-Regel an und verschiebt vorhandene Nachrichten des Absenders aus dem Posteingang.
- **Kontakte:** Weitere E-Mail-Adressen, Telefonnummern und Gruppe sind im Kontaktdialog bearbeitbar.
- **Anhänge:** Dateien lassen sich auf den Editor ziehen. Die Oberfläche übergibt nur den Inhalt, nie einen Dateipfad; es gelten dieselben Grenzen wie beim Dateidialog.
- **Benachrichtigungen:** Ein Klick holt Postblick nach vorn; bei genau einer neuen Nachricht öffnet sie sich im Lesefenster. Die Benachrichtigung nennt Absender und Betreff.
- **Kalender:** Wochentags-Kopfzeile, Markierung für heute, Stundenraster mit Jetzt-Linie in Tag- und Wochenansicht, nebeneinander dargestellte Überschneidungen und Doppelklick auf eine Uhrzeit für einen neuen Termin. Korrigiert: Nach „Heute“ in der Monatsansicht begann das Raster am falschen Wochentag.
- **Drucken:** Formatierte HTML-Nachrichten mit Von, Gesendet, An, Cc und Anlagenliste; Skripte, Formulare, Frames und Weiterleitungen werden entfernt, und das Druckfenster läuft ohne JavaScript und Netzwerk.
- **Korrekturen:** „Anheften / lösen“ in der Organisationsleiste berücksichtigt alle markierten Nachrichten; ein Untermenü schließt sich nicht mehr, wenn man nach dem Überfahren klickt; Erfolgsmeldungen verschwinden nach einigen Sekunden.

## Neu in 0.3.0

- **Eigene Fenster wie in Outlook:** Doppelklick oder Eingabetaste öffnet eine Nachricht in einem eigenen Lesefenster mit Menüband (Antworten, Löschen, Archivieren, Verschieben, Kategorisieren, Drucken, vorheriges/nächstes Element). Antworten und Weiterleiten aus dem Lesefenster öffnen ein eigenes Verfassenfenster; Entwürfe öffnen sich per Doppelklick zum Bearbeiten. Der Editor lässt sich mit „In neuem Fenster“ ausdocken, optional öffnen alle neuen Nachrichten in eigenen Fenstern. Alle Fenster verwenden dieselbe isolierte, validierte Bridge und bleiben synchron. Schließen des Hauptfensters schließt die Nebenfenster; ungesendeter Text bleibt über die lokale Autosicherung erhalten.
- **Kontextmenüs:** Rechtsklick auf Nachrichten (Öffnen, Antworten, Gelesen/Ungelesen, Kennzeichnen, Kategorisieren, Anheften, Verschieben, Archivieren, Junk, Löschen, Drucken, EML) und auf Ordner (Alle als gelesen markieren, Synchronisieren, Favorit, Unterordner, Umbenennen, Löschen, Ordner leeren). Textfelder erhalten ein Bearbeiten-Menü mit Rechtschreibvorschlägen.
- **Auswahl und Tastatur:** Strg-/Umschalt-Klick, Strg+A, Pfeiltasten (mit Umschalt erweiterbar), Strg+R/Strg+Umschalt+R/Strg+F, Strg+Q/Strg+U, Einfg, Entf, Rücktaste (Archivieren), Strg+Umschalt+V, Strg+1…4, Strg+Umschalt+M/A/C, F9, Strg+P. Das Electron-Standardmenü lädt die App bei Strg+R nicht mehr neu.
- **Ansicht:** Menüband „Ansicht“ mit Lesebereich rechts/unten/aus, Unterhaltungen, Gruppen, Kompaktansicht, Ordnerbereich, Mein Tag und Design. Sortierung nach Datum, Von, Betreff, Wichtigkeit oder Kennzeichnung, Gruppen „Heute“, „Gestern“, „Diese Woche“ usw.
- **Lesebereich:** Cc/Bcc-Anzeige, Kategorien, hohe Wichtigkeit, Mehrfachauswahl-Übersicht, weitere Nachrichten derselben Unterhaltung, Drucken und „In neuem Fenster öffnen“.
- **Kalender:** Doppelklick in einen Tag erstellt einen Termin.

„Ordner leeren“ und „Alle als gelesen markieren“ wirken auf die lokal geladenen Nachrichten eines Ordners; für vollständige Ordner vorher „Ganzes Konto laden“ verwenden. Endgültiges Löschen ist nur im Papierkorb möglich und wird vorher bestätigt.

## Externe Voraussetzungen und zusätzliche Implementierung

Der Benutzer hat bestätigt, dass Microsoft-Herausgeberregistrierung und Code-Signing-Zertifikat noch fehlen. Die öffentliche Client-ID muss deshalb weiterhin selbst eingerichtet werden. Der Installer ist unsigniert; automatische Installation unsignierter Updates bleibt gesperrt.

Konto-, Tenant-, Zustellungs- und Einladungstests benötigen eigene Testkonten, gegebenenfalls Lizenzen und Administratorzustimmung. Zugangsdaten und private Zertifikate gehören nicht in Git oder den Chat.

Diese Voraussetzungen erklären **nicht alle offenen Zeilen**. PST/MSG, S/MIME, Add-ins, Exchange-Delegation und weitere Komfortfunktionen benötigen zusätzliche Implementierung. 0.2.1 ist ein großer Ausbau der Entwicklungsversion, keine abgeschlossene Umsetzung der gesamten angeforderten Liste.

## Betriebsgrenzen

- Der gemeinsame Posteingang zeigt den Cache echter Konten. Versand und Aktionen erfolgen über das aktive Konto. Kontowechsel ist während eines offenen Editors gesperrt.
- Hintergrundabruf prüft Posteingänge mindestens einmal pro Minute nach dem Kontointervall. Andere Ordner werden beim Wechsel oder über „Ganzes Konto laden“ aktualisiert. Nach dem Schließen läuft kein Dienst.
- Graph-Auflistungen und IMAP-Vollabruf haben ein Schutzlimit von 50.000 Nachrichten je Ordner. Überläufe werden als unvollständig gemeldet. Große Abrufe können lange dauern.
- Microsoft-Kalender lädt Seiten für ungefähr ein Jahr Vergangenheit und zwei Jahre Zukunft. Komplexe Serienbearbeitung ist nicht vollständig.
- IMAP-Nachrichten über 50 MB werden nur mit Metadaten geladen. Neue Anhänge und Downloads sind auf 20 MB begrenzt.
- SMTP-Annahme bestätigt keine Zustellung. Eine Gesendet-Kopie wird versucht; ein Fehler danach löst keinen Wiederholungsversand aus.
- Die Warteschlange prüft zuerst die Verbindung. Vor dem Sendversuch wird „unklar“ dauerhaft gespeichert. Unklare Vorgänge werden nie automatisch wiederholt; zuerst Gesendet und Zustellung prüfen.
- Entwurfssicherung ist lokal und sichert neue Anhänge als Bytes im Kontospeicher. Bei Kontotrennung werden Warteschlange und Wiederherstellungsdaten entfernt.
- EML-Export rekonstruiert MIME. EML-Import bleibt lokal und übernimmt keine Anhänge. CSV verwendet die exportierten Spalten; ICS-Import unterstützt einzelne Termine.
- Neue Daten liegen in mailbox-v2.json. Die alte mailbox.json wird erst nach erfolgreichem v2-Schreiben entfernt. Alte Programme können v2 nicht überschreiben. OS-Backups liegen außerhalb der Löschgarantie.
