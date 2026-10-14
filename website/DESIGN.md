---
name: Postblick Website
description: Die Landingpage als aufgeschlagenes Software-Handbuch mit farbigen Registerkarten.
colors:
  chrome-yellow: "#f2c230"
  oxide-orange: "#e2692c"
  teal: "#1f9a8c"
  grass: "#529b3d"
  ultramarine: "#2b4cc9"
  violet: "#6f4ab8"
  sienna: "#93472a"
  vermilion: "#c7321b"
  print-ink: "#18160f"
  ink-soft: "#3d3a31"
  paper: "#f9faf7"
  acetate: "rgb(246 248 245 / .9)"
typography:
  display:
    fontFamily: "Archivo, Arial Narrow, sans-serif"
    fontSize: "clamp(3.1rem, 7.4vw, 6rem)"
    fontWeight: 820
    lineHeight: 0.9
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 66"
  headline:
    fontFamily: "Archivo, Arial Narrow, sans-serif"
    fontSize: "clamp(2.3rem, 5vw, 4.4rem)"
    fontWeight: 800
    lineHeight: 0.94
    fontVariation: "'wdth' 68"
  label:
    fontFamily: "Archivo, Arial Narrow, sans-serif"
    fontSize: "0.86rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.13em"
  body:
    fontFamily: "EB Garamond, Garamond, Times New Roman, serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.55
  lead:
    fontFamily: "EB Garamond, Garamond, Times New Roman, serif"
    fontSize: "clamp(1.19rem, 1.45vw, 1.3rem)"
    fontWeight: 400
    lineHeight: 1.55
  mono:
    fontFamily: "JetBrains Mono, Consolas, monospace"
    fontSize: "0.8rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  leaf: "3px"
  key: "4px"
  template: "7px"
  tab: "9px"
spacing:
  gutter: "clamp(20px, 3vw, 48px)"
  entry: "clamp(32px, 4vw, 52px)"
  section: "clamp(36px, 5vw, 64px)"
components:
  button-primary:
    backgroundColor: "{colors.chrome-yellow}"
    textColor: "{colors.print-ink}"
    rounded: "{rounded.leaf}"
    padding: "14px 22px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.print-ink}"
    textColor: "{colors.chrome-yellow}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.print-ink}"
    rounded: "{rounded.leaf}"
    padding: "14px 22px"
  button-secondary-hover:
    backgroundColor: "{colors.print-ink}"
    textColor: "{colors.paper}"
  key:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.print-ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.key}"
  errata-slip:
    backgroundColor: "{colors.vermilion}"
    textColor: "#fff8f0"
    padding: "10px 32px 18px"
---

# Design System: Postblick Website

## Overview

**Creative North Star: "Das aufgeschlagene Handbuch"**

Die Seite ist das Benutzerhandbuch aus einer Software-Box der Neunziger, aufgeschlagen auf dem Schreibtisch: kräftig gefärbte Registerkarten, eine Seite aus milchigem Acetat darüber, Lochung am Rand, eine Kopfzeile mit Kapitel und Seitenzahl. Jedes Kapitel liegt auf seiner eigenen Registerfarbe, und rechts läuft die Leiste der Registerkarten, deren aktuelle herausragt. Ein Handbuch erklärt, statt anzupreisen. Deshalb tragen die Seiten Fakten, Abbildungen mit Nummer und Bildunterschrift und ein ehrliches Errata-Blatt.

Die Dichte ist die eines Nachschlagewerks: schwere, schmal laufende Grotesk-Versalien für Titel, eine Buchschrift für den Lesetext und Monospace nur dort, wo Maschinen sprechen (Tasten, Versionen, Prüfsummen). Bewegung gibt es kaum. Was sich ändert, springt in zwei Schritten um, wie ein umgeklapptes Blatt.

**Key Characteristics:**
- Volle, ungebrochene Registerfarben als Untergrund, eine pro Kapitel.
- Durchscheinende Acetat-Seiten, die die Registerfarbe leicht durchlassen.
- Abbildungen als nummerierte Tafeln mit Rahmen und Bildunterschrift, nie als schwebende Screenshots.
- Die Tastaturschablone aus Acetat als wiedererkennbares Signaturobjekt.
- Zinnoberrot nur für Errata.

## Colors

Eine volle Palette aus sieben Registerfarben auf neutralem Druck- und Papierton; jede Farbe besitzt ein Kapitel und füllt dessen ganzen Untergrund.

### Primary
- **Chromgelb** (chrome-yellow): Titel-Register, Untergrund des ersten Bildschirms, Füllung der Hauptaktion. Die Farbe, mit der man die Seite verbindet.

