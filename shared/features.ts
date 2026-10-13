import type { Command, State, Preferences, CalendarEvent, Mail } from './types';
export const defaultPreferences = (): Preferences => ({
  signature: '', notifications: true, syncMinutes: 2, threads: false, readingPane: 'right',
  density: 'comfortable', favorites: ['inbox'], categories: ['Arbeit', 'Privat', 'Wichtig'], templates: []
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
  if (command.kind === 'batch') for (const mail of state.mails.filter(m => command.ids.includes(m.id))) {
    if (command.action === 'read' || command.action === 'unread') mail.read = command.action === 'read';
    if (command.action === 'flag' || command.action === 'unflag') mail.flagged = command.action === 'flag';
    if (command.action === 'move') mail.folder = command.folder!;
    if (command.action === 'delete') mail.folder = 'trash';
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
