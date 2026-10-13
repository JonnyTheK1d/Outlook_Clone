import type { State } from './types';
export function createDemo(): State {
  const now = new Date();
  const date = (hours: number) => new Date(now.getTime() - hours * 3600000).toISOString();
  const today = now.toISOString().slice(0, 10);
  return {
    mode: 'demo', email: 'alex.beispiel@postblick.local', name: 'Alex Beispiel', theme: 'light', updatedAt: null,
    mails: [
      { id: 'demo-1', folder: 'inbox', sender: 'Sophie Weber', address: 'sophie@example.com', to: 'alex.beispiel@postblick.local', subject: 'Ein guter Start in die Woche ☀️', body: 'Hallo Alex,\n\nunsere neue Projektübersicht ist fertig. Lass uns morgen gemeinsam die nächsten Schritte durchgehen. Ich habe uns dafür einen Termin um 10 Uhr eingestellt.\n\nWenn du vorher noch Ideen hast, schick sie mir gerne.\n\nViele Grüße\nSophie\n\nHinweis: Diese Nachricht ist ein lokales Demo-Beispiel.', date: date(0.2), read: false, flagged: false, attachments: [] },
      { id: 'demo-2', folder: 'inbox', sender: 'Daniel Fischer', address: 'daniel@example.com', to: 'alex.beispiel@postblick.local', subject: 'Design-Review · Donnerstag', body: 'Hallo Alex,\n\nfür Donnerstag habe ich die wichtigsten Entwürfe zusammengestellt. Wir schauen uns Navigation, Farben und die neue Startseite an.\n\nPasst dir 14:00 Uhr?\n\nBeste Grüße\nDaniel', date: date(1.5), read: false, flagged: true, attachments: [] },
      { id: 'demo-3', folder: 'inbox', sender: 'Mara Hoffmann', address: 'mara@example.com', to: 'alex.beispiel@postblick.local', subject: 'Kaffee und ein paar neue Ideen', body: 'Hi Alex,\n\nhast du diese Woche Zeit für einen Kaffee? Ich würde gerne über die Ideen aus unserem letzten Gespräch sprechen.\n\nLiebe Grüße\nMara', date: date(3), read: true, flagged: false, attachments: [] },
      { id: 'demo-4', folder: 'inbox', sender: 'Postblick Team', address: 'willkommen@postblick.local', to: 'alex.beispiel@postblick.local', subject: 'Willkommen in deinem neuen Postfach', body: 'Willkommen bei Postblick!\n\nDeine E-Mails, Termine, Kontakte und Aufgaben haben hier einen gemeinsamen Platz.\n\nDu befindest dich im Demo-Modus. Alle Beispielnachrichten und Änderungen bleiben lokal. Es werden keine E-Mails verschickt.\n\nÖffne die Einstellungen, um Microsoft 365 / Outlook.com oder ein IMAP/SMTP-Konto zu verbinden. Für echte Konten benötigt Postblick einen sicheren Betriebssystem-Schlüsselspeicher.\n\nViel Spaß beim Ausprobieren!\nDein Postblick Team', date: date(5), read: true, flagged: false, attachments: [] },
      { id: 'demo-5', folder: 'inbox', sender: 'Lena Schneider', address: 'lena@example.com', to: 'alex.beispiel@postblick.local', subject: 'Notizen aus unserem Workshop', body: 'Hallo zusammen,\n\nhier sind die wichtigsten Ergebnisse:\n\n• Ein klarer Fokus auf die täglichen Aufgaben\n• Weniger Ablenkung beim Lesen\n• Kurze Wege zum Kalender\n\nDanke für den produktiven Austausch!\nLena', date: date(22), read: true, flagged: false, attachments: [] },
      { id: 'demo-6', folder: 'sent', sender: 'Alex Beispiel', address: 'alex.beispiel@postblick.local', to: 'sophie@example.com', subject: 'Re: Projektplanung', body: 'Hallo Sophie,\n\nvielen Dank! Ich freue mich auf den Austausch.\n\nAlex', date: date(25), read: true, flagged: false, attachments: [] }
    ],
    events: [{ id: 'event-demo', title: 'Projektbesprechung', start: today + 'T10:00:00', end: today + 'T11:00:00', location: 'Besprechungsraum 2', notes: 'Nächste Schritte gemeinsam planen.' }],
    contacts: [
      { id: 'contact-1', name: 'Sophie Weber', email: 'sophie@example.com', phone: '+49 30 123456', company: 'Studio Nord' },
      { id: 'contact-2', name: 'Daniel Fischer', email: 'daniel@example.com', phone: '', company: 'Studio Nord' },
      { id: 'contact-3', name: 'Mara Hoffmann', email: 'mara@example.com', phone: '', company: 'Kreativbüro' }
    ],
    tasks: [{ id: 'task-1', title: 'Projektübersicht durchsehen', due: today, done: false }, { id: 'task-2', title: 'Design-Feedback vorbereiten', due: '', done: false }]
  };
}