### Secondary
- **Oxidorange** (oxide-orange): Register „Bedienung“.
- **Petrol** (teal): Register „Deine Daten“; füllt dort die Station „Dein Windows-PC“ im Datenweg.
- **Grasgrün** (grass): Register „Funktionen“.
- **Ultramarin** (ultramarine): Register „Installation“; färbt dort die Schrittnummern.
- **Violett** (violet): Register „Errata“.
- **Siena** (sienna): Register „Anhang“.

### Tertiary
- **Zinnober** (vermilion): ausschließlich das eingeklebte Errata-Blatt.

### Neutral
- **Druckschwarz** (print-ink): Text, Linien, Rahmen, Tastenkappen, Fokusring.
- **Weiches Schwarz** (ink-soft): Bildunterschriften, Nebentext, Metazeilen.
- **Papier** (paper): Tafelgrund der Abbildungen, Tastenkappen, Prüfsummenfeld.
- **Acetat** (acetate): die Seite selbst; zu 90 % deckend (auf Ultramarin, Violett und Siena 93 %), sodass das Register durchscheint.

### Named Rules
**The One Board Rule.** Ein Kapitel, eine Registerfarbe, vollflächig. Registerfarben werden nie als Akzent über eine fremde Fläche gestreut; auf einer Seite tauchen fremde Register nur als Kante des nächsten Registers und in der Registerleiste auf.

**The Errata Rule.** Zinnober bedeutet „Berichtigung“ und kommt nirgends sonst vor.

## Typography

**Display Font:** Archivo (variable Breite, schmal gesetzt bei 62–75 %, mit Arial Narrow als Rückfall)
**Body Font:** EB Garamond (mit Garamond, Times New Roman)
**Label/Mono Font:** JetBrains Mono

**Character:** Ein schmaler, schwerer Grotesk wie aus einem Software-Handbuch trifft auf eine ruhige Buchschrift. Die Grotesk spricht in Versalien und befiehlt, die Garamond erklärt.

### Hierarchy
- **Display** (820, clamp 3.1–6rem, 0.9): nur die Titelzeile auf der ersten Seite, Versalien, Breite 66 %.
- **Headline** (800, clamp 2.3–4.4rem, 0.94): Kapitelüberschriften, Versalien, Breite 68 %.
- **Label** (700, 0.86rem, 0.13em Laufweite, Versalien): Randüberschriften in der Marginalspalte, Registertitel, Schrittnamen.
- **Body** (400, 1.1875rem, 1.55): Fließtext, höchstens 32em breit (etwa 70 Zeichen).
- **Lead** (400, 1.19–1.3rem): Einleitungsabsatz je Kapitel, höchstens 28em.
- **Mono** (500, 0.78–0.86rem): Tasten, Versionsnummern, Dateigrößen, Prüfsummen und Seitenzahlen; nie als Stilmittel für Fließtext.

### Named Rules
**The Machine Voice Rule.** Monospace nur für das, was ein Computer ausgibt oder ein Mensch exakt tippen muss.

**The Margin Head Rule.** Unterüberschriften hängen links in der Marginalspalte neben ihrem Text, nicht darüber.

## Layout

Jedes Kapitel ist ein Register mit einer Acetat-Seite darauf. Die Seite trägt oben eine Kopfzeile (Buchtitel, Kapitel, Seitenzahl) über einer 2px-Linie. Darunter läuft ein Zweispaltenraster: eine Marginalspalte (8.5–12rem) für Randüberschriften, daneben der Text (32em). Breite Elemente (Kapitelüberschrift, Register, Errata-Blatt, Datenweg, große Abbildungen) laufen über beide Spalten. Der erste Bildschirm teilt sich 7 : 6 in Text und Abb. 1, über der die Tastaturschablone schräg liegt.

Rechts sitzt die Registerleiste (54px), deren Kartenhöhe dem Umfang der Kapitel folgt. Abstände: Kapitel-Polster clamp(14px, 2.4vw, 34px), Abschnitte clamp(36px, 5vw, 64px), Einträge clamp(32px, 4vw, 52px), stets mehr Luft über einer Überschrift als darunter. Unter 1100px stapelt sich der erste Bildschirm. Unter 820px wird die Registerleiste zu einem dunklen Streifen am oberen Rand, der die aktuelle Karte mittig hält, und alles läuft einspaltig.

## Elevation & Depth

Tiefe entsteht aus gestapeltem Material, nicht aus schwebenden Karten: Register unter Seite, Seite unter Schablone. Schatten haben immer einen Versatz und eine weiche Unschärfe.

