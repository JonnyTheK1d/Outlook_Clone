import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowLeft, ArrowRight, CheckCheck, ChevronDown, ChevronUp, CircleHelp, Flag, MailOpen, Printer, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import type { Attachment, Mail, Outgoing, State } from '../shared/types';
import { normalize, sortMails } from '../shared/features';
import { api } from './bridge';
import { EnhancedComposer } from './Features';
import { MailReader, type Run } from './MailReader';
import { draftMessage, folderName, newMessage, replyMessage, standardFolders, typingTarget, type ReplyKind } from './mail';

export type Route = { kind: 'main' } | { kind: 'mail'; id: string; accountId?: string } | { kind: 'compose' };
export function route(hash = location.hash): Route {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const id = params.get('mail');
  if (id) return { kind: 'mail', id, accountId: params.get('account') || undefined };
  if (params.has('compose')) return { kind: 'compose' };
  return { kind: 'main' };
}

// Pop-out windows load their own copy of the mailbox and follow changes from the other windows.
function useWindowState() {
  const [state, setState] = useState<State | null>(null);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  useEffect(() => { let active = true; api.state().then(data => { if (active) setState(normalize(data)); }).catch(error => setToast({ text: error.message, error: true })); return () => { active = false; }; }, []);
  useEffect(() => api.onState?.(data => setState(normalize(data))), []);
  useEffect(() => { document.documentElement.dataset.theme = state?.theme || 'light'; }, [state?.theme]);
  const run: Run = async (operation, success) => {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true);
    try { const data = await operation(); setState(normalize(data)); if (data.notice || success) setToast({ text: data.notice || success || '', error: false }); return true; }
    catch (error) { setToast({ text: error instanceof Error ? error.message : 'Die Aktion ist fehlgeschlagen.', error: true }); return false; }
    finally { busyRef.current = false; setBusy(false); }
  };
  const notify = (text: string, error = false) => setToast({ text, error });
  return { state, run, busy, toast, setToast, notify };
}
function Toast({ toast, close }: { toast: { text: string; error: boolean } | null; close: () => void }) {
  return toast && <div className={'toast ' + (toast.error ? 'error' : '')} role={toast.error ? 'alert' : 'status'}>{toast.error ? <CircleHelp size={20}/> : <CheckCheck size={20}/>}<span>{toast.text}</span><button className="icon-button" aria-label="Meldung schließen" onClick={close}><X size={17}/></button></div>;
}

