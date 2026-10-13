# Funktionsvergleich mit Outlook – Postblick 0.2.1

„Implementiert“ bezeichnet den vorhandenen Code, nicht eine Prüfung mit echten Konten. Microsoft- und IMAP-Testkonten fehlen. Eine vollständige Outlook-Parität und ein vergleichbares Sicherheitsniveau sind nicht nachgewiesen.

| Bereich | Implementiert in 0.2.1 | Noch offen |
| --- | --- | --- |
| Konten | Verschlüsselter Mehrkontenspeicher, Kontowechsel, gemeinsamer Posteingang aus dem Cache | OAuth anderer Anbieter; Herausgeber-Client-ID für Microsoft |
| Serverkonfiguration | Vorgaben für Gmail, GMX, WEB.DE, Yahoo, iCloud | Allgemeines Autodiscover; getrennte SMTP-Zugangsdaten |
| Empfang | Hintergrundabruf, Kontointervall, Windows-Benachrichtigungen und Taskleistenindikator | IMAP IDLE/Graph Push; geschlossene App |
| Ordner | Erstellen, Umbenennen, Löschen leerer zusätzlicher Ordner; Unterordner; Favoriten | Suchordner; komplexe IMAP-Hierarchieanzeige |
| Suche | Seitenabruf, alle geladenen Ordner, Filtergrammatik, Graph-/IMAP-Serversuche | Graph maximal 1000 Suchtreffer je Ordner; großer lokaler Suchindex |
| Organisation | Kategorien, Pinning, Mehrfachaktionen, Drag-and-drop in eigene Ordner, Organisationsleiste per Rechtsklick | Relevant/Sonstige; vollständige Unterhaltungshistorie; Undo |
| Regeln | Lokale Absender-/Betreffbedingungen, Verschieben und Gelesen-Markierung | Serverregelverwaltung, Auto-Weiterleitung, Quick Steps |
| Abwesenheit | Microsoft-Antwort aktivieren/deaktivieren | Andere Anbieter; Zeitplan |
| HTML | DOMPurify-Bereinigung, Formatierung, Listen, HTTPS-Links mit Zielbestätigung, vorhandene Datenbilder | Vollständiger CSS-/Schrift-/Tabelleneditor, CID-Bilder und Bildauswahl |
| Schreiben | Bcc, Signatur, Vorlagen, Kontaktvorschläge, OS-Rechtschreibung, lokale Autosicherung mit Anhangssnapshot | Vollständige Empfängerchips; allgemeine serverseitige IMAP-Autosicherung |
| Versand | Priorität, Lesebestätigung, Microsoft-Zustellbestätigungsanforderung, geplante Warteschlange | Rückruf; Versand bei geschlossener App; Zustellung ist nicht garantiert |
| Antworten | Reply-To, Graph-Antwort-/Weiterleitungsaktionen, IMAP-Referenzen, Weiterleitungsanhänge | Bearbeitung ursprünglicher HTML-Unterhaltungen |
| Anhänge | 20 MB/20 neue Dateien, Graph-Uploadsession, Entwurfsanhänge entfernen, Download | Vorschau, Cloud-Dateilinks und Virenscan |
| Offline | Geladener Cache, Entwurfswiederherstellung, dauerhafte Versandwarteschlange | Warteschlange für andere Änderungen; Konfliktauflösung |
| Kalender | Tag/Woche/Monat, mehrere Kalender, Sichtbarkeit, Ganztag, einfache Serien, Erinnerungen | Freigaben, freie Zeitzonenauswahl, Serienausnahmen, uneingeschränkter Zeitraum |
| Besprechungen | Microsoft-Teilnehmer, Antworten, Teams-Erstellung für unterstützte Konten | Verfügbarkeit, Terminvorschläge, Räume, IMAP-Einladungen |
| Kontakte | Weitere Adressen/Telefone, Gruppen, Gruppen-Bcc, CSV | Fotos, Firmenadressbuch, vCard, Outlook-Verteilerobjekte |
| Aufgaben | Listenbezeichnung, Notizen, Unteraufgaben, Erinnerungen, Wiederholung, Microsoft To Do | Listenübergreifendes Verschieben, delegierte Aufgaben, alle Outlook-Felder |
| Exchange | Eigene Graph-Mailbox | Freigegebene Postfächer, Stellvertretung, Senden als, öffentliche Ordner, Gruppen |
| Daten | Rekonstruierter EML-Export, lokaler EML-Import, CSV-Kontakte, ICS-Kalender, Drucken | PST/MSG, MIME-Originalarchiv, EML-Importanhänge, komplexer ICS-Serienimport |
| Windows | Mailto-Parser, Standard-App-Registrierung, Drucken, Lesebereich/Dichte | Separate Fenster, Spalten, vollständige Kontextmenüs/Kürzel, Add-ins |
| Updates | Versionsprüfung/Download-Link; Signaturprüfung für spätere automatische Updates vorbereitet | Automatische Installation bleibt ohne Zertifikat und Signaturtests deaktiviert |
| Sicherheit | Isolation, Mehrkontenverschlüsselung, TLS, PKCE, IPC-Validierung, HTML-Bereinigung | S/MIME, Microsoft-Nachrichtenverschlüsselung, Phishing-/Malware-Prüfung, Unternehmensrichtlinien, Audit |

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
