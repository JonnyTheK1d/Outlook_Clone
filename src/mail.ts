import type { Attachment, Mail, Outgoing, State } from '../shared/types';
import { baseSubject } from '../shared/features';

export const fullDate = (value: string) => new Date(value).toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
export const shortDate = (value: string) => new Date(value).toDateString() === new Date().toDateString() ? new Date(value).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : new Date(value).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
export const initials = (name: string) => name.split(/[ @.]+/).filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
export const newMessage = (signature = ''): Outgoing => ({ to: '', cc: '', bcc: '', subject: '', body: signature ? '\n\n' + signature : '', attachments: [] });
export const standardFolders = [{ id: 'inbox', label: 'Posteingang' }, { id: 'sent', label: 'Gesendet' }, { id: 'drafts', label: 'Entwürfe' }, { id: 'archive', label: 'Archiv' }, { id: 'junk', label: 'Junk-E-Mail' }, { id: 'trash', label: 'Papierkorb' }];
export const folderName = (state: State, id: string) => standardFolders.find(f => f.id === id)?.label || state.folders?.find(f => f.id === id)?.name || id;
export type ReplyKind = 'reply' | 'replyAll' | 'forward';
export function replyMessage(mail: Mail, state: State, kind: ReplyKind): Outgoing {
  const replyTo = mail.folder === 'sent' ? mail.to : mail.replyTo || mail.address;
  const recipients = [replyTo, ...(kind === 'replyAll' ? (mail.to + ',' + (mail.cc || '')).split(/[;,]/) : [])].map(v => v.trim()).filter(v => v && v.toLowerCase() !== state.email.toLowerCase());
  const signature = state.preferences?.signature ? '\n\n' + state.preferences.signature : '';
  return { to: kind === 'forward' ? '' : [...new Set(recipients)].join(', '), cc: '', bcc: '', replyId: kind === 'forward' ? undefined : mail.id, replyAll: kind === 'replyAll', forwardId: kind === 'forward' ? mail.id : undefined, subject: (kind === 'forward' ? 'WG: ' : 'Re: ') + baseSubject(mail.subject), body: `${signature}\n\n---------- ${kind === 'forward' ? 'Weitergeleitete Nachricht' : 'Ursprüngliche Nachricht'} ----------\nVon: ${mail.sender} <${mail.address}>\nDatum: ${fullDate(mail.date)}\nAn: ${mail.to}${mail.cc ? '\nCc: ' + mail.cc : ''}\nBetreff: ${mail.subject}\n\n${mail.body}`, attachments: [] };
}
export const draftMessage = (mail: Mail): { message: Outgoing; existing: Attachment[] } => ({ message: { to: mail.to, cc: mail.cc || '', bcc: mail.bcc || '', html: mail.html, subject: mail.subject, body: mail.body, attachments: [], draftId: mail.id }, existing: mail.attachments });
export const typingTarget = (target: EventTarget | null) => !!(target as HTMLElement | null)?.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable=""]');
