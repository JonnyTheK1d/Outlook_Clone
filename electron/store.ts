import { safeStorage } from 'electron';
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { normalize } from '../shared/features';
import type { State, ImapSettings } from '../shared/types';
import { createDemo } from '../shared/demo';
export type Credentials = { type: 'microsoft'; clientId: string; accessToken: string; refreshToken: string; expiresAt: number } | ({ type: 'imap' } & ImapSettings);
export function secureAvailable(): boolean {
  return safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text');
}
export class Store {
  state: State = createDemo();
  credentials: Credentials | null = null;
  accounts: Record<string, { state: State; credentials: Credentials | null }> = {};
  queuedFiles: Record<string, { name: string; content: string; id?: string }[]> = {};
  constructor(private directory: string) {}
  private async read(name: string): Promise<string | null> {
    try { return await readFile(path.join(this.directory, name), 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  }
  private async atomic(name: string, content: string) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const target = path.join(this.directory, name);
    await writeFile(target + '.tmp', content, { mode: 0o600 });
    await rename(target + '.tmp', target);
  }
  async load() {
    const saved = await this.read('mailbox-v2.json') || await this.read('mailbox.json');
    if (saved) {
      const envelope = JSON.parse(saved);
      if (envelope.encrypted && !secureAvailable()) throw new Error('Der sichere Betriebssystem-Schlüsselspeicher ist nicht verfügbar. Bitte entsperre ihn und starte Postblick erneut.');
      const data = envelope.encrypted ? safeStorage.decryptString(Buffer.from(envelope.data, 'base64')) : envelope.data;
      const payload = JSON.parse(data);
      // Compatibility for early local demo data; real accounts always use one atomic envelope.
      this.state = normalize(payload.state || payload);
      this.credentials = payload.credentials || null;
      if (this.state.mode === 'demo' ? this.credentials !== null : !envelope.encrypted || !this.credentials || this.credentials.type !== this.state.mode) throw new Error('Ungültiger oder ungeschützter Kontospeicher.');
      this.accounts = payload.accounts || {};
      this.queuedFiles = payload.queuedFiles || {};
      for (const account of Object.values(this.accounts)) {
        normalize(account.state);
        if (account.state.mode === 'demo' ? account.credentials !== null : !envelope.encrypted || !account.credentials || account.credentials.type !== account.state.mode) throw new Error('Ungültiger oder ungeschützter Kontospeicher.');
      }
    }
    normalize(this.state);
    this.state.accountId ||= randomUUID();
    this.accounts[this.state.accountId] = { state: this.state, credentials: this.credentials };
  }
  view(): State {
    const accounts = { ...this.accounts, [this.state.accountId!]: { state: this.state, credentials: this.credentials } };
    return structuredClone({ ...normalize(this.state), accounts: Object.entries(accounts).map(([id, a]) => ({ id, email: a.state.email, name: a.state.name, mode: a.state.mode })), unifiedMails: Object.entries(accounts).flatMap(([id,a]) => a.state.mode === 'demo' && Object.keys(accounts).length > 1 ? [] : a.state.mails.filter(m => m.folder === 'inbox').map(m => ({ ...m, accountId: id }))) });
  }
  activate(id: string) {
    const account = this.accounts[id];
    if (!account) throw new Error('Dieses Konto ist nicht vorhanden.');
    this.accounts[this.state.accountId!] = { state: this.state, credentials: this.credentials };
    this.state = account.state; this.credentials = account.credentials;
  }
  async persistCredentials() { await this.save(); }
  async save() {
    if (this.state.mode !== 'demo' ? !this.credentials || this.credentials.type !== this.state.mode : this.credentials !== null) throw new Error('Ungültiger Kontozustand.');
    this.state.accountId ||= randomUUID();
    const accounts = { ...this.accounts, [this.state.accountId]: { state: this.state, credentials: this.credentials } };
    const encrypted = Object.values(accounts).some(a => a.credentials !== null);
    const validFileKeys = new Set(Object.entries(accounts).flatMap(([id,a]) => [...(a.state.outbox || []).map(m=>m.id), ...(a.state.workingDraft ? ['recovery:' + id] : [])]));
    const queuedFiles = Object.fromEntries(Object.entries(this.queuedFiles).filter(([id])=>validFileKeys.has(id)));
    const data = JSON.stringify({ version: 2, state: this.state, credentials: this.credentials, accounts, queuedFiles });
    if (encrypted && !secureAvailable()) throw new Error('Der sichere Schlüsselspeicher ist nicht verfügbar.');
    await this.atomic('mailbox-v2.json', JSON.stringify({ encrypted, data: encrypted ? safeStorage.encryptString(data).toString('base64') : data }));
    this.accounts = accounts;
    this.queuedFiles = queuedFiles;
    // Remove legacy credentials only after a durable v2 commit. Older releases
    // cannot overwrite the new multi-account file when accidentally restarted.
    await unlink(path.join(this.directory,'mailbox.json')).catch(()=>{});
  }
}