### Shadow Vocabulary
- **Seite** (`box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 10px 24px -14px rgba(24,22,15,.55), 0 2px 5px rgba(24,22,15,.18)`): jede Acetat-Seite.
- **Nächstes Register** (`box-shadow: 0 6px 14px -8px rgba(24,22,15,.6)`): das um 7px versetzte Register des folgenden Kapitels unter der Seite.
- **Schablone** (`box-shadow: 4px 10px 16px -6px rgba(24,22,15,.42)`): die gedrehte Tastaturschablone.
- **Errata-Blatt** (`box-shadow: 0 10px 18px -10px rgba(24,22,15,.6)`): das eingeklebte Blatt.

### Named Rules
**The Stacked Material Rule.** Erhöht ist nur, was physisch auf etwas anderem liegt. Inhalte bekommen keine eigenen Kartenschatten.

## Shapes

Fast rechtwinklig: Seiten und Knöpfe 3px, Tastenkappen 4px, die Schablone 7px, Registerkarten 9px nur an der Außenseite. Linien sind entweder 2px Druckschwarz (Kopfzeile, Abschnittsgrenzen, Stationen) oder 1px Haarlinien in 22 % Schwarz (Tabellen, Register). Die Lochung ist kreisrund und zeigt die Registerfarbe. Gestrichelte Linien bedeuten „nicht vorhanden“ oder „ausgestanzt, aber leer“.

## Components

### Buttons
- **Shape:** fast eckig (3px), 2px Druckschwarz-Rahmen, mindestens 52px hoch.
- **Primary:** Chromgelb mit Druckschwarz, Archivo 700 in Versalien mit 0.08em Laufweite, Download-Symbol als Linienzeichnung.
- **Hover / Focus:** Farbumkehr in zwei Schritten zu 90ms (Druckschwarz mit Chromgelb); Fokusring 3px Druckschwarz mit 3px Abstand.
- **Secondary:** ohne Füllung, gleicher Rahmen; beim Überfahren Druckschwarz mit Papier.

### Navigation
- **Registerleiste:** sieben Karten in den Kapitelfarben, Beschriftung senkrecht in Archivo-Versalien. Inaktive Karten sind 16px eingerückt, die aktuelle steht bündig am Rand (`aria-current`); der Wechsel springt in zwei Schritten. Mobil: waagerechter dunkler Streifen oben.

### Cards / Containers
- **Abbildungstafel:** 1px Druckschwarz-Rahmen, 6px Papierpolster, darunter die Bildunterschrift „Abb. n“ in Label-Schrift und Garamond. Echte Bildschirmfotos sind als Beispieldaten gekennzeichnet.

### Tastaturschablone (Signature Component)
Ein Blatt Acetat (78 % deckend), um −2.4° gedreht, mit zwei Lochungen, liegt über Abb. 1. Jede Zeile ist ein Knopf mit Tastenkappen und Funktion. Ausgewählt heißt „ausgestanzt“: Die gestrichelte Lochmarke wird zum gefüllten Loch in der Registerfarbe, die Tastenkappen kehren sich um. Ist die Schablone fokussiert, stanzen echte Tastenkürzel die passende Zeile und tauschen die Bildunterschrift.

### Errata-Blatt (Signature Component)
Ein einziges zinnoberrotes Blatt, um −0.5° gedreht, mit Kopfzeile „Errata · Postblick x.y.z“, nummerierten Einträgen und hellen Trennlinien.

## Do's and Don'ts

### Do:
- **Do** jedem Kapitel genau eine Registerfarbe vollflächig geben und das nächste Register unter der Seite hervorschauen lassen.
- **Do** Abbildungen nummerieren, rahmen und mit einer Bildunterschrift versehen; Demo-Inhalte als Beispieldaten kennzeichnen.
- **Do** Zustandswechsel als Zweischritt in 90ms (`steps(2)`) setzen und bei reduzierter Bewegung ganz weglassen.
- **Do** Fließtext auf höchstens 32em und Einleitungen auf 28em begrenzen.

### Don't:
- **Don't** Registerfarben als Akzentstreifen, Seitenkanten-Balken oder Verlauf verwenden.
- **Don't** Zinnober außerhalb von Errata einsetzen.
- **Don't** weiche Übergänge mit Easing oder sanftes Scrollen verwenden; Blätter springen, sie gleiten nicht.
- **Don't** gleich große Karten mit Symbol, Überschrift und Text als Seitenstruktur bauen.
- **Don't** Monospace als Dekor für Fließtext einsetzen.
