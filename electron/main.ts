import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, session, Notification, nativeImage } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Attachment, Folder, Mail, Outgoing, State, WindowRequest } from '../shared/types';
import { createDemo } from '../shared/demo';
import { normalize, occurrences } from '../shared/features';
import { handleCommand, flushOutbox, applyRules } from './commands';
import { Store, secureAvailable, type Credentials } from './store';
import { ImapProvider, MicrosoftProvider, type FileAttachment, type Provider } from './providers';
import { initializeUpdates } from './updates';
import { parseMailto } from './mailto';
import { authorize } from './oauth';
import { applyLocalAction, localOutgoing } from './local';
import { clientIdSchema, contactSchema, eventSchema, folderSchema, identifierSchema, imapSchema, mailActionSchema, outgoingSchema, recipients, taskSchema, windowRequestSchema } from './validation';

protocol.registerSchemesAsPrivileged([{ scheme: 'postblick', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const profileArgument = !app.isPackaged && process.argv.find(a=>a.startsWith('--user-data-dir='));
if(profileArgument)app.setPath('userData',path.resolve(profileArgument.slice('--user-data-dir='.length)));
const development = !app.isPackaged && process.argv.includes('--dev');
const origin = development ? 'http://127.0.0.1:5173' : 'postblick://bundle';
let window: BrowserWindow;
// Every window that loads the bundle (main window and pop-outs) may use the bridge.
const appWindows = new Set<BrowserWindow>();
const popouts = new Map<string, BrowserWindow>();
const payloads = new Map<number, WindowRequest>();
let caller: BrowserWindow | undefined;
let store: Store;
let provider: Provider | null = null;
const selectedFiles = new Map<string, string>();
let queue = Promise.resolve();

function makeProvider(credentials: Credentials, persist = async (current: Credentials) => { store.credentials = current; await store.persistCredentials(); }): Provider {
  return credentials.type === 'imap' ? new ImapProvider(credentials) : new MicrosoftProvider(credentials, persist);
}
function updateBadge() {
  if(process.platform!=='win32' || !window || window.isDestroyed())return;
  const hasReal=Object.values(store.accounts).some(a=>a.credentials);
  const count=Object.values(store.accounts).filter(a=>!hasReal || a.credentials).reduce((n,a)=>n+a.state.mails.filter(m=>m.folder==='inbox' && !m.read).length,0);
  const icon=app.isPackaged?path.join(process.resourcesPath,'icon.png'):path.join(app.getAppPath(),'build/icon.png');
  window.setOverlayIcon(count?nativeImage.createFromPath(icon):null,count+' ungelesene Nachrichten');
}
async function save(): Promise<State> { await store.save(); updateBadge(); return store.view(); }
async function sync(folder: Folder) {
  if (!['inbox','sent','drafts','archive','junk','trash'].includes(folder) && !store.state.folders?.some(f => f.id === folder)) throw new Error('Dieser Ordner ist nicht vorhanden.');
  if (provider && folder !== 'custom:local-import') {
    const old = store.state.mails.filter(m => m.folder === folder);
    const mails = await provider.list(folder);
    for (const mail of mails) { const previous = old.find(m => m.id === mail.id); mail.pinned = previous?.pinned; if (store.state.mode === 'imap') mail.categories = previous?.categories || []; }
    store.state.mails = [...store.state.mails.filter(m => m.folder !== folder), ...mails];
    if (folder === 'inbox') await applyRules(context());
    store.state.completeFolders = [...new Set([...(store.state.completeFolders || []), folder])];
    if (provider instanceof MicrosoftProvider) {
      const calendars=await provider.calendars();store.state.calendars=calendars.map(c=>({...c,visible:store.state.calendars?.find(p=>p.id===c.id)?.visible ?? true}));store.state.events = await provider.events(); store.state.contacts = await provider.contacts();
    }
  }
  store.state.updatedAt = new Date().toISOString(); delete store.state.syncError;
  return save();
}
function findMail(id: string): Mail {
  const mail = store.state.mails.find(m => m.id === id);
  if (!mail) throw new Error('Die Nachricht ist nicht mehr vorhanden.');
  return mail;
}
async function filesFor(message: Outgoing): Promise<FileAttachment[]> {
  let total = 0;
  const result: FileAttachment[] = [];
  for (const attachment of message.attachments) {
    const location = selectedFiles.get(attachment.id);
    if (!location) { const cached = store.queuedFiles['recovery:' + store.state.accountId]?.find(f=>f.id===attachment.id); if(!cached)throw new Error('Bitte wähle die Anhänge vor dem Senden erneut aus.'); const content=Buffer.from(cached.content,'base64');total+=content.length;if(total>20*1024*1024)throw new Error('Neue Anhänge dürfen zusammen maximal 20 MB groß sein.');result.push({name:cached.name,content});continue; }
    const info = await stat(location);
    total += info.size;
    if (!info.isFile() || total > 20 * 1024 * 1024) throw new Error('Neue Anhänge dürfen zusammen maximal 20 MB groß sein.');
    const content = await readFile(location);
    if (content.length !== info.size) throw new Error('Ein Anhang wurde verändert. Bitte erneut auswählen.');
    result.push({ name: path.basename(location), content });
  }
  return result;
}
function validateOutgoing(value: unknown, draft = false) {
  const message: Outgoing = outgoingSchema.parse(value);
  if (!draft && !recipients(message.to + ',' + message.cc + ',' + (message.bcc || '')).length) throw new Error('Bitte mindestens einen Empfänger angeben.');
  recipients(message.to);
  recipients(message.cc); recipients(message.bcc || '');
  if (message.replyId) { const original = findMail(message.replyId); message.inReplyTo = original.messageId; message.references = [original.references, original.messageId].filter(Boolean).join(' '); }
  if (message.forwardId) findMail(message.forwardId);
  if (message.draftId && findMail(message.draftId).folder !== 'drafts') throw new Error('Ungültiger Entwurf.');
  return message;
}
async function connect(credentials: Credentials) {
  if (!secureAvailable()) throw new Error('Echte Konten benötigen einen sicheren Betriebssystem-Schlüsselspeicher.');
  const staged = { credentials };
  const nextProvider = makeProvider(credentials, async current => { staged.credentials = current; });
  const profile = await nextProvider.profile();
  const mails = await nextProvider.list('inbox');
  const folders = await nextProvider.folders();
  const calendars = nextProvider instanceof MicrosoftProvider ? await nextProvider.calendars() : undefined;
  const events = nextProvider instanceof MicrosoftProvider ? await nextProvider.events() : [];
  const contacts = nextProvider instanceof MicrosoftProvider ? await nextProvider.contacts() : [];
  const previous = { state: store.state, credentials: store.credentials, accounts: { ...store.accounts } };
  const existing = Object.entries(store.accounts).find(([,a]) => a.state.mode === credentials.type && a.state.email.toLowerCase() === profile.email.toLowerCase());
  if (store.state.accountId) store.accounts[store.state.accountId] = { state: store.state, credentials: store.credentials };
  store.credentials = staged.credentials;
  store.state = normalize({ ...(existing?.[1].state || {}), accountId: existing?.[0] || randomUUID(), mode: credentials.type, ...profile, calendars, folders, mails, events, contacts, tasks: [], theme: store.state.theme, updatedAt: new Date().toISOString() });
  try { await store.save(); } catch (error) { store.state = previous.state; store.credentials = previous.credentials; store.accounts = previous.accounts; throw error; }
  // Subsequent refreshes persist against the now-committed mailbox.
  provider = makeProvider(staged.credentials);
  selectedFiles.clear();
  return store.view();
}
async function outgoingFiles(message: Outgoing): Promise<FileAttachment[]> {
  const files = await filesFor(message);
  if (message.forwardId && provider && !(provider instanceof MicrosoftProvider)) {
    const original = findMail(message.forwardId);
    for (const a of original.attachments) { if (a.size > 20 * 1024 * 1024) throw new Error('Dieser Anhang überschreitet das Größenlimit.'); files.push({ name: a.name, content: await provider.attachment(original, a.id) }); }
  }
  if (files.reduce((sum,f) => sum + f.content.length,0) > 20 * 1024 * 1024) throw new Error('Neue Anhänge dürfen zusammen maximal 20 MB groß sein.');
  return files;
}
const activeWindow = () => caller && !caller.isDestroyed() ? caller : window;
function broadcast(state: State, except?: Electron.WebContents) {
  for (const target of appWindows) if (!target.isDestroyed() && target.webContents !== except) target.webContents.send('state-updated', state);
}
function context() { return { store, window: activeWindow(), provider: () => provider, setProvider: () => { provider = store.credentials ? makeProvider(store.credentials) : null; selectedFiles.clear(); }, sync, save, files: outgoingFiles, validate: validateOutgoing }; }
let backgroundRunning = false;
const reminded = new Set<string>();
async function background() {
  const active = store.state.accountId!;
  try {
    for (const id of Object.keys(store.accounts)) {
      store.activate(id); provider = store.credentials ? makeProvider(store.credentials) : null;
      try {
        if (provider && Date.now() - Date.parse(store.state.updatedAt || '1970-01-01') >= (store.state.preferences?.syncMinutes || 2) * 60000) {
          const existing = new Set(store.state.mails.filter(m => m.folder === 'inbox').map(m => m.id));
          await sync('inbox');
          const arrived = store.state.mails.filter(m => m.folder === 'inbox' && !existing.has(m.id) && !m.read);
          if (arrived.length && store.state.preferences?.notifications && Notification.isSupported()) new Notification({ title: 'Postblick · ' + store.state.email, body: arrived.length + ' neue Nachricht(en)' }).show();
        }
        await flushOutbox(context());
        const now = new Date(), soon = new Date(Date.now() + 86400000);
        const events = occurrences(store.state.events, now, soon);
        for (const item of [...events.map(e => ({ id: e.id + ':' + e.start, title: e.title, at: Date.parse(e.start) - (e.reminder || 0) * 60000, enabled: !!e.reminder })), ...store.state.tasks.map(t => ({ id: t.id, title: t.title, at: Date.parse(t.reminder || ''), enabled: !t.done && !!t.reminder }))]) {
          const key = id + ':' + item.id;
          if (item.enabled && item.at <= Date.now() && item.at > Date.now() - 60000 && !reminded.has(key)) { reminded.add(key); if (store.state.preferences?.notifications && Notification.isSupported()) new Notification({ title: 'Postblick · Erinnerung', body: item.title }).show(); }
        }
      } catch { store.state.syncError = 'Die automatische Synchronisierung ist fehlgeschlagen. Prüfe Verbindung und Anmeldung.'; }
    }
  } finally { store.activate(active); provider = store.credentials ? makeProvider(store.credentials) : null; await store.save(); updateBadge(); broadcast(store.view()); }
}
function register(name: string, handler: (value: any, sender: BrowserWindow) => Promise<unknown>, immediate = false) {
  ipcMain.handle(name, async (event, value) => {
    const sender = BrowserWindow.fromWebContents(event.sender);
    if (!sender || !appWindows.has(sender) || event.senderFrame !== sender.webContents.mainFrame || !event.senderFrame.url.startsWith(origin + '/')) throw new Error('Unzulässiger Zugriff.');
    // Opening windows touches no mailbox data and must not wait behind a long synchronisation.
    if (immediate) { try { return { ok: true, value: await handler(value, sender) }; } catch (error) { return { ok: false, error: error instanceof z.ZodError ? error.issues.map(issue => issue.message).join(' · ') : 'Das Fenster konnte nicht geöffnet werden.' }; } }
    const operation = queue.then(async () => {
      try {
        caller = sender;
        const result = await handler(value, sender);
        // Keep other open windows (read and compose pop-outs) in sync with the shared mailbox.
        if (result && typeof result === 'object' && Array.isArray((result as State).mails)) broadcast(result as State, event.sender);
        return { ok: true, value: result };
      }
      catch (error) {
        if (error instanceof z.ZodError) return { ok: false, error: error.issues.map(issue => issue.message).join(' · ') };
        // Our own errors are safe; never surface protocol responses or filesystem paths.
        const message = error instanceof Error ? error.message : '';
        const safe = /^(Bitte |Die |Der |Das |Diese|Dieser|Echte |Microsoft|Ungültig|Neue |Ein Anhang|Anmeldung)/.test(message);
        return { ok: false, error: safe ? message : 'Die Verbindung oder Speicherung ist fehlgeschlagen. Prüfe Serverdaten, Zugang und Netzwerk.' };
      }
      finally { caller = undefined; }
    });
    queue = operation.then(() => undefined, () => undefined);
    return operation;
  });
}
function registerHandlers() {
  register('state', async () => store.view());
  register('capabilities', async () => ({ desktop: true, secureStorage: secureAvailable(), platform: process.platform }));
  register('sync', value => sync(folderSchema.parse(value)));
  register('mail-action', async value => {
    const action = mailActionSchema.parse(value);
    const mail = findMail(action.id);
    if (action.kind === 'delete' && mail.folder !== 'trash' && mail.folder !== 'drafts') throw new Error('Bitte zuerst in den Papierkorb verschieben.');
    if (action.kind === 'move' && !['inbox','sent','drafts','archive','junk','trash'].includes(action.folder) && !store.state.folders?.some(f => f.id === action.folder)) throw new Error('Dieser Ordner ist nicht vorhanden.');
    if (provider && !mail.id.startsWith('local:')) await provider.action(mail, action);
    if (provider && !mail.id.startsWith('local:') && action.kind === 'move') store.state.mails = store.state.mails.filter(m => m.id !== mail.id); else applyLocalAction(store.state, action);
    return save();
  });
  register('send', async value => {
    const message = validateOutgoing(value);
    const files = await outgoingFiles(message);
    if (message.scheduledAt && Date.parse(message.scheduledAt) > Date.now()) return handleCommand(context(), { kind: 'queue', message });
    if (provider) {
      await provider.send(message, files);
      store.state.mails = store.state.mails.filter(m => m.id !== message.draftId);
      store.state.notice = store.state.mode === 'imap' ? 'Der SMTP-Server hat die Nachricht angenommen. Eine Gesendet-Kopie wurde versucht; bei Verbindungsfehlern kann sie fehlen.' : 'Microsoft hat die Nachricht zum Versand angenommen.';
    } else localOutgoing(store.state, message, false);
    for (const attachment of message.attachments) selectedFiles.delete(attachment.id);
    // The server has accepted the message. A local write error must not invite duplicate sending.
    try { return await save(); } catch { store.state.notice = 'Die Nachricht wurde angenommen, aber die lokale Speicherung ist fehlgeschlagen. Bitte nicht erneut senden.'; return store.view(); }
  });
  register('save-draft', async value => {
    const message = validateOutgoing(value, true);
    if (provider) { const files = await outgoingFiles(message); await provider.draft(message, files); await sync('drafts'); } else localOutgoing(store.state, message, true);
    for (const attachment of message.attachments) selectedFiles.delete(attachment.id);
    return save();
  });
  register('pick-attachments', async () => {
    const choice = await dialog.showOpenDialog(activeWindow(), { title: 'Anhänge auswählen (zusammen maximal 20 MB)', properties: ['openFile', 'multiSelections'] });
    if (choice.canceled) return [];
    const results: Attachment[] = [];
    let total = 0;
    for (const file of choice.filePaths) {
      const info = await stat(file); total += info.size;
      if (!info.isFile() || total > 20 * 1024 * 1024 || results.length >= 20) throw new Error('Neue Anhänge dürfen zusammen maximal 20 MB groß sein (höchstens 20 Dateien).');
      const id = randomUUID(); selectedFiles.set(id, file); results.push({ id, name: path.basename(file), size: info.size });
    }
    return results;
  });
  register('download-attachment', async value => {
    const payload = z.object({ mailId: identifierSchema, attachmentId: identifierSchema }).strict().parse(value);
    const mail = findMail(payload.mailId);
    const attachment = mail.attachments.find(a => a.id === payload.attachmentId);
    if (!attachment || !provider) throw new Error('Dieser Anhang ist nicht verfügbar.');
    if (attachment.size > 20 * 1024 * 1024) throw new Error('Dieser Anhang überschreitet das Limit von 20 MB.');
    const name = path.basename(attachment.name.replace(/[\\/]/g, '_')).replace(/[<>:"|?*\x00-\x1F]/g, '_');
    const choice = await dialog.showSaveDialog(activeWindow(), { defaultPath: name, title: 'Anhang speichern' });
    if (choice.canceled || !choice.filePath) return false;
    const content = await provider.attachment(mail, attachment.id);
    if (content.length > 20 * 1024 * 1024) throw new Error('Dieser Anhang überschreitet das Größenlimit.');
    await writeFile(choice.filePath, content, { mode: 0o600 });
    return true;
  });
  register('connect-microsoft', async value => { if (!secureAvailable()) throw new Error('Echte Konten benötigen einen sicheren Betriebssystem-Schlüsselspeicher.'); return connect(await authorize(clientIdSchema.parse(value))); });
  register('connect-imap', async value => connect({ type: 'imap', ...imapSchema.parse(value) }));
  register('disconnect', async () => {
    const previous = { state: store.state, credentials: store.credentials, accounts: { ...store.accounts }, queuedFiles: { ...store.queuedFiles } };
    for (const item of store.state.outbox || []) delete store.queuedFiles[item.id];
    delete store.queuedFiles['recovery:' + store.state.accountId];
    delete store.accounts[store.state.accountId!];
    const next = Object.keys(store.accounts)[0];
    if (next) { store.state = store.accounts[next].state; store.credentials = store.accounts[next].credentials; }
    else { store.state = normalize(createDemo()); store.state.accountId = randomUUID(); store.credentials = null; }
    try { await store.save(); } catch (error) { store.state = previous.state; store.credentials = previous.credentials; store.accounts = previous.accounts; store.queuedFiles=previous.queuedFiles;throw error; }
    provider = store.credentials ? makeProvider(store.credentials) : null; selectedFiles.clear();
    return store.view();
  });
  register('demo', async () => { if (provider) throw new Error('Bitte zuerst das verbundene Konto trennen.'); const id = store.state.accountId; store.state = normalize(createDemo()); store.state.accountId = id; return save(); });
  register('save-event', async value => { const item = eventSchema.parse(value); if(item.calendarId && !store.state.calendars?.some(c=>c.id===item.calendarId && c.canEdit))throw new Error('Dieser Kalender ist nicht beschreibbar.');recipients(item.attendees || ''); if (!(provider instanceof MicrosoftProvider) && (item.attendees || item.online)) throw new Error('Diese Besprechungsfunktion benötigt ein Microsoft-Konto.'); const id = provider instanceof MicrosoftProvider ? await provider.saveEvent(item) : item.id || randomUUID(); store.state.events = [...store.state.events.filter(e => e.id !== item.id), { ...item, id }]; return save(); });
  register('delete-event', async value => { const id = identifierSchema.parse(value); if (provider instanceof MicrosoftProvider) await provider.deleteEvent(id); store.state.events = store.state.events.filter(e => e.id !== id); return save(); });
  register('save-contact', async value => { const item = contactSchema.parse(value); recipients(item.emails || item.email); const id = provider instanceof MicrosoftProvider ? await provider.saveContact(item) : item.id || randomUUID(); store.state.contacts = [...store.state.contacts.filter(c => c.id !== item.id), { ...item, id }]; return save(); });
  register('delete-contact', async value => { const id = identifierSchema.parse(value); if (provider instanceof MicrosoftProvider) await provider.deleteContact(id); store.state.contacts = store.state.contacts.filter(c => c.id !== id); return save(); });
  register('save-task', async value => { const item = taskSchema.parse(value); if(item.recurrence && item.recurrence!=='none' && !item.due)throw new Error('Bitte ein Fälligkeitsdatum für wiederkehrende Aufgaben angeben.');const wasDone=store.state.tasks.find(t=>t.id===item.id)?.done;const taskId = provider instanceof MicrosoftProvider ? await provider.saveTask(item) : item.id || randomUUID(); store.state.tasks = [...store.state.tasks.filter(t => t.id !== item.id), { ...item, id: taskId }];if(!(provider instanceof MicrosoftProvider) && item.done && !wasDone && item.recurrence && item.recurrence!=='none' && item.due){const date=new Date(item.due+'T12:00:00');if(item.recurrence==='daily')date.setDate(date.getDate()+1);if(item.recurrence==='weekly')date.setDate(date.getDate()+7);if(item.recurrence==='monthly'){const day=date.getDate();date.setDate(1);date.setMonth(date.getMonth()+1);date.setDate(Math.min(day,new Date(date.getFullYear(),date.getMonth()+1,0).getDate()));}store.state.tasks.push({...item,id:randomUUID(),done:false,due:date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0'),reminder:undefined,steps:item.steps?.map(s=>({...s,done:false}))});}return save(); });
  register('delete-task', async value => { const id = identifierSchema.parse(value); if (provider instanceof MicrosoftProvider) await provider.deleteTask(id); store.state.tasks = store.state.tasks.filter(t => t.id !== id); return save(); });
  register('manage', value => handleCommand(context(), value));
  register('theme', async value => { store.state.theme = z.enum(['light', 'dark']).parse(value); return save(); });
  register('open-window', async value => { openWindow(windowRequestSchema.parse(value) as WindowRequest); }, true);
  register('window-payload', async (_value, sender) => payloads.get(sender.webContents.id) ?? null, true);
}
const preferences = () => ({ preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: true, devTools: !app.isPackaged });
function secure(target: BrowserWindow) {
  appWindows.add(target);
  const id = target.webContents.id;
  target.on('closed', () => { appWindows.delete(target); payloads.delete(id); });
  target.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  target.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(origin + '/')) event.preventDefault(); });
  target.webContents.on('will-attach-webview', event => event.preventDefault());
  // Electron has no default context menu: offer editing and spelling suggestions in text fields.
  target.webContents.on('context-menu', (_event, params) => {
    const items: Electron.MenuItemConstructorOptions[] = [];
    if (params.isEditable && params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 5)) items.push({ label: suggestion, click: () => target.webContents.replaceMisspelling(suggestion) });
      if (!params.dictionarySuggestions.length) items.push({ label: 'Keine Vorschläge', enabled: false });
      items.push({ label: 'Zum Wörterbuch hinzufügen', click: () => target.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord) }, { type: 'separator' });
    }
    if (params.isEditable) items.push({ label: 'Rückgängig', role: 'undo', enabled: params.editFlags.canUndo }, { label: 'Wiederholen', role: 'redo', enabled: params.editFlags.canRedo }, { type: 'separator' }, { label: 'Ausschneiden', role: 'cut', enabled: params.editFlags.canCut });
    if (params.isEditable || params.selectionText.trim()) items.push({ label: 'Kopieren', role: 'copy', enabled: params.editFlags.canCopy });
    if (params.isEditable) items.push({ label: 'Einfügen', role: 'paste', enabled: params.editFlags.canPaste }, { type: 'separator' }, { label: 'Alles auswählen', role: 'selectAll' });
    if (items.length) Menu.buildFromTemplate(items).popup({ window: target });
  });
}
const bundle = (hash = '') => (development ? origin + '/' : origin + '/index.html') + (hash ? '#' + hash : '');
function openWindow(request: WindowRequest) {
  const key = request.kind === 'mail' ? 'mail:' + (request.accountId || store.state.accountId) + ':' + request.id : 'compose:' + randomUUID();
  const existing = popouts.get(key);
  if (existing && !existing.isDestroyed()) { if (existing.isMinimized()) existing.restore(); existing.focus(); return; }
  const popout = new BrowserWindow({ width: 1000, height: 820, minWidth: 560, minHeight: 480, title: 'Postblick', backgroundColor: store.state.theme === 'dark' ? '#151b24' : '#f5f7fa', show: false, autoHideMenuBar: true, webPreferences: preferences() });
  secure(popout); popouts.set(key, popout);
  popout.on('closed', () => popouts.delete(key));
  if (request.kind === 'compose') payloads.set(popout.webContents.id, request);
  // A compose window with unsent changes asks before it closes, as Outlook does.
  popout.webContents.on('will-prevent-unload', event => {
    const choice = dialog.showMessageBoxSync(popout, { type: 'question', buttons: ['Schließen', 'Weiter bearbeiten'], defaultId: 1, cancelId: 1, title: 'Nachricht schließen?', message: 'Die Nachricht wurde noch nicht gesendet.', detail: 'Der automatisch gespeicherte Entwurf kann im Hauptfenster wiederhergestellt werden.' });
    if (choice === 0) event.preventDefault();
  });
  popout.once('ready-to-show', () => popout.show());
  const hash = request.kind === 'mail' ? 'mail=' + encodeURIComponent(request.id) + (request.accountId ? '&account=' + encodeURIComponent(request.accountId) : '') : 'compose';
  void popout.loadURL(bundle(hash));
}
async function start() {
  if(process.platform==='win32')app.setAppUserModelId('de.postblick.desktop');
  const dist = path.resolve(__dirname, '../../dist');
  protocol.handle('postblick', async request => {
    const url = new URL(request.url);
    let relative: string;
    try { relative = decodeURIComponent(url.pathname); } catch { return new Response('Invalid path', { status: 400 }); }
    const file = path.resolve(dist, '.' + relative);
    if (url.host !== 'bundle' || request.method !== 'GET' || !file.startsWith(dist + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  store = new Store(path.join(app.getPath('userData'), 'mailbox'));
  await store.load();
  const initialMailto = process.argv.find(a => a.startsWith('mailto:'));
  if (initialMailto) { try { store.state.workingDraft = parseMailto(initialMailto); } catch {} }
  if (store.credentials) provider = makeProvider(store.credentials);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.on('will-download', event => event.preventDefault());
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => callback({ responseHeaders: {
    ...details.responseHeaders,
    'Content-Security-Policy': [`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'${development ? ' ws://127.0.0.1:5173' : ''}; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'`]
  } }));
  // The default menu binds Ctrl+R / Ctrl+Shift+R to reload; Outlook uses them for reply.
  Menu.setApplicationMenu(Menu.buildFromTemplate([...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }, { role: 'editMenu' as const }] : []), { label: 'Ansicht', submenu: [{ label: 'Vergrößern', role: 'zoomIn' }, { label: 'Verkleinern', role: 'zoomOut' }, { label: 'Originalgröße', role: 'resetZoom' }, { type: 'separator' }, { label: 'Vollbild', role: 'togglefullscreen' }, ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' } as const])] }]));
  window = new BrowserWindow({ width: 1440, height: 940, minWidth: 980, minHeight: 680, title: 'Postblick', backgroundColor: '#f5f7fa', show: false, autoHideMenuBar: true, webPreferences: preferences() });
  secure(window);
  // Pop-outs belong to the main window; unsent compose text is kept by the local autosave.
  window.on('closed', () => { for (const popout of popouts.values()) if (!popout.isDestroyed()) popout.destroy(); });
  registerHandlers();
  window.once('ready-to-show', () => { window.show(); updateBadge(); });
  await window.loadURL(bundle());
  initializeUpdates(window);
  const timer = setInterval(() => { if (backgroundRunning) return; backgroundRunning = true; queue = queue.then(background).catch(() => {}).finally(() => { backgroundRunning = false; }); }, 60000); timer.unref();
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_event, args) => { const uri = args.find(a=>a.startsWith('mailto:')); if(uri)queue=queue.then(async()=>{try{store.state.workingDraft=parseMailto(uri);await save();broadcast(store.view());}catch{}}); if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(start).catch(() => { dialog.showErrorBox('Postblick konnte nicht starten', 'Der lokale Speicher oder die Desktop-Umgebung ist nicht verfügbar. Entsperre den Betriebssystem-Schlüsselspeicher. Bestehende Daten werden nicht automatisch gelöscht.'); app.quit(); });
  app.on('window-all-closed', () => app.quit());
}