export function MailWindow({ id: initial, accountId }: { id: string; accountId?: string }) {
  const { state, run, busy, toast, setToast, notify } = useWindowState();
  const [id, setId] = useState(initial);
  const [composing, setComposing] = useState<{ message: Outgoing; existing?: Attachment[] } | null>(null);
  const marked = useRef(new Set<string>());
  const otherAccount = !!(state && accountId && state.accountId && accountId !== state.accountId);
  const mail = otherAccount ? undefined : state?.mails.find(m => m.id === id);
  const siblings = useMemo(() => mail && state ? sortMails(state.mails.filter(m => m.folder === mail.folder), state.preferences?.sortBy, state.preferences?.sortDescending) : [], [state, mail?.folder]);
  const index = mail ? siblings.findIndex(m => m.id === mail.id) : -1;
  useEffect(() => { document.title = (mail?.subject || 'Nachricht') + ' – Postblick'; }, [mail?.subject]);
  // Opening a message marks it as read once, like Outlook; later "unread" choices are kept.
  useEffect(() => { if (!mail || marked.current.has(mail.id)) return; marked.current.add(mail.id); if (!mail.read) void run(() => api.mailAction({ id: mail.id, kind: 'read', value: true })); }, [mail?.id, mail?.read]);
  const go = (next?: Mail) => { if (!next) return; setComposing(null); setId(next.id); history.replaceState(null, '', '#mail=' + encodeURIComponent(next.id) + (accountId ? '&account=' + encodeURIComponent(accountId) : '')); };
  const compose = (kind: ReplyKind) => { if (!mail || !state) return; const message = replyMessage(mail, state, kind); if (api.openWindow) void api.openWindow({ kind: 'compose', message }).catch(error => notify(error.message, true)); else setComposing({ message }); };
  const editDraft = () => { if (!mail) return; const draft = draftMessage(mail); if (api.openWindow) void api.openWindow({ kind: 'compose', ...draft }).then(() => window.close()).catch(error => notify(error.message, true)); else setComposing(draft); };
  // After moving or deleting the open item Outlook returns to the folder: the window closes.
  const moveAndClose = async (operation: () => Promise<State>, success?: string) => { if (await run(operation, success)) window.close(); };
  const remove = () => { if (!mail) return; if (mail.folder === 'trash') { if (window.confirm('Nachricht endgültig löschen? Dieser Vorgang lässt sich nicht rückgängig machen.')) void moveAndClose(() => api.mailAction({ id: mail.id, kind: 'delete' })); } else void moveAndClose(() => api.mailAction({ id: mail.id, kind: 'move', folder: 'trash' })); };
  const keys = useRef<(event: KeyboardEvent) => void>(() => {});
  keys.current = event => {
    const ctrl = event.ctrlKey || event.metaKey, key = event.key.toLowerCase();
    if (composing) return;
    if (key === 'escape') { event.preventDefault(); window.close(); return; }
    if (!mail || typingTarget(event.target)) return;
    const action = (fn: () => void) => { event.preventDefault(); if (!busy) fn(); };
    if (ctrl && key === 'r') action(() => compose(event.shiftKey ? 'replyAll' : 'reply'));
    else if (ctrl && key === 'f') action(() => compose('forward'));
    else if (ctrl && (key === 'q' || key === 'u')) action(() => void run(() => api.mailAction({ id: mail.id, kind: 'read', value: key === 'q' })));
    else if (ctrl && key === 'p') action(() => void run(() => api.manage({ kind: 'print', id: mail.id })));
    else if (ctrl && (key === '.' || key === ',')) action(() => go(siblings[index + (key === '.' ? 1 : -1)]));
    else if (key === 'delete') action(remove);
    else if (key === 'insert') action(() => void run(() => api.mailAction({ id: mail.id, kind: 'flag', value: !mail.flagged })));
  };
  useEffect(() => { const listener = (event: KeyboardEvent) => keys.current(event); window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener); }, []);
  if (!state) return <div className="loading-screen"><MailOpen size={44}/><p>{toast?.text || 'Nachricht wird geöffnet …'}</p></div>;
  return <div className="popout-shell">
    <header className="popout-ribbon" aria-label="Nachricht">
      <div className="popout-title"><strong>{mail?.subject || 'Nachricht'}</strong><span>{mail ? folderName(state, mail.folder) + ' · ' + state.email : state.email}</span></div>
      {mail && !composing && <div className="ribbon-tools popout-tools">
        {mail.folder === 'drafts' ? <button disabled={busy} onClick={editDraft}>Entwurf bearbeiten</button> : <><button disabled={busy} onClick={() => compose('reply')}><ArrowLeft size={17}/>Antworten</button><button disabled={busy} onClick={() => compose('replyAll')}><Users size={17}/>Allen antworten</button><button disabled={busy} onClick={() => compose('forward')}><ArrowRight size={17}/>Weiterleiten</button></>}
        <span className="separator"/>
        <button disabled={busy} onClick={remove}><Trash2 size={17}/>Löschen</button>
        <button disabled={busy || mail.folder === 'archive'} onClick={() => moveAndClose(() => api.mailAction({ id: mail.id, kind: 'move', folder: 'archive' }))}><Archive size={17}/>Archivieren</button>
        <select aria-label="Verschieben nach" value="" disabled={busy} onChange={event => { const folder = event.target.value; if (folder) void moveAndClose(() => api.mailAction({ id: mail.id, kind: 'move', folder })); }}><option value="">Verschieben …</option>{[...standardFolders.map(f => ({ id: f.id, name: f.label })), ...(state.folders || [])].filter(f => f.id !== mail.folder && f.id !== 'custom:local-import').map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
        <button disabled={busy} onClick={() => moveAndClose(() => api.mailAction({ id: mail.id, kind: 'move', folder: mail.folder === 'junk' ? 'inbox' : 'junk' }))}><ShieldCheck size={17}/>{mail.folder === 'junk' ? 'Kein Junk' : 'Junk'}</button>
        <span className="separator"/>
        <button disabled={busy} onClick={() => run(() => api.mailAction({ id: mail.id, kind: 'read', value: !mail.read }))}><MailOpen size={17}/>{mail.read ? 'Ungelesen' : 'Gelesen'}</button>
        <button disabled={busy} onClick={() => run(() => api.mailAction({ id: mail.id, kind: 'flag', value: !mail.flagged }))}><Flag size={17}/>{mail.flagged ? 'Flagge entfernen' : 'Nachverfolgen'}</button>
        <select aria-label="Kategorisieren" value="" disabled={busy} onChange={event => { const value = event.target.value; if (value) void run(() => api.manage({ kind: 'metadata', ids: [mail.id], category: value === '__none__' ? '' : value })); }}><option value="">Kategorisieren …</option><option value="__none__">Keine Kategorie</option>{state.preferences?.categories.map(c => <option key={c}>{c}</option>)}</select>
        <button disabled={busy} onClick={() => run(() => api.manage({ kind: 'print', id: mail.id }))}><Printer size={17}/>Drucken</button>
        <div className="tool-spacer"/>
        <button className="icon-button" title="Vorheriges Element (Strg+,)" aria-label="Vorheriges Element" disabled={index <= 0} onClick={() => go(siblings[index - 1])}><ChevronUp size={18}/></button>
        <button className="icon-button" title="Nächstes Element (Strg+.)" aria-label="Nächstes Element" disabled={index < 0 || index >= siblings.length - 1} onClick={() => go(siblings[index + 1])}><ChevronDown size={18}/></button>
      </div>}
    </header>
    <main className="popout-content reading-pane">
      {composing ? <div className="reading-card"><EnhancedComposer message={composing.message} existing={composing.existing} state={state} run={run} busy={busy} close={() => setComposing(null)} dirty={message => setComposing(current => current && { ...current, message })}/></div>
        : otherAccount ? <div className="reading-empty"><h2>Anderes Konto aktiv</h2><p>Diese Nachricht gehört zu einem Konto, das im Hauptfenster gerade nicht ausgewählt ist.</p><button className="primary-button" disabled={busy} onClick={() => run(() => api.manage({ kind: 'account', id: accountId! }))}>Zu diesem Konto wechseln</button></div>
        : mail ? <MailReader mail={mail} state={state} run={run} busy={busy} notify={notify} compose={compose} editDraft={editDraft}/>
        : <div className="reading-empty"><h2>Nachricht nicht verfügbar</h2><p>Die Nachricht wurde verschoben oder gelöscht.</p><button className="secondary-button" onClick={() => window.close()}>Fenster schließen</button></div>}
    </main>
    <Toast toast={toast} close={() => setToast(null)}/>
  </div>;
}

