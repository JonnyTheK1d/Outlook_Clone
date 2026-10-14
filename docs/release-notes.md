Postblick 0.3.1 ergänzt Komfortfunktionen aus Outlook und behebt Fehler aus 0.3.0. Die vollständige angeforderte Outlook-Funktionsliste ist noch nicht umgesetzt.

Neu:
- **Rückgängig:** Nach Verschieben, Archivieren oder Löschen bietet die Meldung „Rückgängig“ an, alternativ Strg+Z. Funktioniert auch bei Microsoft-Konten und IMAP-Servern mit UIDPLUS; ohne diese Serverangabe wird kein Rückgängig angeboten.
- **Absender:** „Zu Kontakten hinzufügen“ und „Absender blockieren“ im Lesebereich und im Kontextmenü. Blockieren legt eine Junk-Regel an und verschiebt vorhandene Nachrichten des Absenders.
- **Kontakte:** Weitere E-Mail-Adressen, Telefonnummern und Gruppe direkt im Kontaktdialog.
- **Anhänge per Drag-and-drop** in den Editor (höchstens 20 Dateien und 20 MB).
- **Benachrichtigungen** nennen Absender und Betreff; ein Klick holt Postblick nach vorn und öffnet eine einzelne neue Nachricht.
- **Kalender:** Wochentage, Heute-Markierung, Stundenraster mit Jetzt-Linie in Tag- und Wochenansicht und Doppelklick auf eine Uhrzeit für einen neuen Termin.
- **Drucken** formatierter Nachrichten mit Kopfzeilen und Anlagenliste, ohne aktive Inhalte.

Korrigiert: Monatsraster nach „Heute“ am falschen Wochentag, „Anheften / lösen“ bei Mehrfachauswahl, sich schließende Untermenüs im Kontextmenü, Auswahl nach schnellem Weiterklicken beim Verschieben; Erfolgsmeldungen blenden sich automatisch aus.

**Download:** Unter Assets die vollständige Postblick-0.3.1-Windows-x64-Setup.exe laden. Quellcode-ZIPs sind keine Installer.

Die App startet mit Demo-Daten. Echte Microsoft- und IMAP/SMTP-Konten sind implementiert, aber ohne Testkonten nicht Ende-zu-Ende geprüft. Microsoft benötigt eine eigene Client-ID. Der Installer ist unsigniert, automatische Updateinstallation deaktiviert.

Offen sind unter anderem Kennzeichnung mit Fälligkeit, Zurückstellen, Anhangsvorschau, Spaltenansicht, PST/MSG, S/MIME, Exchange-Freigaben, Add-ins sowie Viren-/Phishingprüfung. [Vollständiger Funktionsstand](https://github.com/JonnyTheK1d/Outlook_Clone/blob/main/docs/feature-status.md).
