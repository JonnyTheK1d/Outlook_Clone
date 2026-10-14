import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import type { Attachment, CalendarEvent, Contact, Folder, Mail, MailAction, Outgoing, Task } from '../shared/types';
import type { Credentials } from './store';
import { refresh } from './oauth';
import { recipients } from './validation';

export interface FileAttachment { name: string; content: Buffer }
export interface MailFolder { id: string; name: string; parent?: string }
export interface Provider {
  profile(): Promise<{ email: string; name: string }>;
  list(folder: Folder, query?: string): Promise<Mail[]>;
  // Resolves to the message's new id after a move when the server reports it.
  action(mail: Mail, action: MailAction): Promise<string | void>;
  send(message: Outgoing, files: FileAttachment[]): Promise<void>;
  draft(message: Outgoing, files: FileAttachment[]): Promise<string>;
  attachment(mail: Mail, id: string): Promise<Buffer>;
  folders(): Promise<MailFolder[]>;
  folder(operation: 'create' | 'rename' | 'delete', name?: string, id?: string, parent?: string): Promise<void>;
}
const graphFolders: Record<string, string> = { inbox: 'inbox', sent: 'sentitems', drafts: 'drafts', archive: 'archive', junk: 'junkemail', trash: 'deleteditems' };
const segment = encodeURIComponent;
const custom = (value: string) => 'custom:' + Buffer.from(value).toString('base64url');
const decoded = (value: string) => Buffer.from(value.slice(7), 'base64url').toString('utf8');
const graphFolder = (folder: Folder) => graphFolders[folder] || decoded(folder);
const graphAddresses = (value: any[]) => (value || []).map(r => r.emailAddress.address).join(', ');
const recipientObjects = (value: string) => recipients(value).map(address => ({ emailAddress: { address } }));
function uid(id: string, client: ImapFlow) {
  const value = /^.+:(\d+):(\d+)$/.exec(id);
  if (!value || !client.mailbox || String(client.mailbox.uidValidity) !== value[1]) throw new Error('Die Nachrichtenkennung ist veraltet. Bitte synchronisiere den Ordner erneut.');
  return value[2];
}
type GraphItem = Record<string, any>;

