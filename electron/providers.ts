import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import type { Attachment, CalendarEvent, Contact, Folder, Mail, MailAction, Outgoing } from '../shared/types';
import type { Credentials } from './store';
import { refresh } from './oauth';
import { recipients } from './validation';

export interface FileAttachment { name: string; content: Buffer }
export interface Provider {
  profile(): Promise<{ email: string; name: string }>;
  list(folder: Folder): Promise<Mail[]>;
  action(mail: Mail, action: MailAction): Promise<void>;
  send(message: Outgoing, files: FileAttachment[]): Promise<void>;
  draft(message: Outgoing, files: FileAttachment[]): Promise<string>;
  attachment(mail: Mail, id: string): Promise<Buffer>;
}
const graphFolders: Record<Folder, string> = { inbox: 'inbox', sent: 'sentitems', drafts: 'drafts', archive: 'archive', junk: 'junkemail', trash: 'deleteditems' };
const segment = encodeURIComponent;
function uid(id: string, client: ImapFlow) {
  const value = /^(?:inbox|sent|drafts|archive|junk|trash):(\d+):(\d+)$/.exec(id);
  if (!value || !client.mailbox || String(client.mailbox.uidValidity) !== value[1]) throw new Error('Die Nachrichtenkennung ist veraltet. Bitte synchronisiere den Ordner erneut.');
  return value[2];
}
type GraphItem = Record<string, any>;

