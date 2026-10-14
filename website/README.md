# Postblick-Webseite

Statische Landingpage für Postblick im Stil eines aufgeschlagenen Software-Handbuchs: farbige Registerkarten je Kapitel, eine Tastaturschablone mit den Outlook-Kürzeln und ein ehrliches Errata-Blatt.

## Ansehen

`index.html` direkt im Browser öffnen. Es gibt keinen Build-Schritt und keine Abhängigkeiten; Schriften und Bilder liegen im Ordner.

## Mit GitHub Pages veröffentlichen

Im Repository unter **Settings → Pages** als Quelle **GitHub Actions** wählen und einen Workflow anlegen, der den Ordner `website/` als Pages-Artefakt hochlädt (`actions/upload-pages-artifact` mit `path: website`, danach `actions/deploy-pages`). Alternativ den Inhalt von `website/` in einen eigenen `gh-pages`-Branch kopieren.

## Inhalt

| Datei | Zweck |
| --- | --- |
| `index.html` | Seite mit allen Kapiteln |
| `styles.css` | Gestaltung, Tab-Leiste, Mobilansicht |
| `app.js` | Tastaturschablone, aktive Registerkarte, Prüfsumme kopieren; die Seite funktioniert auch ohne |
| `assets/*.webp` | Bildschirmfotos aus dem Demo-Modus von Postblick 0.3.0; die Herkunft steht in der jeweiligen `.json`-Datei daneben |
| `fonts/` | Archivo, EB Garamond, JetBrains Mono (SIL Open Font License, Lizenztexte daneben) |

## Bei einem neuen Release anpassen

Download-Links, Versionsnummer, Dateigröße und SHA-256 stehen fest in `index.html` (Suche nach `0.3.0`). Die Bildschirmfotos sollten aus derselben Version stammen, die zum Download angeboten wird.

Postblick ist kein Microsoft-Produkt.