export class MicrosoftProvider implements Provider {
  constructor(private credentials: Extract<Credentials, { type: 'microsoft' }>, private persist: (credentials: Credentials) => Promise<void>) {}
  private async request(route: string, method = 'GET', body?: unknown): Promise<any> {
    if (!route.startsWith('/') && !route.startsWith('?')) throw new Error('Ungültiger Microsoft-Endpunkt.');
    if (this.credentials.expiresAt < Date.now() + 60000) { this.credentials = await refresh(this.credentials); await this.persist(this.credentials); }
    const response = await fetch('https://graph.microsoft.com/v1.0/me' + route, {
      method, redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Authorization: 'Bearer ' + this.credentials.accessToken, 'Content-Type': 'application/json', Prefer: 'outlook.body-content-type="html", outlook.timezone="UTC"' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error('Die Microsoft-Sitzung ist abgelaufen. Bitte verbinde das Konto erneut.');
      if (response.status === 429) throw new Error('Microsoft begrenzt gerade die Anfragen. Bitte später erneut synchronisieren.');
      throw new Error('Microsoft-Anfrage fehlgeschlagen (HTTP ' + response.status + '). Prüfe Berechtigungen und Internetverbindung.');
    }
    return response.status === 204 || response.status === 202 ? undefined : response.json();
  }
  private async all(route: string): Promise<GraphItem[]> {
    const result: GraphItem[] = []; const seen = new Set<string>();
    while (route) {
      if (seen.has(route) || result.length >= 50000) throw new Error('Microsoft lieferte zu viele oder wiederholte Seiten. Der Abruf ist unvollständig.');
      seen.add(route); const page = await this.request(route); result.push(...page.value);
      if (!page['@odata.nextLink']) break;
      const url = new URL(page['@odata.nextLink']);
      if (url.origin !== 'https://graph.microsoft.com' || !url.pathname.startsWith('/v1.0/me/')) throw new Error('Ungültiger Microsoft-Seitenverweis.');
      route = url.pathname.slice('/v1.0/me'.length) + url.search;
    }
    return result;
  }
  async profile() { const result = await this.request('?$select=displayName,mail,userPrincipalName'); return { email: result.mail || result.userPrincipalName, name: result.displayName }; }
  async list(folder: Folder, query?: string): Promise<Mail[]> {
    const items = await this.all('/mailFolders/' + segment(graphFolder(folder)) + '/messages?$top=100&' + (query ? '$search=' + segment(JSON.stringify(query)) + '&' : '$orderby=receivedDateTime%20desc&') + '$select=id,subject,body,from,toRecipients,ccRecipients,bccRecipients,replyTo,internetMessageId,conversationId,categories,importance,receivedDateTime,createdDateTime,isRead,flag,hasAttachments');
    const result: Mail[] = [];
    // Bound attachment requests, rather than flooding Graph for large mailboxes.
    for (const item of items) {
      const html = item.body?.contentType?.toLowerCase() === 'html' ? item.body.content : undefined;
      const body = html ? (await simpleParser('MIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n'+html,{skipTextToHtml:true,skipImageLinks:true})).text || '' : item.body?.content || '';
      result.push({
        id: item.id, folder, sender: item.from?.emailAddress?.name || item.from?.emailAddress?.address || 'Unbekannt', address: item.from?.emailAddress?.address || '',
        to: graphAddresses(item.toRecipients), cc: graphAddresses(item.ccRecipients), bcc: graphAddresses(item.bccRecipients), replyTo: graphAddresses(item.replyTo),
        subject: item.subject || '(Kein Betreff)', body, html, date: item.receivedDateTime || item.createdDateTime || new Date().toISOString(),
        read: item.isRead, flagged: item.flag?.flagStatus === 'flagged', categories: item.categories || [], conversationId: item.conversationId, messageId: item.internetMessageId, importance: item.importance,
        attachments: item.hasAttachments ? (await this.all('/messages/' + segment(item.id) + '/attachments?$select=id,name,size,isInline')).filter((a: GraphItem) => !a.isInline && a['@odata.type'] === '#microsoft.graph.fileAttachment').map((a: GraphItem): Attachment => ({ id: a.id, name: a.name, size: a.size })) : []
      });
    }
    return result;
  }
  async folders(): Promise<MailFolder[]> {
    const known = new Map<string, string>();
    for (const [key, name] of Object.entries(graphFolders)) { const f = await this.request('/mailFolders/' + name + '?$select=id'); known.set(f.id, key); }
    const result: MailFolder[] = [];
    const visit = async (route: string, parent?: string) => {
      for (const f of await this.all(route)) {
        const id = known.get(f.id) || custom(f.id);
        if (!known.has(f.id)) result.push({ id, name: f.displayName, parent });
        if (f.childFolderCount) await visit('/mailFolders/' + segment(f.id) + '/childFolders?$top=100', id);
        if (result.length > 1000) throw new Error('Microsoft-Ordnerstruktur überschreitet das Limit von 1000 Ordnern.');
      }
    };
    await visit('/mailFolders?$top=100'); return result;
  }
  async folder(operation: 'create' | 'rename' | 'delete', name?: string, id?: string, parent?: string) {
    if (operation === 'create') await this.request(parent ? '/mailFolders/' + segment(graphFolder(parent)) + '/childFolders' : '/mailFolders', 'POST', { displayName: name });
    else await this.request('/mailFolders/' + segment(graphFolder(id!)), operation === 'delete' ? 'DELETE' : 'PATCH', operation === 'delete' ? undefined : { displayName: name });
  }
  async action(mail: Mail, action: MailAction) {
    const route = '/messages/' + segment(mail.id);
    if (action.kind === 'read') await this.request(route, 'PATCH', { isRead: action.value });
    if (action.kind === 'flag') await this.request(route, 'PATCH', { flag: { flagStatus: action.value ? 'flagged' : 'notFlagged' } });
    if (action.kind === 'move') { const moved = await this.request(route + '/move', 'POST', { destinationId: graphFolder(action.folder) }); return typeof moved?.id === 'string' ? moved.id : undefined; }
    if (action.kind === 'delete') await this.request(route, 'DELETE');
  }
  async categories(id: string, categories: string[]) { await this.request('/messages/' + segment(id), 'PATCH', { categories }); }
  private payload(message: Outgoing, files: FileAttachment[]) {
    return { subject: message.subject, body: { contentType: message.html ? 'HTML' : 'Text', content: message.html || message.body }, toRecipients: recipientObjects(message.to), ccRecipients: recipientObjects(message.cc), bccRecipients: recipientObjects(message.bcc || ''), importance: message.importance || 'normal', isReadReceiptRequested: !!message.readReceipt, isDeliveryReceiptRequested: !!message.deliveryReceipt, attachments: files.map(file => ({ '@odata.type': '#microsoft.graph.fileAttachment', name: file.name, contentBytes: file.content.toString('base64') })) };
  }
  async send(message: Outgoing, files: FileAttachment[]) {
    if (message.draftId || message.replyId || message.forwardId || Buffer.byteLength(JSON.stringify(this.payload(message,files)), 'utf8') >= 3800000) {
      const id = await this.draft(message, files);
      await this.request('/messages/' + segment(id) + '/send', 'POST');
    } else await this.request('/sendMail', 'POST', { message: this.payload(message, files), saveToSentItems: true });
  }
  async draft(message: Outgoing, files: FileAttachment[]): Promise<string> {
    let id = message.draftId;
    const { attachments: _, ...fields } = this.payload(message, []);
    if (!id && (message.replyId || message.forwardId)) {
      const action = message.forwardId ? 'createForward' : message.replyAll ? 'createReplyAll' : 'createReply';
      id = (await this.request('/messages/' + segment(message.forwardId || message.replyId!) + '/' + action, 'POST', {})).id;
    }
    if (!id) id = (await this.request('/messages', 'POST', fields)).id;
    else await this.request('/messages/' + segment(id), 'PATCH', fields);
    if (message.retainedAttachments) for (const a of await this.all('/messages/' + segment(id!) + '/attachments')) if (!message.retainedAttachments.includes(a.id)) await this.request('/messages/' + segment(id!) + '/attachments/' + segment(a.id), 'DELETE');
    for (const file of files) {
      if (file.content.length < 3000000) await this.request('/messages/' + segment(id!) + '/attachments', 'POST', this.payload(message, [file]).attachments[0]);
      else {
        const upload = await this.request('/messages/' + segment(id!) + '/attachments/createUploadSession', 'POST', { AttachmentItem: { attachmentType: 'file', name: file.name, size: file.content.length } });
        const url = new URL(upload.uploadUrl);
        if (url.protocol !== 'https:' || !(url.hostname.endsWith('.outlook.com') || ['outlook.office.com','outlook.office365.com','outlook.live.com'].includes(url.hostname)) || url.port || url.username || url.password) throw new Error('Ungültige Microsoft-Uploadadresse.');
        for (let offset = 0; offset < file.content.length; offset += 10 * 320 * 1024) {
          const chunk = file.content.subarray(offset, Math.min(offset + 10 * 320 * 1024, file.content.length));
          const response = await fetch(url, { method: 'PUT', redirect: 'error', signal: AbortSignal.timeout(60000), headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(chunk.length), 'Content-Range': 'bytes ' + offset + '-' + (offset + chunk.length - 1) + '/' + file.content.length }, body: new Uint8Array(chunk) });
          if (!response.ok) throw new Error('Microsoft-Anhang konnte nicht hochgeladen werden.');
        }
      }
    }
    return id!;
  }
  async attachment(mail: Mail, id: string) { const result = await this.request('/messages/' + segment(mail.id) + '/attachments/' + segment(id)); if (typeof result.contentBytes !== 'string') throw new Error('Dieser Anhangstyp wird noch nicht unterstützt.'); return Buffer.from(result.contentBytes, 'base64'); }
  async calendars() { return (await this.all('/calendars?$top=100')).map(c=>({id:c.id,name:c.name,visible:true,isDefault:!!c.isDefaultCalendar,canEdit:!!c.canEdit})); }
  async calendar(operation:'create'|'rename'|'delete',id?:string,name?:string) { await this.request(id?'/calendars/'+segment(id):'/calendars',operation==='delete'?'DELETE':operation==='rename'?'PATCH':'POST',operation==='delete'?undefined:{name}); }
  async events(): Promise<CalendarEvent[]> {
    const begin = new Date(Date.now() - 366 * 86400000).toISOString(), end = new Date(Date.now() + 730 * 86400000).toISOString();
    const result: CalendarEvent[] = [];
    for (const calendar of await this.calendars()) {
      const data = await this.all('/calendars/' + segment(calendar.id) + '/calendarView?startDateTime=' + segment(begin) + '&endDateTime=' + segment(end) + '&$top=100');
      result.push(...data.map(e => ({ id: e.id, calendarId:calendar.id,title: e.subject, start: utcToLocal(e.start.dateTime), end: utcToLocal(e.end.dateTime), location: e.location?.displayName || '', notes: e.bodyPreview || '', allDay: e.isAllDay, attendees: graphAddresses(e.attendees), reminder: e.isReminderOn ? e.reminderMinutesBeforeStart : 0, joinUrl: e.onlineMeeting?.joinUrl })));
    }
    return result;
  }
  async saveEvent(event: Omit<CalendarEvent, 'id'> & { id?: string }) {
    const start = new Date(event.start);
    const fields: GraphItem = { subject: event.title, start: { dateTime: event.start, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }, end: { dateTime: event.end, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }, location: { displayName: event.location }, body: { contentType: 'Text', content: event.notes }, isAllDay: !!event.allDay, isReminderOn: !!event.reminder, reminderMinutesBeforeStart: event.reminder || 0, attendees: recipientObjects(event.attendees || '').map(a => ({ ...a, type: 'required' })) };
    if (event.online) { fields.isOnlineMeeting = true; fields.onlineMeetingProvider = 'teamsForBusiness'; }
    if (event.recurrence && event.recurrence !== 'none') {
      const pattern: GraphItem = { type: event.recurrence === 'monthly' ? 'absoluteMonthly' : event.recurrence, interval: 1 };
      if (event.recurrence === 'weekly') { pattern.daysOfWeek = [['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][start.getDay()]]; pattern.firstDayOfWeek = 'monday'; }
      if (event.recurrence === 'monthly') pattern.dayOfMonth = start.getDate();
      fields.recurrence = { pattern, range: { type: event.until ? 'endDate' : 'noEnd', startDate: event.start.slice(0,10), ...(event.until ? { endDate: event.until } : {}), recurrenceTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } };
    } else if(event.recurrence !== undefined)fields.recurrence = null;
    const route = event.id ? '/events/' + segment(event.id) : event.calendarId ? '/calendars/' + segment(event.calendarId) + '/events' : '/events';
    const result = await this.request(route, event.id ? 'PATCH' : 'POST', fields); return result.id as string;
  }
  async deleteEvent(id: string) { await this.request('/events/' + segment(id), 'DELETE'); }
  async meeting(id: string, response: string) { await this.request('/events/' + segment(id) + '/' + response, 'POST', { sendResponse: true }); }
  async autoReply(text: string, enabled: boolean) { await this.request('/mailboxSettings', 'PATCH', { automaticRepliesSetting: { status: enabled ? 'alwaysEnabled' : 'disabled', externalAudience: 'all', internalReplyMessage: text, externalReplyMessage: text } }); }
  async contacts(): Promise<Contact[]> {
    return (await this.all('/contacts?$top=100')).map(c => ({ id: c.id, name: c.displayName || '', email: c.emailAddresses?.[0]?.address || '', emails: (c.emailAddresses || []).map((a: any) => a.address).join(', '), phone: c.mobilePhone || c.businessPhones?.[0] || '', phones: (c.businessPhones || []).join(', '), company: c.companyName || '', group: (c.categories || []).join(', ') }));
  }
  async saveContact(contact: Omit<Contact, 'id'> & { id?: string }) { const result = await this.request(contact.id ? '/contacts/' + segment(contact.id) : '/contacts', contact.id ? 'PATCH' : 'POST', { displayName: contact.name, givenName: contact.name, emailAddresses: recipientObjects(contact.emails || contact.email).map(a => ({ address: a.emailAddress.address, name: contact.name })), mobilePhone: contact.phone, businessPhones: (contact.phones || '').split(',').map(v => v.trim()).filter(Boolean), companyName: contact.company, categories: contact.group ? [contact.group] : [] }); return result.id as string; }
  async deleteContact(id: string) { await this.request('/contacts/' + segment(id), 'DELETE'); }
  async tasks(): Promise<Task[]> {
    const result: Task[] = [];
    for (const list of await this.all('/todo/lists?$top=100')) for (const task of await this.all('/todo/lists/' + segment(list.id) + '/tasks?$top=100')) result.push({ id: Buffer.from(list.id).toString('base64url') + ':' + Buffer.from(task.id).toString('base64url'), title: task.title, recurrence:task.recurrence?.pattern?.type==='absoluteMonthly'?'monthly':task.recurrence?.pattern?.type || 'none', due: task.dueDateTime?.dateTime?.slice(0,10) || '', done: task.status === 'completed', list: list.displayName, notes: task.body?.content || '', reminder: task.reminderDateTime ? utcToLocal(task.reminderDateTime.dateTime) : undefined, steps: (await this.all('/todo/lists/' + segment(list.id) + '/tasks/' + segment(task.id) + '/checklistItems')).map(s => ({ title: s.displayName, done: s.isChecked })) });
    return result;
  }
  async saveTask(task: Omit<Task, 'id'> & { id?: string }): Promise<string> {
    const lists = await this.all('/todo/lists'); let list = lists.find(l => l.displayName === (task.list || 'Postblick'));
    if (!list) list = await this.request('/todo/lists', 'POST', { displayName: task.list || 'Postblick' });
    let taskId: string | undefined;
    if (task.id?.includes(':')) { const [l, t] = task.id.split(':'); list = { id: Buffer.from(l, 'base64url').toString() }; taskId = Buffer.from(t, 'base64url').toString(); }
    const route = '/todo/lists/' + segment(list!.id) + '/tasks';
    const recurrence: GraphItem | null = task.recurrence && task.recurrence!=='none' && task.due ? {pattern:{type:task.recurrence==='monthly'?'absoluteMonthly':task.recurrence,interval:1,...(task.recurrence==='weekly'?{daysOfWeek:[['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date(task.due+'T12:00:00').getDay()]],firstDayOfWeek:'monday'}:{}),...(task.recurrence==='monthly'?{dayOfMonth:Number(task.due.slice(-2))}:{})},range:{type:'noEnd',startDate:task.due}}:null;
    const data = await this.request(route + (taskId ? '/' + segment(taskId) : ''), taskId ? 'PATCH' : 'POST', { recurrence,title: task.title, status: task.done ? 'completed' : 'notStarted', body: { contentType: 'text', content: task.notes || '' }, dueDateTime: task.due ? { dateTime: task.due + 'T12:00:00', timeZone: 'UTC' } : null, isReminderOn: !!task.reminder, reminderDateTime: task.reminder ? { dateTime: new Date(task.reminder).toISOString(), timeZone: 'UTC' } : null });
    taskId = data.id;
    if (task.steps) {
      for (const step of await this.all(route + '/' + segment(taskId!) + '/checklistItems')) await this.request(route + '/' + segment(taskId!) + '/checklistItems/' + segment(step.id), 'DELETE');
      for (const step of task.steps) await this.request(route + '/' + segment(taskId!) + '/checklistItems', 'POST', { displayName: step.title, isChecked: step.done });
    }
    return Buffer.from(list!.id).toString('base64url') + ':' + Buffer.from(taskId!).toString('base64url');
  }
  async deleteTask(id: string) { const [l,t] = id.split(':'); await this.request('/todo/lists/' + segment(Buffer.from(l,'base64url').toString()) + '/tasks/' + segment(Buffer.from(t,'base64url').toString()), 'DELETE'); }
}
function utcToLocal(value: string) { const date = new Date(value.endsWith('Z') ? value : value + 'Z'); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19); }

export class ImapProvider implements Provider {
  constructor(private settings: Extract<Credentials, { type: 'imap' }>) {}
  private async session<T>(callback: (client: ImapFlow, folders: Record<Folder, string>) => Promise<T>): Promise<T> {
    const client = new ImapFlow({ host: this.settings.imapHost, port: this.settings.imapPort, secure: true, auth: { user: this.settings.email, pass: this.settings.password }, tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true }, logger: false, connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 30000 });
    try {
      await client.connect(); const boxes = await client.list();
      const special: Record<Folder, string> = { inbox: '\\Inbox', sent: '\\Sent', drafts: '\\Drafts', archive: '\\Archive', junk: '\\Junk', trash: '\\Trash' };
      const folders = Object.fromEntries(Object.entries(special).map(([folder, use]) => [folder, folder === 'inbox' ? 'INBOX' : boxes.find(box => box.specialUse === use)?.path || ''])) as Record<Folder, string>;
      for (const box of boxes) if (!Object.values(folders).includes(box.path) && !box.flags?.has('\\Noselect')) folders[custom(box.path)] = box.path;
      return await callback(client, folders);
    } finally { if (client.usable) await client.logout().catch(() => client.close()); else client.close(); }
  }
  async profile() { await this.session(async () => undefined); await this.transport().verify(); return { email: this.settings.email, name: this.settings.email.split('@')[0] }; }
  private transport() { return nodemailer.createTransport({ host: this.settings.smtpHost, port: this.settings.smtpPort, secure: this.settings.smtpPort === 465, requireTLS: true, auth: { user: this.settings.email, pass: this.settings.password }, tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true }, connectionTimeout: 20000, socketTimeout: 30000, logger: false, debug: false }); }
  private mailbox(folders: Record<Folder, string>, folder: Folder) { if (!folders[folder]) throw new Error('Dieser Ordner ist auf dem IMAP-Server nicht als Standardordner eingerichtet.'); return folders[folder]; }
  async folders(): Promise<MailFolder[]> { return this.session(async (_client, folders) => Object.entries(folders).filter(([id]) => id.startsWith('custom:')).map(([id, name]) => ({ id, name }))); }
  async folder(operation: 'create' | 'rename' | 'delete', name?: string, id?: string, parent?: string) {
    await this.session(async (client, folders) => {
      const boxes = await client.list(); const delimiter = boxes.find(b => b.path === (parent ? folders[parent] : 'INBOX'))?.delimiter || '/';
      if (operation === 'create') await client.mailboxCreate((parent ? this.mailbox(folders, parent) + delimiter : '') + name);
      if (operation === 'rename') { const original = this.mailbox(folders, id!); const prefix = original.includes(delimiter) ? original.slice(0, original.lastIndexOf(delimiter) + 1) : ''; await client.mailboxRename(original, prefix + name); }
      if (operation === 'delete') await client.mailboxDelete(this.mailbox(folders, id!));
    });
  }
  async list(folder: Folder, query?: string): Promise<Mail[]> {
    return this.session(async (client, folders) => {
      const lock = await client.getMailboxLock(this.mailbox(folders, folder));
      try {
        const count = client.mailbox && client.mailbox.exists; if (!count) return [];
        if (!query && count > 50000) throw new Error('Dieses Postfach überschreitet derzeit das Limit von 50000 Nachrichten pro Ordner.');
        const messages: Mail[] = [];
        const found = query ? await client.search({ or: [{ subject: query }, { from: query }, { body: query }] }, { uid: true }) : null;
        const searchIds = found || [];
        if (query && !searchIds.length) return [];
        for (let offset = query ? searchIds.length : count; offset > 0; offset -= 200) {
          const metadata = await client.fetchAll(query ? searchIds.slice(Math.max(0,offset-200),offset).join(',') : String(Math.max(1, offset - 199)) + ':' + offset, { uid: true, flags: true, envelope: true, internalDate: true, size: true }, { uid: !!query });
          for (const item of metadata.reverse()) {
            const base = { id: folder + ':' + (client.mailbox && client.mailbox.uidValidity) + ':' + item.uid, folder, date: item.internalDate instanceof Date ? item.internalDate.toISOString() : new Date().toISOString(), read: !!item.flags?.has('\\Seen'), flagged: !!item.flags?.has('\\Flagged') };
            if ((item.size || 0) > 50 * 1024 * 1024) { messages.push({ ...base, sender: item.envelope?.from?.[0]?.name || '', address: item.envelope?.from?.[0]?.address || '', to: '', subject: item.envelope?.subject || '', body: 'Diese Nachricht überschreitet das Limit von 50 MB und wurde nicht vollständig geladen.', attachments: [] }); continue; }
            const fetched = await client.fetchOne(String(item.uid), { source: true }, { uid: true }); if (!fetched || !fetched.source) continue;
            const parsed = await simpleParser(fetched.source, { skipHtmlToText: false, skipTextToHtml: true, skipImageLinks: true });
            const addresses = (field: typeof parsed.to) => (Array.isArray(field) ? field : field ? [field] : []).flatMap(a => a.value.map(v => v.address).filter(Boolean)).join(', ');
            messages.push({ ...base, sender: parsed.from?.value[0]?.name || parsed.from?.value[0]?.address || 'Unbekannt', address: parsed.from?.value[0]?.address || '', to: addresses(parsed.to), cc: addresses(parsed.cc), bcc: addresses(parsed.bcc), replyTo: addresses(parsed.replyTo), messageId: parsed.messageId, references: Array.isArray(parsed.references) ? parsed.references.join(' ') : parsed.references, subject: parsed.subject || '(Kein Betreff)', body: parsed.text || '(Kein Textinhalt)', html: parsed.html || undefined, attachments: parsed.attachments.map((a, index) => ({ id: String(index), name: a.filename || 'Anhang', size: a.size })) });
          }
        }
        return messages;
      } finally { lock.release(); }
    });
  }
  async action(mail: Mail, action: MailAction): Promise<string | void> {
    return this.session(async (client, folders) => {
      const lock = await client.getMailboxLock(this.mailbox(folders, mail.folder));
      try {
        if (action.kind === 'read' || action.kind === 'flag') { const flag = action.kind === 'read' ? '\\Seen' : '\\Flagged'; if (action.value) await client.messageFlagsAdd(uid(mail.id, client), [flag], { uid: true }); else await client.messageFlagsRemove(uid(mail.id, client), [flag], { uid: true }); }
        if (action.kind === 'move') {
          const source = uid(mail.id, client);
          const moved = await client.messageMove(source, this.mailbox(folders, action.folder), { uid: true });
          // Without UIDPLUS the server does not tell us the new UID; the move then cannot be undone.
          const target = moved ? moved.uidMap?.get(Number(source)) : undefined;
          return moved && moved.uidValidity !== undefined && target ? action.folder + ':' + moved.uidValidity + ':' + target : undefined;
        }
        if (action.kind === 'delete') await client.messageDelete(uid(mail.id, client), { uid: true });
      } finally { lock.release(); }
    });
  }
  private options(message: Outgoing, files: FileAttachment[]) {
    return { from: this.settings.email, to: recipients(message.to), cc: recipients(message.cc), bcc: recipients(message.bcc || ''), subject: message.subject, text: message.body, html: message.html, inReplyTo: message.inReplyTo, references: message.references, priority: message.importance || 'normal' as 'normal', headers: { ...(message.readReceipt ? { 'Disposition-Notification-To': this.settings.email } : {}) }, attachments: files.map(a => ({ filename: a.name, content: a.content })), disableFileAccess: true, disableUrlAccess: true };
  }
  async send(message: Outgoing, files: FileAttachment[]) {
    const existing = message.draftId ? await this.draftFiles(message.draftId) : [];
    const kept = message.retainedAttachments ? existing.filter((_a, i) => message.retainedAttachments!.includes(String(i))) : existing;
    const options = this.options(message, [...kept, ...files]);
    const compiled = await nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail(options);
    await this.transport().sendMail({ ...options, raw: compiled.message as Buffer });
    // Acceptance is irreversible; failure to append or clean up must never trigger resend.
    try { await this.session(async (client, folders) => { if (folders.sent) await client.append(folders.sent, compiled.message as Buffer, ['\\Seen']); }); } catch { /* main process reports provider-dependent copy */ }
    if (message.draftId) await this.action({ id: message.draftId, folder: 'drafts' } as Mail, { id: message.draftId, kind: 'delete' }).catch(() => {});
  }
  async draft(message: Outgoing, files: FileAttachment[]): Promise<string> {
    const existing = message.draftId ? await this.draftFiles(message.draftId) : [];
    const kept = message.retainedAttachments ? existing.filter((_a, i) => message.retainedAttachments!.includes(String(i))) : existing;
    const compiled = await nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail({ ...this.options(message, [...kept, ...files]), keepBcc: true } as any);
    return this.session(async (client, folders) => {
      const result = await client.append(this.mailbox(folders, 'drafts'), compiled.message as Buffer, ['\\Draft']);
      if (!result || !result.uid) throw new Error('Der Server hat keine Entwurfskennung zurückgegeben.');
      if (message.draftId) { const lock = await client.getMailboxLock(this.mailbox(folders, 'drafts')); try { await client.messageDelete(uid(message.draftId, client), { uid: true }); } finally { lock.release(); } }
      return 'drafts:' + result.uidValidity + ':' + result.uid;
    });
  }
  async attachment(mail: Mail, id: string): Promise<Buffer> {
    return this.session(async (client, folders) => {
      const lock = await client.getMailboxLock(this.mailbox(folders, mail.folder));
      try {
        const meta = await client.fetchOne(uid(mail.id, client), { size: true }, { uid: true });
        if (!meta || (meta.size || 0) > 50 * 1024 * 1024) throw new Error('Der Anhang überschreitet das Größenlimit.');
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
        if (!metadata || (metadata.size || 0) > 50 * 1024 * 1024) throw new Error('Dieser Entwurf überschreitet das Größenlimit.');
        const item = await client.fetchOne(uid(id, client), { source: true }, { uid: true });
        if (!item || !item.source) throw new Error('Dieser Entwurf wurde nicht gefunden.');
        const parsed = await simpleParser(item.source, { skipTextToHtml: true, skipImageLinks: true });
        return parsed.attachments.map(a => ({ name: a.filename || 'Anhang', content: a.content }));
      } finally { lock.release(); }
    });
  }
}