export class MicrosoftProvider implements Provider {
  constructor(private credentials: Extract<Credentials, { type: 'microsoft' }>, private persist: (credentials: Credentials) => Promise<void>) {}
  private async request(route: string, method = 'GET', body?: unknown): Promise<any> {
    if (this.credentials.expiresAt < Date.now() + 60000) { this.credentials = await refresh(this.credentials); await this.persist(this.credentials); }
    const response = await fetch('https://graph.microsoft.com/v1.0/me' + route, {
      method, redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Authorization: 'Bearer ' + this.credentials.accessToken, 'Content-Type': 'application/json', Prefer: 'outlook.body-content-type="text", outlook.timezone="UTC"' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error('Die Microsoft-Sitzung ist abgelaufen. Bitte verbinde das Konto erneut.');
      if (response.status === 429) throw new Error('Microsoft begrenzt gerade die Anfragen. Bitte später erneut synchronisieren.');
      throw new Error(`Microsoft-Anfrage fehlgeschlagen (HTTP ${response.status}). Prüfe Berechtigungen und Internetverbindung.`);
    }
    return response.status === 204 || response.status === 202 ? undefined : response.json();
  }
  async profile() { const result = await this.request('?$select=displayName,mail,userPrincipalName'); return { email: result.mail || result.userPrincipalName, name: result.displayName }; }
  async list(folder: Folder): Promise<Mail[]> {
    const result = await this.request(`/mailFolders/${graphFolders[folder]}/messages?$top=100&$orderby=receivedDateTime%20desc&$select=id,subject,body,from,toRecipients,ccRecipients,receivedDateTime,isRead,flag,hasAttachments`);
    return Promise.all(result.value.map(async (item: GraphItem): Promise<Mail> => ({
      id: item.id, folder, sender: item.from?.emailAddress?.name || item.from?.emailAddress?.address || 'Unbekannt', address: item.from?.emailAddress?.address || '',
      to: (item.toRecipients || []).map((r: GraphItem) => r.emailAddress.address).join(', '), cc: (item.ccRecipients || []).map((r: GraphItem) => r.emailAddress.address).join(', '), subject: item.subject || '(Kein Betreff)', body: item.body?.content || '', date: item.receivedDateTime,
      read: item.isRead, flagged: item.flag?.flagStatus === 'flagged',
      attachments: item.hasAttachments ? (await this.request(`/messages/${segment(item.id)}/attachments?$select=id,name,size,isInline`)).value.filter((a: GraphItem) => !a.isInline && a['@odata.type'] === '#microsoft.graph.fileAttachment').map((a: GraphItem): Attachment => ({ id: a.id, name: a.name, size: a.size })) : []
    })));
  }
  async action(mail: Mail, action: MailAction) {
    const route = '/messages/' + segment(mail.id);
    if (action.kind === 'read') await this.request(route, 'PATCH', { isRead: action.value });
    if (action.kind === 'flag') await this.request(route, 'PATCH', { flag: { flagStatus: action.value ? 'flagged' : 'notFlagged' } });
    if (action.kind === 'move') await this.request(route + '/move', 'POST', { destinationId: graphFolders[action.folder] });
    if (action.kind === 'delete') await this.request(route, 'DELETE');
  }
  private payload(message: Outgoing, files: FileAttachment[]) {
    return { subject: message.subject, body: { contentType: 'Text', content: message.body }, toRecipients: recipients(message.to).map(address => ({ emailAddress: { address } })), ccRecipients: recipients(message.cc).map(address => ({ emailAddress: { address } })), attachments: files.map(file => ({ '@odata.type': '#microsoft.graph.fileAttachment', name: file.name, contentBytes: file.content.toString('base64') })) };
  }
  async send(message: Outgoing, files: FileAttachment[]) {
    if (message.draftId) {
      const id = await this.draft(message, files);
      await this.request('/messages/' + segment(id) + '/send', 'POST');
    } else await this.request('/sendMail', 'POST', { message: this.payload(message, files), saveToSentItems: true });
  }
  async draft(message: Outgoing, files: FileAttachment[]): Promise<string> {
    if (!message.draftId) return (await this.request('/messages', 'POST', this.payload(message, files))).id;
    const payload = this.payload(message, []);
    const { attachments: _, ...fields } = payload;
    await this.request('/messages/' + segment(message.draftId), 'PATCH', fields);
    // Existing attachments remain on the server; only newly selected files are added.
    for (const attachment of this.payload(message, files).attachments) await this.request('/messages/' + segment(message.draftId) + '/attachments', 'POST', attachment);
    return message.draftId;
  }
  async attachment(mail: Mail, id: string) { const result = await this.request(`/messages/${segment(mail.id)}/attachments/${segment(id)}`); if (typeof result.contentBytes !== 'string') throw new Error('Dieser Anhangstyp wird noch nicht unterstützt.'); return Buffer.from(result.contentBytes, 'base64'); }
  async events(): Promise<CalendarEvent[]> {
    const begin = new Date(Date.now() - 90 * 86400000).toISOString();
    const end = new Date(Date.now() + 90 * 86400000).toISOString();
    const data = await this.request(`/calendarView?startDateTime=${segment(begin)}&endDateTime=${segment(end)}&$top=100`);
    return data.value.map((event: GraphItem) => ({ id: event.id, title: event.subject, start: utcToLocal(event.start.dateTime), end: utcToLocal(event.end.dateTime), location: event.location?.displayName || '', notes: event.bodyPreview || '' }));
  }
  async saveEvent(event: Omit<CalendarEvent, 'id'> & { id?: string }) {
    const fields = { subject: event.title, start: { dateTime: new Date(event.start).toISOString(), timeZone: 'UTC' }, end: { dateTime: new Date(event.end).toISOString(), timeZone: 'UTC' }, location: { displayName: event.location }, body: { contentType: 'Text', content: event.notes } };
    const result = await this.request(event.id ? '/events/' + segment(event.id) : '/events', event.id ? 'PATCH' : 'POST', fields);
    return result.id as string;
  }
  async deleteEvent(id: string) { await this.request('/events/' + segment(id), 'DELETE'); }
  async contacts(): Promise<Contact[]> { const result = await this.request('/contacts?$top=100'); return result.value.map((contact: GraphItem) => ({ id: contact.id, name: contact.displayName || '', email: contact.emailAddresses?.[0]?.address || '', phone: contact.mobilePhone || contact.businessPhones?.[0] || '', company: contact.companyName || '' })); }
  async saveContact(contact: Omit<Contact, 'id'> & { id?: string }) { const result = await this.request(contact.id ? '/contacts/' + segment(contact.id) : '/contacts', contact.id ? 'PATCH' : 'POST', { displayName: contact.name, givenName: contact.name, emailAddresses: [{ address: contact.email, name: contact.name }], mobilePhone: contact.phone, companyName: contact.company }); return result.id as string; }
  async deleteContact(id: string) { await this.request('/contacts/' + segment(id), 'DELETE'); }
}
function utcToLocal(value: string) { const date = new Date(value.endsWith('Z') ? value : value + 'Z'); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19); }

