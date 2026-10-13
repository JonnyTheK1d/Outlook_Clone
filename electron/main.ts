import { app, BrowserWindow, dialog, ipcMain, net, protocol, session } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Attachment, Folder, Mail, Outgoing, State } from '../shared/types';
import { createDemo } from '../shared/demo';
import { Store, secureAvailable, type Credentials } from './store';
import { ImapProvider, MicrosoftProvider, type FileAttachment, type Provider } from './providers';
import { authorize } from './oauth';
import { applyLocalAction, localOutgoing } from './local';
import { clientIdSchema, contactSchema, eventSchema, folderSchema, identifierSchema, imapSchema, mailActionSchema, outgoingSchema, recipients, taskSchema } from './validation';

protocol.registerSchemesAsPrivileged([{ scheme: 'postblick', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const development = !app.isPackaged && process.argv.includes('--dev');
const origin = development ? 'http://127.0.0.1:5173' : 'postblick://bundle';
let window: BrowserWindow;
let store: Store;
let provider: Provider | null = null;
const selectedFiles = new Map<string, string>();
let queue = Promise.resolve();

function makeProvider(credentials: Credentials, persist = async (current: Credentials) => { store.credentials = current; await store.persistCredentials(); }): Provider {
  return credentials.type === 'imap' ? new ImapProvider(credentials) : new MicrosoftProvider(credentials, persist);
}
async function save(): Promise<State> { await store.save(); return structuredClone(store.state); }
async function sync(folder: Folder) {
  if (provider) {
    const mails = await provider.list(folder);
    store.state.mails = [...store.state.mails.filter(m => m.folder !== folder), ...mails];
    if (provider instanceof MicrosoftProvider) {
      // A failed required sync remains visible; partial data is not reported as complete.
      store.state.events = await provider.events();
      store.state.contacts = await provider.contacts();
    }
  }
  store.state.updatedAt = new Date().toISOString();
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
    if (!location) throw new Error('Bitte wähle die Anhänge vor dem Senden erneut aus.');
    const info = await stat(location);
    total += info.size;
    if (!info.isFile() || total > 2 * 1024 * 1024) throw new Error('Neue Anhänge dürfen zusammen maximal 2 MB groß sein.');
    const content = await readFile(location);
    if (content.length !== info.size) throw new Error('Ein Anhang wurde verändert. Bitte erneut auswählen.');
    result.push({ name: path.basename(location), content });
  }
  return result;
}
function validateOutgoing(value: unknown, draft = false) {
  const message = outgoingSchema.parse(value);
  if (!draft && !recipients(message.to).length) throw new Error('Bitte mindestens einen Empfänger angeben.');
  recipients(message.to);
  recipients(message.cc);
  if (message.draftId && findMail(message.draftId).folder !== 'drafts') throw new Error('Ungültiger Entwurf.');
  return message;
}
async function connect(credentials: Credentials) {
  if (!secureAvailable()) throw new Error('Echte Konten benötigen einen sicheren Betriebssystem-Schlüsselspeicher.');
  const staged = { credentials };
  const nextProvider = makeProvider(credentials, async current => { staged.credentials = current; });
  const profile = await nextProvider.profile();
  const mails = await nextProvider.list('inbox');
  const events = nextProvider instanceof MicrosoftProvider ? await nextProvider.events() : [];
  const contacts = nextProvider instanceof MicrosoftProvider ? await nextProvider.contacts() : [];
  const previous = { state: store.state, credentials: store.credentials };
  store.credentials = staged.credentials;
  store.state = { mode: credentials.type, ...profile, mails, events, contacts, tasks: [], theme: store.state.theme, updatedAt: new Date().toISOString() };
  try { await store.save(); } catch (error) { store.state = previous.state; store.credentials = previous.credentials; throw error; }
  // Subsequent refreshes persist against the now-committed mailbox.
  provider = makeProvider(staged.credentials);
  selectedFiles.clear();
  return structuredClone(store.state);
}
function register(name: string, handler: (value: any) => Promise<unknown>) {
  ipcMain.handle(name, async (event, value) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || !event.senderFrame.url.startsWith(origin + '/')) throw new Error('Unzulässiger Zugriff.');
    const operation = queue.then(async () => {
      try { return { ok: true, value: await handler(value) }; }
      catch (error) {
        if (error instanceof z.ZodError) return { ok: false, error: error.issues.map(issue => issue.message).join(' · ') };
        // Our own errors are safe; never surface protocol responses or filesystem paths.
        const message = error instanceof Error ? error.message : '';
        const safe = /^(Bitte |Die |Der |Das |Diese|Dieser|Echte |Microsoft|Ungültig|Neue |Ein Anhang|Anmeldung)/.test(message);
        return { ok: false, error: safe ? message : 'Die Verbindung oder Speicherung ist fehlgeschlagen. Prüfe Serverdaten, Zugang und Netzwerk.' };
      }
    });
    queue = operation.then(() => undefined, () => undefined);
    return operation;
  });
}
function registerHandlers() {
  register('state', async () => structuredClone(store.state));
  register('capabilities', async () => ({ desktop: true, secureStorage: secureAvailable(), platform: process.platform }));
  register('sync', value => sync(folderSchema.parse(value)));
  register('mail-action', async value => {
    const action = mailActionSchema.parse(value);
    const mail = findMail(action.id);
    if (action.kind === 'delete' && mail.folder !== 'trash' && mail.folder !== 'drafts') throw new Error('Bitte zuerst in den Papierkorb verschieben.');
    if (provider) await provider.action(mail, action);
    if (provider && action.kind === 'move') store.state.mails = store.state.mails.filter(m => m.id !== mail.id); else applyLocalAction(store.state, action);
    return save();
  });
  register('send', async value => {
    const message = validateOutgoing(value);
    const files = await filesFor(message);
    if (provider) {
      await provider.send(message, files);
      store.state.mails = store.state.mails.filter(m => m.id !== message.draftId);
      store.state.notice = store.state.mode === 'imap' ? 'Der SMTP-Server hat die Nachricht angenommen. Eine Kopie unter „Gesendet“ hängt von deinem Anbieter ab.' : 'Microsoft hat die Nachricht zum Versand angenommen.';
    } else localOutgoing(store.state, message, false);
    for (const attachment of message.attachments) selectedFiles.delete(attachment.id);
    // The server has accepted the message. A local write error must not invite duplicate sending.
    try { return await save(); } catch { store.state.notice = 'Die Nachricht wurde angenommen, aber die lokale Speicherung ist fehlgeschlagen. Bitte nicht erneut senden.'; return structuredClone(store.state); }
  });
  register('save-draft', async value => {
    const message = validateOutgoing(value, true);
    if (provider) { const files = await filesFor(message); await provider.draft(message, files); await sync('drafts'); } else localOutgoing(store.state, message, true);
    for (const attachment of message.attachments) selectedFiles.delete(attachment.id);
    return save();
  });
  register('pick-attachments', async () => {
    const choice = await dialog.showOpenDialog(window, { title: 'Anhänge auswählen (zusammen maximal 2 MB)', properties: ['openFile', 'multiSelections'] });
    if (choice.canceled) return [];
    const results: Attachment[] = [];
    let total = 0;
    for (const file of choice.filePaths) {
      const info = await stat(file); total += info.size;
      if (!info.isFile() || total > 2 * 1024 * 1024 || results.length >= 10) throw new Error('Neue Anhänge dürfen zusammen maximal 2 MB groß sein (höchstens 10 Dateien).');
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
    const choice = await dialog.showSaveDialog(window, { defaultPath: name, title: 'Anhang speichern' });
    if (choice.canceled || !choice.filePath) return false;
    const content = await provider.attachment(mail, attachment.id);
    if (content.length > 20 * 1024 * 1024) throw new Error('Dieser Anhang überschreitet das Größenlimit.');
    await writeFile(choice.filePath, content, { mode: 0o600 });
    return true;
  });
  register('connect-microsoft', async value => { if (!secureAvailable()) throw new Error('Echte Konten benötigen einen sicheren Betriebssystem-Schlüsselspeicher.'); return connect(await authorize(clientIdSchema.parse(value))); });
  register('connect-imap', async value => connect({ type: 'imap', ...imapSchema.parse(value) }));
  register('disconnect', async () => {
    const previous = { state: store.state, credentials: store.credentials };
    store.credentials = null; store.state = createDemo();
    try { await store.save(); } catch (error) { store.state = previous.state; store.credentials = previous.credentials; throw error; }
    provider = null; selectedFiles.clear();
    return structuredClone(store.state);
  });
  register('demo', async () => { if (provider) throw new Error('Bitte zuerst das verbundene Konto trennen.'); store.state = createDemo(); return save(); });
  register('save-event', async value => { const item = eventSchema.parse(value); const id = provider instanceof MicrosoftProvider ? await provider.saveEvent(item) : item.id || randomUUID(); store.state.events = [...store.state.events.filter(e => e.id !== item.id), { ...item, id }]; return save(); });
  register('delete-event', async value => { const id = identifierSchema.parse(value); if (provider instanceof MicrosoftProvider) await provider.deleteEvent(id); store.state.events = store.state.events.filter(e => e.id !== id); return save(); });
  register('save-contact', async value => { const item = contactSchema.parse(value); const id = provider instanceof MicrosoftProvider ? await provider.saveContact(item) : item.id || randomUUID(); store.state.contacts = [...store.state.contacts.filter(c => c.id !== item.id), { ...item, id }]; return save(); });
  register('delete-contact', async value => { const id = identifierSchema.parse(value); if (provider instanceof MicrosoftProvider) await provider.deleteContact(id); store.state.contacts = store.state.contacts.filter(c => c.id !== id); return save(); });
  register('save-task', async value => { const item = taskSchema.parse(value); store.state.tasks = [...store.state.tasks.filter(t => t.id !== item.id), { ...item, id: item.id || randomUUID() }]; return save(); });
  register('delete-task', async value => { const id = identifierSchema.parse(value); store.state.tasks = store.state.tasks.filter(t => t.id !== id); return save(); });
  register('theme', async value => { store.state.theme = z.enum(['light', 'dark']).parse(value); return save(); });
}
async function start() {
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
  if (store.credentials) provider = makeProvider(store.credentials);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.on('will-download', event => event.preventDefault());
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => callback({ responseHeaders: {
    ...details.responseHeaders,
    'Content-Security-Policy': [`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'${development ? ' ws://127.0.0.1:5173' : ''}; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'`]
  } }));
  window = new BrowserWindow({ width: 1440, height: 940, minWidth: 980, minHeight: 680, title: 'Postblick', backgroundColor: '#f5f7fa', show: false, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: true, devTools: !app.isPackaged }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(origin + '/')) event.preventDefault(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  registerHandlers();
  window.once('ready-to-show', () => window.show());
  await window.loadURL(development ? origin + '/' : origin + '/index.html');
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(start).catch(() => { dialog.showErrorBox('Postblick konnte nicht starten', 'Der lokale Speicher oder die Desktop-Umgebung ist nicht verfügbar. Entsperre den Betriebssystem-Schlüsselspeicher. Bestehende Daten werden nicht automatisch gelöscht.'); app.quit(); });
  app.on('window-all-closed', () => app.quit());
}
