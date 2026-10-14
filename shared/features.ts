import type { Command, State, Preferences, CalendarEvent, Mail, SortKey } from './types';
export const defaultPreferences = (): Preferences => ({
  signature: '', notifications: true, syncMinutes: 2, threads: false, readingPane: 'right',
  density: 'comfortable', favorites: ['inbox'], categories: ['Arbeit', 'Privat', 'Wichtig'], templates: [],
  sortBy: 'date', sortDescending: true, groupByDate: true, composeInWindow: false
});
export function normalize(state: State): State {
  state.preferences = { ...defaultPreferences(), ...state.preferences };
  state.folders ||= []; state.rules ||= []; state.outbox ||= []; state.completeFolders ||= [];
  state.calendars ||= [{ id: 'local', name: 'Kalender', visible: true, isDefault: true, canEdit: true }];
  return state;
}
export function localCommand(state: State, command: Command, uuid: () => string): State {
  normalize(state);
  if (command.kind === 'preferences') state.preferences = command.value;
  if (command.kind === 'calendar') {
    if (command.operation === 'create') state.calendars!.push({ id: uuid(), name: command.name!, visible: true, canEdit: true });
    const calendar = state.calendars!.find(c=>c.id===command.id);
    if (command.operation !== 'create' && !calendar) throw new Error('Dieser Kalender ist nicht vorhanden.');
    if (command.operation === 'visibility') calendar!.visible = command.visible!;
    if (command.operation === 'rename') calendar!.name = command.name!;
    if (command.operation === 'delete') {
      if (calendar!.isDefault || state.events.some(e=>e.calendarId===command.id)) throw new Error('Bitte verwende einen leeren zusätzlichen Kalender.');
      state.calendars = state.calendars!.filter(c=>c.id!==command.id);
    }
  }
  if (command.kind === 'autosave') { if (command.message) state.workingDraft = command.message; else delete state.workingDraft; }
  if (command.kind === 'rules') state.rules = command.value;
  if (command.kind === 'metadata') for (const mail of state.mails.filter(m => command.ids.includes(m.id))) {
    if (command.pinned !== undefined) mail.pinned = command.pinned;
    if (command.category !== undefined) mail.categories = command.category ? [command.category] : [];
  }
  if (command.kind === 'folder') {
    if (command.operation === 'create') state.folders!.push({ id: 'custom:' + uuid(), name: command.name!, parent: command.parent });
    if (command.operation === 'rename') { const folder = state.folders!.find(f => f.id === command.id); if (!folder) throw new Error('Dieser Ordner ist nicht vorhanden.'); folder.name = command.name!; }
    if (command.operation === 'delete') {
      if (state.mails.some(m => m.folder === command.id) || state.folders!.some(f => f.parent === command.id)) throw new Error('Bitte leere zuerst den Ordner und entferne Unterordner.');
      state.folders = state.folders!.filter(f => f.id !== command.id);
    }
  }
  if (command.kind === 'batch' && (command.action === 'move' || command.action === 'delete')) state.undo = { moves: state.mails.filter(m => command.ids.includes(m.id)).map(m => ({ id: m.id, folder: m.folder })) };
  if (command.kind === 'undo') {
    for (const move of state.undo?.moves || []) { const mail = state.mails.find(m => m.id === move.id); if (mail) mail.folder = move.folder; }
    delete state.undo;
  }
  if (command.kind === 'batch') for (const mail of state.mails.filter(m => command.ids.includes(m.id))) {
    if (command.action === 'read' || command.action === 'unread') mail.read = command.action === 'read';
    if (command.action === 'flag' || command.action === 'unflag') mail.flagged = command.action === 'flag';
    if (command.action === 'move') mail.folder = command.folder!;
    if (command.action === 'delete') mail.folder = 'trash';
  }
  if (command.kind === 'batch' && command.action === 'purge') {
    if (state.mails.some(m => command.ids.includes(m.id) && m.folder !== 'trash')) throw new Error('Bitte zuerst in den Papierkorb verschieben.');
    state.mails = state.mails.filter(m => !command.ids.includes(m.id));
  }
  if (command.kind === 'queue') state.outbox!.push({ id: uuid(), message: command.message, createdAt: new Date().toISOString(), status: 'pending' });
  if (command.kind === 'outbox' && command.operation === 'cancel') state.outbox = state.outbox!.filter(m => m.id !== command.id);
  return state;
}
export function matches(mail: Mail, query: string): boolean {
  const terms = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return terms.every(term => {
    const match = /^(from|to|subject|category|after|before|has|is):(.*)$/i.exec(term);
    if (!match) return [mail.sender, mail.address, mail.to, mail.subject, mail.body].join(' ').toLowerCase().includes(term.replaceAll('"', '').toLowerCase());
    const value = match[2].replaceAll('"', '').toLowerCase();
    switch (match[1].toLowerCase()) {
      case 'from': return (mail.sender + ' ' + mail.address).toLowerCase().includes(value);
      case 'to': return mail.to.toLowerCase().includes(value);
      case 'subject': return mail.subject.toLowerCase().includes(value);
      case 'category': return (mail.categories || []).some(c => c.toLowerCase().includes(value));
      case 'after': return mail.date.slice(0, 10) >= value;
      case 'before': return mail.date.slice(0, 10) <= value;
      case 'has': return value === 'attachment' && mail.attachments.length > 0;
      case 'is': return value === 'unread' ? !mail.read : value === 'flagged' ? mail.flagged : value === 'pinned' && !!mail.pinned;
    }
    return false;
  });
}
export function occurrences(events: CalendarEvent[], begin: Date, end: Date): CalendarEvent[] {
  return events.flatMap(event => {
    if (!event.recurrence || event.recurrence === 'none') return [event];
    const result: CalendarEvent[] = []; const start = new Date(event.start); const duration = Date.parse(event.end) - start.getTime();
    const until = event.until ? new Date(event.until + 'T23:59:59') : end;
    for (let n = 0; n < 20000 && start <= end && start <= until; n++) {
      if (start.getTime() + duration >= begin.getTime()) {
        const local = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
        result.push({ ...event, start: local(start), end: local(new Date(start.getTime() + duration)) });
      }
      if (event.recurrence === 'daily') start.setDate(start.getDate() + 1);
      if (event.recurrence === 'weekly') start.setDate(start.getDate() + 7);
      if (event.recurrence === 'monthly') { const day = new Date(event.start).getDate(); start.setDate(1); start.setMonth(start.getMonth() + 1); start.setDate(Math.min(day, new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate())); }
    }
    return result;
  });
}
const replyPrefix = /^(?:(?:re|aw|wg|fw|fwd|antw):[ ]*)+/i;
export const baseSubject = (subject: string) => subject.replace(replyPrefix, '').trim();
export const conversationKey = (mail: Mail) => (mail.accountId || '') + '|' + (mail.conversationId || baseSubject(mail.subject).toLowerCase());
const importanceRank = { low: 0, normal: 1, high: 2 };
// Pinned messages stay on top, like Outlook; ties fall back to newest first.
export function sortMails(mails: Mail[], key: SortKey = 'date', descending = true): Mail[] {
  const value = (m: Mail): string | number => key === 'from' ? (m.sender || m.address).toLowerCase() : key === 'subject' ? baseSubject(m.subject).toLowerCase() : key === 'importance' ? importanceRank[m.importance || 'normal'] : key === 'flagged' ? Number(m.flagged) : Date.parse(m.date);
  const compare = (a: string | number, b: string | number) => typeof a === 'string' ? a.localeCompare(b as string, 'de') : a - (b as number);
  return [...mails].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || compare(value(a), value(b)) * (descending ? -1 : 1) || Date.parse(b.date) - Date.parse(a.date));
}
export function dateGroup(value: string, now = new Date()): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const date = new Date(value), today = day(now), diff = Math.round((today - day(date)) / 86400000);
  const weekStart = today - ((now.getDay() + 6) % 7) * 86400000;
  if (diff < 0) return 'Zukünftig';
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Gestern';
  if (day(date) >= weekStart) return 'Diese Woche';
  if (day(date) >= weekStart - 7 * 86400000) return 'Letzte Woche';
  if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) return 'Diesen Monat';
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  if (date.getFullYear() === previous.getFullYear() && date.getMonth() === previous.getMonth()) return 'Letzten Monat';
  return 'Älter';
}
export function groupLabel(mail: Mail, key: SortKey, now = new Date()): string {
  if (mail.pinned) return 'Angeheftet';
  if (key === 'from') return mail.sender || mail.address || 'Unbekannt';
  if (key === 'subject') return baseSubject(mail.subject) || '(Kein Betreff)';
  if (key === 'importance') return 'Wichtigkeit: ' + ({ low: 'Niedrig', normal: 'Normal', high: 'Hoch' })[mail.importance || 'normal'];
  if (key === 'flagged') return mail.flagged ? 'Zur Nachverfolgung' : 'Nicht gekennzeichnet';
  return dateGroup(mail.date, now);
}