export class ImapProvider implements Provider {
  constructor(private settings: Extract<Credentials, { type: 'imap' }>) {}
  private async session<T>(callback: (client: ImapFlow, folders: Record<Folder, string>) => Promise<T>): Promise<T> {
    const client = new ImapFlow({ host: this.settings.imapHost, port: this.settings.imapPort, secure: true, auth: { user: this.settings.email, pass: this.settings.password }, tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true }, logger: false, connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 30000 });
    // Do not emit credentials or protocol content in diagnostics.
    client.on('error', () => {});
    try {
      await client.connect();
      const boxes = await client.list();
      const special: Record<Folder, string> = { inbox: '\\Inbox', sent: '\\Sent', drafts: '\\Drafts', archive: '\\Archive', junk: '\\Junk', trash: '\\Trash' };
      const folders = Object.fromEntries(Object.entries(special).map(([folder, use]) => [folder, folder === 'inbox' ? 'INBOX' : boxes.find(box => box.specialUse === use)?.path || ''])) as Record<Folder, string>;
      return await callback(client, folders);
    } finally { if (client.usable) await client.logout().catch(() => client.close()); else client.close(); }
  }
  async profile() {
    await this.session(async () => undefined);
    await this.transport().verify();
    return { email: this.settings.email, name: this.settings.email.split('@')[0] };
  }
  private transport() { return nodemailer.createTransport({ host: this.settings.smtpHost, port: this.settings.smtpPort, secure: this.settings.smtpPort === 465, requireTLS: true, auth: { user: this.settings.email, pass: this.settings.password }, tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true }, connectionTimeout: 20000, socketTimeout: 30000, logger: false, debug: false }); }
  private mailbox(folders: Record<Folder, string>, folder: Folder) { if (!folders[folder]) throw new Error('Dieser Ordner ist auf dem IMAP-Server nicht als Standardordner eingerichtet.'); return folders[folder]; }
  async list(folder: Folder): Promise<Mail[]> {
    return this.session(async (client, folders) => {
      const lock = await client.getMailboxLock(this.mailbox(folders, folder));
      try {
        const count = client.mailbox && client.mailbox.exists;
        if (!count) return [];
        const metadata = await client.fetchAll(`${Math.max(1, count - 99)}:*`, { uid: true, flags: true, envelope: true, internalDate: true, size: true });
        const messages: Mail[] = [];
        for (const item of metadata.reverse()) {
          const base = { id: `${folder}:${client.mailbox && client.mailbox.uidValidity}:${item.uid}`, folder, date: item.internalDate instanceof Date ? item.internalDate.toISOString() : new Date().toISOString(), read: !!item.flags?.has('\\Seen'), flagged: !!item.flags?.has('\\Flagged') };
          if ((item.size || 0) > 20 * 1024 * 1024) { messages.push({ ...base, sender: item.envelope?.from?.[0]?.name || '', address: item.envelope?.from?.[0]?.address || '', to: '', subject: item.envelope?.subject || '', body: 'Diese Nachricht überschreitet das Sicherheitslimit von 20 MB und wurde nicht vollständig geladen.', attachments: [] }); continue; }
          const fetched = await client.fetchOne(String(item.uid), { source: true }, { uid: true });
          if (!fetched || !fetched.source) continue;
          const parsed = await simpleParser(fetched.source, { skipHtmlToText: false, skipTextToHtml: true, skipImageLinks: true });
          const addresses = (field: typeof parsed.to) => (Array.isArray(field) ? field : field ? [field] : []).flatMap(a => a.value.map(v => v.address).filter(Boolean)).join(', ');
          messages.push({ ...base, sender: parsed.from?.value[0]?.name || parsed.from?.value[0]?.address || 'Unbekannt', address: parsed.from?.value[0]?.address || '', to: addresses(parsed.to), cc: addresses(parsed.cc), subject: parsed.subject || '(Kein Betreff)', body: parsed.text || '(Kein Textinhalt)', attachments: parsed.attachments.map((a, index) => ({ id: String(index), name: a.filename || 'Anhang', size: a.size })) });
        }
        return messages;
      } finally { lock.release(); }
    });
  }
  async action(mail: Mail, action: MailAction) {
    await this.session(async (client, folders) => {
      const lock = await client.getMailboxLock(this.mailbox(folders, mail.folder));
      try {
        if (action.kind === 'read' || action.kind === 'flag') {
          const flag = action.kind === 'read' ? '\\Seen' : '\\Flagged';
          if (action.value) await client.messageFlagsAdd(uid(mail.id, client), [flag], { uid: true }); else await client.messageFlagsRemove(uid(mail.id, client), [flag], { uid: true });
        }
        if (action.kind === 'move') await client.messageMove(uid(mail.id, client), this.mailbox(folders, action.folder), { uid: true });
        if (action.kind === 'delete') await client.messageDelete(uid(mail.id, client), { uid: true });
      } finally { lock.release(); }
    });
  }
  async send(message: Outgoing, files: FileAttachment[]) {
    const existing = message.draftId ? await this.draftFiles(message.draftId) : [];
    await this.transport().sendMail({ from: this.settings.email, to: recipients(message.to), cc: recipients(message.cc), subject: message.subject, text: message.body, attachments: [...existing, ...files].map(a => ({ filename: a.name, content: a.content })), disableFileAccess: true, disableUrlAccess: true });
    // SMTP acceptance is success. Never turn a failed draft cleanup into a resend prompt.
    if (message.draftId) await this.action({ id: message.draftId, folder: 'drafts' } as Mail, { id: message.draftId, kind: 'delete' }).catch(() => {});
  }
  async draft(message: Outgoing, files: FileAttachment[]): Promise<string> {
    const existing = message.draftId ? await this.draftFiles(message.draftId) : [];
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const compiled = await transport.sendMail({ from: this.settings.email, to: recipients(message.to), cc: recipients(message.cc), subject: message.subject, text: message.body, attachments: [...existing, ...files].map(a => ({ filename: a.name, content: a.content })), disableFileAccess: true, disableUrlAccess: true });
    return this.session(async (client, folders) => {
      const result = await client.append(this.mailbox(folders, 'drafts'), compiled.message as Buffer, ['\\Draft']);
      if (!result || !result.uid) throw new Error('Der Server hat keine Entwurfskennung zurückgegeben.');
      if (message.draftId) {
        const lock = await client.getMailboxLock(this.mailbox(folders, 'drafts'));
        try { await client.messageDelete(uid(message.draftId, client), { uid: true }); } finally { lock.release(); }
      }
      return `drafts:${result.uidValidity}:${result.uid}`;
    });
  }
  async attachment(mail: Mail, id: string): Promise<Buffer> {
    return this.session(async (client, folders) => {
      const lock = await client.getMailboxLock(this.mailbox(folders, mail.folder));
      try {
        const meta = await client.fetchOne(uid(mail.id, client), { size: true }, { uid: true });
        if (!meta || (meta.size || 0) > 20 * 1024 * 1024) throw new Error('Der Anhang überschreitet das Größenlimit.');
        const item = await client.fetchOne(uid(mail.id, client), { source: true }, { uid: true });
        if (!item || !item.source) throw new Error('Die Nachricht wurde nicht gefunden.');
        const parsed = await simpleParser(item.source, { skipTextToHtml: true, skipImageLinks: true });
        const attachment = parsed.attachments[Number(id)];
        if (!attachment) throw new Error('Der Anhang wurde nicht gefunden.');
        return attachment.content;
      } finally { lock.release(); }
    });
  }
  private async draftFiles(id: string): Promise<FileAttachment[]> {
    return this.session(async (client, folders) => {
      const lock = await client.getMailboxLock(this.mailbox(folders, 'drafts'));
      try {
        const metadata = await client.fetchOne(uid(id, client), { size: true }, { uid: true });
        if (!metadata || (metadata.size || 0) > 20 * 1024 * 1024) throw new Error('Dieser Entwurf überschreitet das Größenlimit.');
        const item = await client.fetchOne(uid(id, client), { source: true }, { uid: true });
        if (!item || !item.source) throw new Error('Dieser Entwurf wurde nicht gefunden.');
        const parsed = await simpleParser(item.source, { skipTextToHtml: true, skipImageLinks: true });
        return parsed.attachments.map(a => ({ name: a.filename || 'Anhang', content: a.content }));
      } finally { lock.release(); }
    });
  }
}
