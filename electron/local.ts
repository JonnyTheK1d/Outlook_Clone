import { randomUUID } from 'node:crypto';
import type { MailAction, Outgoing, State } from '../shared/types';
export function applyLocalAction(state: State, action: MailAction): State {
  const mail = state.mails.find(m => m.id === action.id);
  if (!mail) throw new Error('Die Nachricht ist nicht mehr vorhanden.');
  if (action.kind === 'read') mail.read = action.value;
  if (action.kind === 'flag') mail.flagged = action.value;
  if (action.kind === 'move') mail.folder = action.folder;
  if (action.kind === 'delete') state.mails = state.mails.filter(m => m.id !== action.id);
  return state;
}
export function localOutgoing(state: State, message: Outgoing, draft: boolean) {
  const id = draft && message.draftId ? message.draftId : randomUUID();
  state.mails = state.mails.filter(mail => mail.id !== message.draftId);
  state.mails.unshift({ id, folder: draft ? 'drafts' : 'sent', sender: state.name, address: state.email, to: message.to, cc: message.cc, bcc: message.bcc, html: message.html, importance: message.importance, subject: message.subject || '(Kein Betreff)', body: message.body, date: new Date().toISOString(), read: true, flagged: false, attachments: message.attachments });
  return state;
}
