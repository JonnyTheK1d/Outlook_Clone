# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The product itself is a Windows desktop app (Electron); this record serves its web presence. The marketing site lives in `website/`.

## Stack

delegated: static HTML/CSS (plus a small amount of vanilla JavaScript) in `website/`, with no build step and no dependencies, so it can be served directly by GitHub Pages or opened from disk. Chosen because the site is a single persuasive page and the repository already ships the app with a separate toolchain.

## Users

Primary: private Windows 10/11 users who want an Outlook-like desktop mail app for their own accounts (Outlook.com / Microsoft 365, Gmail, GMX, WEB.DE, Yahoo, iCloud or any IMAP/SMTP provider) and who care that their data stays on their own computer. They evaluate the app by downloading a free installer and trying it.

## Product Purpose

Postblick is a German-language desktop client for mail, calendar, contacts and tasks with an interface modelled on Outlook. It exists so people can work the way they are used to from Outlook while account credentials and the mail cache stay encrypted locally. Success: a visitor downloads the installer, starts the demo, and connects their own account.

## Positioning

Familiar Outlook-style operation with your own data: double-click opens a message in its own window, Outlook keyboard shortcuts, context menus, ribbon, reading pane, undo — while credentials and cache are encrypted with Windows DPAPI on the user's machine, there is no Postblick server in between, and the source is open (MIT).

Postblick is not a Microsoft product and must never be presented as one or use Microsoft branding.

## Operating Context

- Distributed as an unsigned NSIS installer (`Postblick-<version>-Windows-x64-Setup.exe`, ~114 MiB) through GitHub Releases; Windows SmartScreen may warn.
- Starts in a clearly labelled local demo mode; no mail is sent in demo mode.
- Microsoft accounts require the user's own Entra public client ID (no secret); IMAP/SMTP requires TLS (993; 465 or 587 with STARTTLS) and usually an app password.
- Latest published release: 0.3.0 (https://github.com/JonnyTheK1d/Outlook_Clone/releases/tag/v0.3.0). 0.3.1 is built but not yet released.

## Capabilities and Constraints

Confirmed capabilities (0.3.0, plus 0.3.1 where noted):
- Multiple encrypted accounts, unified inbox, background fetch, Windows notifications and taskbar unread indicator.
- Separate read and compose windows (double-click / Enter), Outlook shortcuts (Ctrl+R, Ctrl+Shift+R, Ctrl+F, Ctrl+Q/U, Delete, Backspace archive, Ctrl+1–4, F9), context menus for messages and folders, Ctrl/Shift multi-select, drag-and-drop to folders, View ribbon (reading pane right/bottom/off, conversations, groups, compact), sorting and date groups.
- Folders, favourites, categories, pinning, local rules, search grammar (from:, subject:, after:, has:attachment …) and server search.
- Composer with Bcc, signatures, templates, formatting, scheduled send queue, local autosave, 20 MB attachments.
- Calendar (day/week/month, multiple calendars, series, reminders, Teams meetings for Microsoft), contacts with groups, tasks / Microsoft To Do, CSV/ICS/EML import and export, printing, mailto registration, light/dark theme.
- 0.3.1: undo for moves/deletes, add/block sender, drag files into composer, clickable notifications, hourly calendar grid.

Constraints that must be stated honestly:
- Early development version; real account flows not end-to-end tested without test accounts.
- No independent security audit; installer not code-signed; automatic updates disabled.
- Not a full Outlook replacement: no PST/MSG, S/MIME, shared Exchange mailboxes, add-ins.
- Windows x64 only; macOS not packaged.

## Brand Commitments

- Name: Postblick. Language: German, informal "du".
- App icon: `build/icon.svg` / `build/icon.png` (blue envelope mark).
- The app's own UI uses a blue (#0867c5 / #0052a7) Outlook-adjacent palette; the website is free to establish its own world.
- Must include the statement that Postblick is not a Microsoft product.

## Evidence on Hand

- Real app screenshot: `docs/screenshots/postfach.png`; further screenshots can be captured from the running browser demo (`npm run dev:web`).
- Validation records: `docs/validation.md` (test counts, installer checksums, Windows CI runs); feature matrix: `docs/feature-status.md`; security notes: `SECURITY.md`.
- License: MIT (`LICENSE`).
- Absent and never to be fabricated: user counts, testimonials, press, ratings, download numbers, company/team claims, pricing (the app is free), security certifications.

## Product Principles

1. Familiarity first: if Outlook users know a gesture or shortcut, Postblick should honour it.
2. Your data stays yours: local, encrypted storage; no intermediary service.
3. Honest by default: limitations, missing signatures and untested flows are stated, not hidden.
4. Calm, dense productivity over spectacle inside the app.

## Accessibility & Inclusion

German-language audience; the site should meet WCAG 2.2 AA (contrast, keyboard navigation, reduced motion).
