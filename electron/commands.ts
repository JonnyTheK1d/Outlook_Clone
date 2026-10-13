import { app, BrowserWindow, dialog, shell } from 'electron';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import ICAL from 'ical.js';
import type { State, Outgoing, Command, Mail, CalendarEvent } from '../shared/types';
import { normalize, localCommand } from '../shared/features';
import { commandSchema, contactSchema, eventSchema, recipients } from './validation';
import { Store } from './store';
import { MicrosoftProvider, type Provider, type FileAttachment } from './providers';
import { applyLocalAction } from './local';

export interface Context {
  store: Store; window: BrowserWindow; provider: () => Provider | null; setProvider: () => void;
  sync: (folder: string) => Promise<State>; save: () => Promise<State>;
  files: (message: Outgoing) => Promise<FileAttachment[]>; validate: (value: unknown, draft?: boolean) => Outgoing;
}
const standard = ['inbox','sent','drafts','archive','junk','trash'];
const releases = 'https://github.com/JonnyTheK1d/Outlook_Clone/releases';
const ensureFolder = (state: State, id: string) => { if (!standard.includes(id) && !state.folders?.some(f => f.id === id)) throw new Error('Dieser Ordner ist nicht vorhanden.'); };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]!);
export async function flushOutbox(ctx: Context, only?: string) {
  for (const item of ctx.store.state.outbox || []) {
    if (only ? item.id !== only : item.status !== 'pending' || (item.message.scheduledAt && Date.parse(item.message.scheduledAt) > Date.now())) continue;
    if (item.status === 'uncertain') throw new Error('Diese Nachricht hat einen unklaren Versandstatus. Prüfe zuerst Gesendet und den Empfänger; ein erneuter Versand muss als neue Nachricht erfolgen.');
    const activeProvider = ctx.provider();
    try { if (activeProvider && typeof activeProvider.profile === 'function') await activeProvider.profile(); }
    catch { item.error='Keine Verbindung. Die Nachricht bleibt im Postausgang und wird beim nächsten Abruf erneut geprüft.';await ctx.store.save();if(only)throw new Error('Die Verbindung ist nicht verfügbar. Die Nachricht wartet weiterhin im Postausgang.');continue; }
    delete item.error;
    // Commit uncertain BEFORE crossing the irreversible SMTP/Graph send boundary.
    item.status = 'uncertain'; try { await ctx.store.save(); } catch(error) { item.status='pending';throw error; }
    try {
      const p = ctx.provider();
      if (!p) {
        const { localOutgoing } = await import('./local'); localOutgoing(ctx.store.state, item.message, false);
      } else {
        const files = (ctx.store.queuedFiles[item.id] || []).map(f => ({ name: f.name, content: Buffer.from(f.content, 'base64') }));
        await p.send(item.message, files);
      }
      ctx.store.state.outbox = ctx.store.state.outbox!.filter(m => m.id !== item.id);
      delete ctx.store.queuedFiles[item.id];
      ctx.store.state.notice = 'Die Nachricht wurde zum Versand angenommen.';
    } catch {
      item.error = 'Versandstatus unklar. Prüfe Gesendet und die Zustellung. Kein automatischer Wiederholungsversand.';
      await ctx.store.save(); if (only) throw new Error('Der Versandstatus ist unklar. Bitte zuerst Gesendet und die Zustellung prüfen.'); continue;
    }
    await ctx.store.save();
  }
}
export async function applyRules(ctx: Context) {
  for (const mail of [...ctx.store.state.mails.filter(m => m.folder === 'inbox')]) {
    const rule = ctx.store.state.rules?.find(r => r.enabled && (!r.from || mail.address.toLowerCase().includes(r.from.toLowerCase())) && (!r.subject || mail.subject.toLowerCase().includes(r.subject.toLowerCase())));
    if (!rule) continue;
    ensureFolder(ctx.store.state, rule.target); const p = ctx.provider();
    if (rule.markRead) { if (p) await p.action(mail, { id: mail.id, kind: 'read', value: true }); mail.read = true; }
    if (rule.target !== 'inbox') {
      if (p) { await p.action(mail, { id: mail.id, kind: 'move', folder: rule.target }); ctx.store.state.mails = ctx.store.state.mails.filter(m => m.id !== mail.id); }
      else mail.folder = rule.target;
    }
  }
}
export async function handleCommand(ctx: Context, value: unknown): Promise<State> {
  const command = commandSchema.parse(value) as Command;
  const { store } = ctx; normalize(store.state); delete store.state.notice;
  let provider = ctx.provider();
  if (command.kind === 'account') {
    const before = { state: store.state, credentials: store.credentials, accounts: { ...store.accounts } };
    store.activate(command.id);
    try { await store.save(); } catch (error) { Object.assign(store, before); throw error; }
    ctx.setProvider(); return store.view();
  }
  if (command.kind === 'calendar') {
    if ((command.operation === 'create' || command.operation === 'rename') && !command.name) throw new Error('Bitte einen Kalendernamen eingeben.');
    if (command.operation !== 'create' && !store.state.calendars?.some(c=>c.id===command.id)) throw new Error('Dieser Kalender ist nicht vorhanden.');
    if (command.operation === 'visibility') {
      if (command.visible === undefined) throw new Error('Bitte die Kalendersichtbarkeit angeben.');
      localCommand(store.state,command,randomUUID);
    } else if (provider instanceof MicrosoftProvider) {
      if (command.operation === 'delete' && (store.state.calendars!.find(c=>c.id===command.id)?.isDefault || (await provider.events()).some(e=>e.calendarId===command.id))) throw new Error('Bitte verwende einen leeren zusätzlichen Kalender.');
      await provider.calendar(command.operation,command.id,command.name);
      const previous=store.state.calendars!;store.state.calendars=(await provider.calendars()).map(c=>({...c,visible:previous.find(p=>p.id===c.id)?.visible ?? true}));
    } else localCommand(store.state,command,randomUUID);
  } else if (command.kind === 'folder') {
    if (command.operation !== 'delete' && !command.name) throw new Error('Bitte einen Ordnernamen eingeben.');
    if (command.parent) ensureFolder(store.state, command.parent);
    if (command.operation !== 'create' && (!command.id?.startsWith('custom:') || command.id === 'custom:local-import')) throw new Error('Dieser Ordner kann nicht verändert werden.');
    if (command.id) ensureFolder(store.state, command.id);
    if (provider) {
      if (command.operation === 'delete' && ((await provider.list(command.id!)).length || store.state.folders!.some(f => f.parent === command.id))) throw new Error('Bitte leere zuerst den Ordner und entferne Unterordner.');
      await provider.folder(command.operation, command.name, command.id, command.parent);
      const old = store.state.folders!; store.state.folders = [...await provider.folders(), ...old.filter(f => f.id === 'custom:local-import')];
      // Rename can change IMAP identifiers. Drop stale cached identities, never reuse them.
      if (command.id && !store.state.folders.some(f => f.id === command.id)) store.state.mails = store.state.mails.filter(m => m.folder !== command.id);
    } else localCommand(store.state, command, randomUUID);
  } else if (command.kind === 'preferences' || command.kind === 'rules' || command.kind === 'metadata') {
    if (command.kind === 'rules') for (const rule of command.value) ensureFolder(store.state, rule.target);
    if (command.kind === 'metadata' && provider instanceof MicrosoftProvider && command.category !== undefined) for (const id of command.ids) {
      if (!store.state.mails.some(m => m.id === id)) throw new Error('Diese Nachricht ist nicht mehr vorhanden.');
      if (!id.startsWith('local:')) await provider.categories(id, command.category ? [command.category] : []);
    }
    localCommand(store.state, command, randomUUID);
  } else if (command.kind === 'batch') {
    if (command.action === 'move') { if (!command.folder) throw new Error('Bitte einen Zielordner wählen.'); ensureFolder(store.state, command.folder); }
    for (const id of command.ids) {
      const mail = store.state.mails.find(m => m.id === id); if (!mail) throw new Error('Diese Nachricht ist nicht mehr vorhanden.');
      const action = command.action === 'move' || command.action === 'delete' ? { id, kind: 'move' as const, folder: command.action === 'delete' ? 'trash' : command.folder! } : { id, kind: (command.action === 'flag' || command.action === 'unflag' ? 'flag' : 'read') as 'flag' | 'read', value: command.action === 'read' || command.action === 'flag' };
      if (provider && !id.startsWith('local:')) { await provider.action(mail, action); if (action.kind === 'move') store.state.mails = store.state.mails.filter(m => m.id !== id); else applyLocalAction(store.state, action); }
      else applyLocalAction(store.state, action);
      await store.save(); // Preserve successful work if a later batch element fails.
    }
  } else if (command.kind === 'search') {
    if (!provider) throw new Error('Diese Suche benötigt ein verbundenes Konto.');
    const folders = command.all ? [...standard,...store.state.folders!.map(f=>f.id)] : [command.folder];
    const results: Mail[] = [];
    for (const folder of folders) { ensureFolder(store.state,folder); if(folder==='custom:local-import')continue; try { results.push(...await provider.list(folder,command.query)); } catch(error) { if (!(error instanceof Error) || !error.message.includes('Standardordner')) throw error; } }
    for (const mail of results) { const previous=store.state.mails.find(m=>m.id===mail.id); mail.pinned=previous?.pinned; if(store.state.mode==='imap')mail.categories=previous?.categories; }
    const ids=new Set(results.map(m=>m.id));store.state.mails=[...store.state.mails.filter(m=>!ids.has(m.id)),...results];
    store.state.notice = 'Server-Suche abgeschlossen. Microsoft begrenzt Suchtreffer auf 1000 je Ordner; dies ist kein vollständiger Postfachabruf.';
  } else if (command.kind === 'sync-all') {
    if (provider) {
      store.state.folders = [...await provider.folders(), ...store.state.folders!.filter(f => f.id === 'custom:local-import')];
      for (const folder of [...standard, ...store.state.folders!.map(f => f.id)]) {
        // Unconfigured optional IMAP standard folders are explicitly incomplete.
        try { await ctx.sync(folder); } catch (error) { if (folder === 'inbox' || !(error instanceof Error) || !error.message.includes('Standardordner')) throw error; }
      }
      if (provider instanceof MicrosoftProvider) store.state.tasks = await provider.tasks();
    }
    await applyRules(ctx); store.state.notice = 'Postfachabruf abgeschlossen. Die Suche umfasst alle erfolgreich geladenen Ordner.';
  } else if (command.kind === 'autosave') {
    const key='recovery:' + store.state.accountId;
    if (command.message) { ctx.validate(command.message, true); const files=await ctx.files({...command.message,forwardId:undefined}); store.state.workingDraft=command.message; store.queuedFiles[key]=files.map((f,i)=>({...f,content:f.content.toString('base64'),id:command.message!.attachments[i].id})); }
    else { delete store.state.workingDraft; delete store.queuedFiles[key]; }
  } else if (command.kind === 'queue') {
    if (store.state.outbox!.length >= 100) throw new Error('Die Versandwarteschlange enthält bereits 100 Nachrichten.');
    const message = ctx.validate(command.message); const files = await ctx.files(message);
    const id = randomUUID(); const previous = [...store.state.outbox!];
    // Snapshot attachment bytes now, so restart or file changes cannot change queued mail.
    store.queuedFiles[id] = files.map(f => ({ name: f.name, content: f.content.toString('base64') }));
    store.state.outbox!.push({ id, message, createdAt: new Date().toISOString(), status: 'pending' });
    try { await store.save(); } catch (error) { store.state.outbox = previous; delete store.queuedFiles[id]; throw error; }
    store.state.notice = 'In der Versandwarteschlange gespeichert. Automatischer Versand erfolgt nur, während Postblick läuft.';
  } else if (command.kind === 'outbox') {
    if (!store.state.outbox!.some(m => m.id === command.id)) throw new Error('Diese Nachricht ist nicht vorhanden.');
    if (command.operation === 'send') await flushOutbox(ctx, command.id);
    else { localCommand(store.state, command, randomUUID); delete store.queuedFiles[command.id]; }
  } else if (command.kind === 'meeting') {
    if (!(provider instanceof MicrosoftProvider)) throw new Error('Diese Besprechungsfunktion benötigt ein Microsoft-Konto.');
    if (!store.state.events.some(e => e.id === command.id)) throw new Error('Dieser Termin ist nicht vorhanden.');
    await provider.meeting(command.id, command.response); store.state.notice = 'Besprechungsantwort gesendet.';
  } else if (command.kind === 'auto-reply') {
    if (!(provider instanceof MicrosoftProvider)) throw new Error('Diese Abwesenheitsfunktion benötigt ein Microsoft-Konto.');
    await provider.autoReply(command.text, command.enabled); store.state.notice = 'Abwesenheitsantwort beim Anbieter gespeichert.';
  } else if (command.kind === 'export') await exportData(ctx, command.format, command.id);
  else if (command.kind === 'import') await importData(ctx, command.format);
  else if (command.kind === 'print') {
    const mail = store.state.mails.find(m => m.id === command.id); if (!mail) throw new Error('Diese Nachricht ist nicht vorhanden.');
    const print = new BrowserWindow({ show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
    try {
      print.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      print.webContents.on('will-navigate', event => event.preventDefault());
      await print.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><style>body{font-family:Arial;margin:24px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>' + escapeHtml(mail.subject) + '</h1><p>' + escapeHtml(mail.address + ' → ' + mail.to + ' · ' + mail.date) + '</p><pre>' + escapeHtml(mail.body) + '</pre>'));
      await new Promise<void>((resolve,reject) => print.webContents.print({ silent: false, printBackground: false }, success => success ? resolve() : reject(new Error('Der Druck wurde abgebrochen oder ist fehlgeschlagen.'))));
    } finally { print.destroy(); }
  } else if (command.kind === 'open-link') {
    const choice = await dialog.showMessageBox(ctx.window, { type:'question',buttons:['Abbrechen','Im Browser öffnen'],defaultId:0,cancelId:0,title:'Link aus einer E-Mail öffnen',message:'Zieladresse prüfen',detail:command.url });
    if (choice.response === 1) await shell.openExternal(command.url);
  } else if (command.kind === 'default-mail') {
    const success = app.isPackaged ? app.setAsDefaultProtocolClient('mailto') : false;
    store.state.notice = success ? 'Mailto registriert. Wähle Postblick zusätzlich in den Windows-Standard-Apps.' : 'Die Mailto-Registrierung benötigt die installierte App.';
  } else if (command.kind === 'open-release') await shell.openExternal(releases);
  else if (command.kind === 'check-updates') {
    const response = await fetch('https://api.github.com/repos/JonnyTheK1d/Outlook_Clone/releases', { redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) throw new Error('Die Updateprüfung ist momentan nicht erreichbar.');
    const data = await response.json() as { tag_name: string };
    const version = data.tag_name.replace(/^v/, ''); const current = app.getVersion();
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Ungültige Release-Version.');
    const numbers = (v: string) => v.split('.').map(Number);
    const newer = numbers(version).some((n,i) => n > numbers(current)[i] && numbers(version).slice(0,i).every((x,j) => x === numbers(current)[j]));
    store.state.notice = newer ? 'Version ' + version + ' ist verfügbar. Öffne die Releases zum Download.' : 'Postblick ist auf dem aktuellen veröffentlichten Stand.';
  }
  return ctx.save();
}
export function csvRows(content: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === '"') { if (quoted && content[i+1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (c === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (quoted) throw new Error('Die CSV-Datei enthält ein unvollständiges Feld.');
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); } return rows;
}
const csvCell = (value: string) => '"' + (/^[=+\-@]/.test(value) ? "'" + value : value).replaceAll('"','""') + '"';
export function calendarText(events: CalendarEvent[]): string {
  const root = new ICAL.Component(['vcalendar',[],[]]); root.updatePropertyWithValue('version','2.0'); root.updatePropertyWithValue('prodid','-//Postblick//Calendar//DE');
  for (const value of events) {
    const component = new ICAL.Component('vevent'); const event = new ICAL.Event(component);
    event.uid = value.id; event.summary = value.title; event.description = value.notes; event.location = value.location;
    const stamp = (v: string) => ICAL.Time.fromJSDate(new Date(v),true);
    event.startDate = stamp(value.start); event.endDate = stamp(value.end);
    if (value.allDay) { const t = ICAL.Time.fromDateString(value.start.slice(0,10)); const end = ICAL.Time.fromDateString(value.end.slice(0,10)); event.startDate = t; event.endDate = end; }
    if (value.recurrence && value.recurrence !== 'none') component.updatePropertyWithValue('rrule', ICAL.Recur.fromString('FREQ=' + value.recurrence.toUpperCase() + (value.until ? ';UNTIL=' + value.until.replaceAll('-','') + 'T235959Z' : '')));
    root.addSubcomponent(component);
  }
  return root.toString();
}
async function exportData(ctx: Context, format: string, id?: string) {
  let content: string | Buffer; let extension: string;
  if (format === 'contacts') { extension = 'csv'; content = ['name,email,phone,company,emails,phones,group', ...ctx.store.state.contacts.map(c => [c.name,c.email,c.phone,c.company,c.emails || '',c.phones || '',c.group || ''].map(csvCell).join(','))].join('\r\n'); }
  else if (format === 'calendar') { extension = 'ics'; content = calendarText(ctx.store.state.events); }
  else {
    extension = 'eml'; const mail = ctx.store.state.mails.find(m => m.id === id); if (!mail) throw new Error('Diese Nachricht ist nicht vorhanden.');
    const files: FileAttachment[] = [];
    if (ctx.provider() && !mail.id.startsWith('local:')) for (const a of mail.attachments) { if (a.size > 20 * 1024 * 1024) throw new Error('Dieser Anhang überschreitet das Exportlimit.'); files.push({ name: a.name, content: await ctx.provider()!.attachment(mail,a.id) }); }
    content = (await nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail({ from: { name: mail.sender, address: mail.address }, to: recipients(mail.to), cc: recipients(mail.cc || ''), subject: mail.subject, text: mail.body, html: mail.html, date: new Date(mail.date), messageId: mail.messageId, attachments: files.map(f => ({ filename: f.name, content: f.content })), disableFileAccess: true, disableUrlAccess: true })).message as Buffer;
  }
  const choice = await dialog.showSaveDialog(ctx.window, { defaultPath: 'Postblick.' + extension, filters: [{ name: extension.toUpperCase(), extensions: [extension] }] });
  if (!choice.canceled && choice.filePath) await writeFile(choice.filePath,content,{ mode:0o600 });
}
async function importData(ctx: Context, format: string) {
  const extension = format === 'contacts' ? 'csv' : format === 'calendar' ? 'ics' : 'eml';
  const choice = await dialog.showOpenDialog(ctx.window, { properties: ['openFile'], filters: [{ name: extension.toUpperCase(), extensions: [extension] }] });
  if (choice.canceled) return;
  const file = choice.filePaths[0]; if ((await stat(file)).size > 20 * 1024 * 1024) throw new Error('Die Importdatei überschreitet 20 MB.');
  const content = await readFile(file);
  if (format === 'contacts') {
    const rows = csvRows(content.toString('utf8').replace(/^\uFEFF/,'')); const header = rows.shift();
    if (!header || header.slice(0,4).join(',') !== 'name,email,phone,company' || rows.length > 5000) throw new Error('Die CSV-Datei benötigt die Spalten name,email,phone,company (höchstens 5000 Kontakte).');
    const contacts = rows.filter(r => r.some(Boolean)).map(r => contactSchema.parse({ name:r[0],email:r[1],phone:r[2] || '',company:r[3] || '',emails:r[4] || '',phones:r[5] || '',group:r[6] || '' }));
    for (const contact of contacts) { const p = ctx.provider(); const id = p instanceof MicrosoftProvider ? await p.saveContact(contact) : randomUUID(); ctx.store.state.contacts.push({ ...contact,id }); await ctx.store.save(); }
  } else if (format === 'calendar') {
    const root = new ICAL.Component(ICAL.parse(content.toString('utf8')));
    const components = root.getAllSubcomponents('vevent'); if (components.length > 5000) throw new Error('Die Kalenderdatei überschreitet 5000 Termine.');
    const local = (v: ICAL.Time) => { const date = v.toJSDate(); return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,19); };
    const events = components.map(component => {
      const event = new ICAL.Event(component); const recur = component.getFirstPropertyValue('rrule') as ICAL.Recur | null;
      if (event.isRecurrenceException() || recur) throw new Error('Diese Importversion unterstützt nur einzelne Termine. Serientermine bitte in Postblick erstellen.');
      return eventSchema.parse({ title:event.summary || 'Termin',start:local(event.startDate),end:local(event.endDate),location:event.location || '',notes:event.description || '',allDay:event.startDate.isDate });
    });
    for (const event of events) { const p = ctx.provider(); const id = p instanceof MicrosoftProvider ? await p.saveEvent(event) : randomUUID(); ctx.store.state.events.push({ ...event,id }); await ctx.store.save(); }
  } else {
    const parsed = await simpleParser(content,{ skipTextToHtml:true,skipImageLinks:true });
    const addresses = (field: typeof parsed.to) => (Array.isArray(field) ? field : field ? [field] : []).flatMap(f => f.value.map(v => v.address).filter(Boolean)).join(', ');
    if (!ctx.store.state.folders!.some(f => f.id === 'custom:local-import')) ctx.store.state.folders!.push({ id:'custom:local-import',name:'Importierte Nachrichten · lokal' });
    ctx.store.state.mails.push({ id:'local:' + randomUUID(),folder:'custom:local-import',sender:parsed.from?.value[0]?.name || '',address:parsed.from?.value[0]?.address || '',to:addresses(parsed.to),cc:addresses(parsed.cc),subject:parsed.subject || '(Kein Betreff)',body:parsed.text || '',html:parsed.html || undefined,date:(parsed.date || new Date()).toISOString(),read:true,flagged:false,attachments:[] });
    ctx.store.state.notice = 'Nachricht lokal importiert. Anhänge bleiben in der ursprünglichen EML-Datei; die Nachricht wird nicht auf den Server hochgeladen.';
  }
}