export function ComposeWindow() {
  const { state, run, busy, toast, setToast } = useWindowState();
  const [draft, setDraft] = useState<{ message: Outgoing; existing?: Attachment[] } | null>(null);
  const changed = useRef(false);
  useEffect(() => {
    if (!state || draft) return;
    const fallback = { message: newMessage(state.preferences?.signature) };
    (api.windowPayload ? api.windowPayload() : Promise.resolve(null)).then(payload => setDraft(payload?.kind === 'compose' ? { message: payload.message, existing: payload.existing } : fallback)).catch(() => setDraft(fallback));
  }, [state, draft]);
  useEffect(() => { document.title = (draft?.message.subject || 'Neue Nachricht') + ' – Nachricht'; }, [draft?.message.subject]);
  useEffect(() => { const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); window.close(); } }; window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape); }, []);
  useEffect(() => { const guard = (event: BeforeUnloadEvent) => { if (changed.current) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard); }, []);
  if (!state || !draft) return <div className="loading-screen"><MailOpen size={44}/><p>{toast?.text || 'Nachricht wird vorbereitet …'}</p></div>;
  return <div className="popout-shell">
    <header className="popout-ribbon"><div className="popout-title"><strong>{draft.message.subject || 'Neue Nachricht'}</strong><span>{state.mode === 'demo' ? 'Demo · nur lokal' : state.email}</span></div></header>
    <main className="popout-content reading-pane"><div className="reading-card">
      <EnhancedComposer message={draft.message} existing={draft.existing} state={state} run={run} busy={busy} close={() => { changed.current = false; window.close(); }} dirty={message => { changed.current = true; setDraft(current => current && { ...current, message }); }}/>
    </div></main>
    <Toast toast={toast} close={() => setToast(null)}/>
  </div>;
}
