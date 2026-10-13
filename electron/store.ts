import { safeStorage } from 'electron';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type { State, ImapSettings } from '../shared/types';
import { createDemo } from '../shared/demo';
export type Credentials = { type: 'microsoft'; clientId: string; accessToken: string; refreshToken: string; expiresAt: number } | ({ type: 'imap' } & ImapSettings);
export function secureAvailable(): boolean {
  return safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text');
}
export class Store {
  state: State = createDemo();
  credentials: Credentials | null = null;
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
    const saved = await this.read('mailbox.json');
    if (saved) {
      const envelope = JSON.parse(saved);
      if (envelope.encrypted && !secureAvailable()) throw new Error('Der sichere Betriebssystem-Schlüsselspeicher ist nicht verfügbar. Bitte entsperre ihn und starte Postblick erneut.');
      const data = envelope.encrypted ? safeStorage.decryptString(Buffer.from(envelope.data, 'base64')) : envelope.data;
      const payload = JSON.parse(data);
      // Compatibility for early local demo data; real accounts always use one atomic envelope.
      this.state = payload.state || payload;
      this.credentials = payload.credentials || null;
      if (this.state.mode === 'demo' ? this.credentials !== null : !envelope.encrypted || !this.credentials || this.credentials.type !== this.state.mode) throw new Error('Ungültiger oder ungeschützter Kontospeicher.');
    }
  }
  async persistCredentials() { await this.save(); }
  async save() {
    const encrypted = this.state.mode !== 'demo';
    if (encrypted ? !this.credentials || this.credentials.type !== this.state.mode : this.credentials !== null) throw new Error('Ungültiger Kontozustand.');
    const data = JSON.stringify({ state: this.state, credentials: this.credentials });
    if (encrypted && !secureAvailable()) throw new Error('Der sichere Schlüsselspeicher ist nicht verfügbar.');
    await this.atomic('mailbox.json', JSON.stringify({ encrypted, data: encrypted ? safeStorage.encryptString(data).toString('base64') : data }));
  }
}
