const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { mkdtemp, readFile, readdir, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const original = Module._load;
let available = true;
// Controlled surrogate only; actual DPAPI security requires Windows validation.
Module._load = function(id, ...args) { if (id === 'electron') return { safeStorage: { isEncryptionAvailable: () => available, getSelectedStorageBackend: () => 'gnome_libsecret', encryptString: value => Buffer.from('test-envelope:' + value), decryptString: value => value.toString().slice('test-envelope:'.length) } }; return original.call(this, id, ...args); };
const { Store } = require('../dist-electron/electron/store');
Module._load = original;
test('account state and credentials are committed in one protected envelope', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'postblick-store-'));
  try {
    const store = new Store(dir);
    store.state.mode = 'imap'; store.state.email = 'test@example.com';
    store.credentials = { type: 'imap', email: 'test@example.com', password: 'private-test-password', imapHost: 'imap.example.com', imapPort: 993, smtpHost: 'smtp.example.com', smtpPort: 465 };
    await store.save();
    assert.deepEqual(await readdir(dir), ['mailbox-v2.json']);
    const disk = await readFile(path.join(dir, 'mailbox-v2.json'), 'utf8');
    assert.equal(JSON.parse(disk).encrypted, true); assert.equal(disk.includes('private-test-password'), false);
    const reloaded = new Store(dir); await reloaded.load();
    assert.equal(reloaded.credentials.password, 'private-test-password'); assert.equal(reloaded.state.mode, 'imap');
    available = false;
    await assert.rejects(new Store(dir).load(), /Schlüsselspeicher/);
  } finally { available = true; await rm(dir, { recursive: true, force: true }); }
});
test('demo data can never be persisted together with a real credential', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'postblick-store-'));
  try {
    const store = new Store(dir);
    store.credentials = { type: 'microsoft', accessToken: 'private-token' };
    await assert.rejects(store.save(), /Kontozustand/);
    assert.deepEqual(await readdir(dir), []);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
