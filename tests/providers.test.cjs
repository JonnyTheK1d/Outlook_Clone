const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
// Electron is not running in these isolated protocol tests. No credentials are stored.
Module._load = function(id, ...args) { if (id === 'electron') return { shell: {} }; return originalLoad.call(this, id, ...args); };
const { MicrosoftProvider, ImapProvider } = require('../dist-electron/electron/providers');
Module._load = originalLoad;
const originalFetch = global.fetch;
after(() => { global.fetch = originalFetch; });
const credentials = { type: 'microsoft', clientId: '12345678-1234-1234-1234-123456789abc', accessToken: 'test-token', refreshToken: 'test-refresh', expiresAt: Date.now() + 3600000 };
test('Graph mail mapping requests HTML bodies and preserves recipients and attachment metadata', async () => {
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.includes('/attachments')) return Response.json({ value: [{ '@odata.type': '#microsoft.graph.fileAttachment', id: 'att', name: 'note.txt', size: 4, isInline: false }] });
    return Response.json({ value: [{ id: 'id/with slash', from: { emailAddress: { name: 'Test', address: 'from@example.com' } }, toRecipients: [{ emailAddress: { address: 'to@example.com' } }], ccRecipients: [{ emailAddress: { address: 'cc@example.com' } }], subject: 'Hello', body: { content: 'Message' }, receivedDateTime: '2026-10-13T10:00:00Z', isRead: false, flag: { flagStatus: 'flagged' }, hasAttachments: true }] });
  };
  const provider = new MicrosoftProvider(credentials, async () => {});
  const [mail] = await provider.list('inbox');
  assert.equal(mail.cc, 'cc@example.com'); assert.equal(mail.attachments[0].name, 'note.txt'); assert.equal(mail.flagged, true);
  assert.ok(requests.every(r => r.options.headers.Prefer.includes('body-content-type="html"')));
  assert.ok(requests[1].url.includes('id%2Fwith%20slash'));
  assert.ok(requests.every(r => r.options.redirect === 'error'));
});
test('Graph send uses the authenticated mailbox and selected in-memory attachment bytes', async () => {
  let body; let destination;
  global.fetch = async (url, options) => { destination = url; body = JSON.parse(options.body); return new Response(null, { status: 202 }); };
  const provider = new MicrosoftProvider(credentials, async () => {});
  await provider.send({ to: 'one@example.com; two@example.com', cc: '', subject: 'Test', body: 'Hi', attachments: [] }, [{ name: 'note.txt', content: Buffer.from('hello') }]);
  assert.equal(destination, 'https://graph.microsoft.com/v1.0/me/sendMail');
  assert.equal(body.message.toRecipients.length, 2);
  assert.equal(body.message.attachments[0].contentBytes, Buffer.from('hello').toString('base64'));
  assert.equal(body.saveToSentItems, true);
});
test('Graph failures do not leak response bodies or tokens', async () => {
  global.fetch = async () => Response.json({ error: { message: 'secret-test-token' } }, { status: 401 });
  const provider = new MicrosoftProvider(credentials, async () => {});
  await assert.rejects(provider.list('inbox'), error => error.message.includes('abgelaufen') && !error.message.includes('secret-test-token'));
});
test('IMAP rejects stale UIDVALIDITY before mutating a message', async () => {
  const provider = new ImapProvider({ type: 'imap', email: 'a@example.com', password: 'test', imapHost: 'localhost', imapPort: 993, smtpHost: 'localhost', smtpPort: 465 });
  let mutations = 0; let released = false;
  const fakeClient = { mailbox: { uidValidity: 2n }, getMailboxLock: async () => ({ release: () => { released = true; } }), messageFlagsAdd: async () => { mutations++; } };
  provider.session = async callback => callback(fakeClient, { inbox: 'INBOX' });
  await assert.rejects(provider.action({ id: 'inbox:1:12', folder: 'inbox' }, { id: 'inbox:1:12', kind: 'read', value: true }), /veraltet/);
  assert.equal(mutations, 0); assert.equal(released, true);
  await provider.action({ id: 'inbox:2:12', folder: 'inbox' }, { id: 'inbox:2:12', kind: 'read', value: true });
  assert.equal(mutations, 1);
});
test('SMTP acceptance remains successful if subsequent draft cleanup fails', async () => {
  const provider = new ImapProvider({ type: 'imap', email: 'a@example.com', password: 'test', imapHost: 'localhost', imapPort: 993, smtpHost: 'localhost', smtpPort: 465 });
  let sent = 0;
  provider.draftFiles = async () => [{ name: 'existing.txt', content: Buffer.from('old') }];
  provider.transport = () => ({ sendMail: async mail => { sent++; assert.equal(mail.attachments.length, 2); assert.equal(mail.disableFileAccess, true); assert.equal(mail.disableUrlAccess, true); } });
  provider.action = async () => { throw new Error('Cleanup failed'); };
  provider.session = async () => { throw new Error('No append connection'); };
  await provider.send({ to: 'b@example.com', cc: '', subject: 'Test', body: 'Hi', attachments: [], draftId: 'drafts:1:2' }, [{ name: 'new.txt', content: Buffer.from('new') }]);
  assert.equal(sent, 1);
});
