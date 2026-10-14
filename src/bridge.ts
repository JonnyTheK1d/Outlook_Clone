import type { Bridge, State } from '../shared/types';
import { createDemo } from '../shared/demo';
import { localCommand, normalize } from '../shared/features';
declare global { interface Window { postblick?: Bridge } }
// Browser preview only: isolated demo data. Native account APIs are never emulated.
const key = 'postblick-browser-demo-v1';
const windowKey = 'postblick-window-';
function load(): State { try { const saved = localStorage.getItem(key); if (saved) { const data = JSON.parse(saved); if (data.mode === 'demo') return data; } } catch {} return createDemo(); }
let demo = normalize(load());
const save = () => { localStorage.setItem(key, JSON.stringify(demo)); return Promise.resolve(structuredClone(demo)); };
const nativeRequired = async (): Promise<never> => { throw new Error('Diese Funktion benötigt die installierte Desktop-App. Die Browseransicht unterstützt nur lokale Demo-Daten.'); };
const browser: Bridge = {
  state: async () => structuredClone(normalize(demo)), capabilities: async () => ({ desktop: false, secureStorage: false, platform: 'browser' }),
  sync: async () => { demo.updatedAt = new Date().toISOString(); return save(); },
  mailAction: async action => {
    const mail = demo.mails.find(m => m.id === action.id); if (!mail) throw new Error('Nachricht nicht gefunden.');
    if (action.kind === 'read') mail.read = action.value;
    if (action.kind === 'flag') mail.flagged = action.value;
    if (action.kind === 'move') mail.folder = action.folder;
    if (action.kind === 'delete') demo.mails = demo.mails.filter(m => m.id !== action.id);
    return save();
  },
  send: async message => { demo.mails = demo.mails.filter(m => m.id !== message.draftId); demo.mails.unshift({ id: crypto.randomUUID(), folder: 'sent', sender: demo.name, address: demo.email, to: message.to, cc: message.cc, bcc: message.bcc, html: message.html, subject: message.subject, body: message.body, date: new Date().toISOString(), read: true, flagged: false, attachments: message.attachments }); return save(); },
  saveDraft: async message => { demo.mails = demo.mails.filter(m => m.id !== message.draftId); demo.mails.unshift({ id: message.draftId || crypto.randomUUID(), folder: 'drafts', sender: demo.name, address: demo.email, to: message.to, cc: message.cc, bcc: message.bcc, html: message.html, subject: message.subject, body: message.body, date: new Date().toISOString(), read: true, flagged: false, attachments: [] }); return save(); },
  pickAttachments: nativeRequired, downloadAttachment: nativeRequired, connectMicrosoft: nativeRequired, connectImap: nativeRequired,
  disconnect: async () => { demo = createDemo(); return save(); }, demo: async () => { demo = createDemo(); return save(); },
  saveEvent: async event => { demo.events = [...demo.events.filter(e => e.id !== event.id), { ...event, id: event.id || crypto.randomUUID() }]; return save(); },
  deleteEvent: async id => { demo.events = demo.events.filter(e => e.id !== id); return save(); },
  saveContact: async contact => { demo.contacts = [...demo.contacts.filter(c => c.id !== contact.id), { ...contact, id: contact.id || crypto.randomUUID() }]; return save(); },
  deleteContact: async id => { demo.contacts = demo.contacts.filter(c => c.id !== id); return save(); },
  saveTask: async task => { demo.tasks = [...demo.tasks.filter(t => t.id !== task.id), { ...task, id: task.id || crypto.randomUUID() }]; return save(); },
  deleteTask: async id => { demo.tasks = demo.tasks.filter(t => t.id !== id); return save(); },
  theme: async theme => { demo.theme = theme; return save(); },
  // Pop-out windows share the demo through localStorage; compose content travels under a one-time key.
  openWindow: async request => {
    const token = crypto.randomUUID();
    if (request.kind === 'compose') localStorage.setItem(windowKey + token, JSON.stringify(request));
    const hash = request.kind === 'mail' ? 'mail=' + encodeURIComponent(request.id) + (request.accountId ? '&account=' + encodeURIComponent(request.accountId) : '') : 'compose=' + token;
    if (!window.open(location.href.split('#')[0] + '#' + hash, '_blank', 'popup,width=1000,height=820')) throw new Error('Das Fenster wurde vom Browser blockiert.');
  },
  windowPayload: async () => {
    const token = new URLSearchParams(location.hash.slice(1)).get('compose'); if (!token) return null;
    const raw = sessionStorage.getItem(windowKey + token) || localStorage.getItem(windowKey + token); if (!raw) return null;
    sessionStorage.setItem(windowKey + token, raw); localStorage.removeItem(windowKey + token);
    return JSON.parse(raw);
  },
  onState: callback => {
    const listener = (event: StorageEvent) => { if (event.key !== key || !event.newValue) return; try { const data = JSON.parse(event.newValue); if (data.mode === 'demo') { demo = normalize(data); callback(structuredClone(demo)); } } catch {} };
    window.addEventListener('storage', listener); return () => window.removeEventListener('storage', listener);
  },
  manage: async command => {
    if (['account','export','import','print','meeting','auto-reply','check-updates','open-release','default-mail','open-link','search'].includes(command.kind)) return nativeRequired();
    if (command.kind === 'sync-all') { for (const rule of demo.rules || []) if (rule.enabled) for (const mail of demo.mails.filter(m => m.folder === 'inbox')) if ((!rule.from || mail.address.toLowerCase().includes(rule.from.toLowerCase())) && (!rule.subject || mail.subject.toLowerCase().includes(rule.subject.toLowerCase()))) { mail.folder = rule.target; if (rule.markRead) mail.read = true; } }
    if (command.kind === 'outbox' && command.operation === 'send') {
      const queued = demo.outbox!.find(m => m.id === command.id); if (!queued) throw new Error('Diese Nachricht ist nicht vorhanden.');
      await browser.send(queued.message); demo.outbox = demo.outbox!.filter(m => m.id !== command.id);
    } else localCommand(demo, command, () => crypto.randomUUID());
    return save();
  }
};
export const api = window.postblick || browser;
