const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDemo } = require('../dist-electron/shared/demo');
const { applyLocalAction, localOutgoing } = require('../dist-electron/electron/local');
const { imapSchema, mailActionSchema, eventSchema, outgoingSchema, recipients } = require('../dist-electron/electron/validation');
test('draft sending removes the draft and creates a sent message without altering the inbox', () => {
  const state = createDemo(); const inbox = state.mails.filter(m => m.folder === 'inbox').length;
  const message = { to: 'person@example.com', cc: '', subject: 'Test', body: 'Hello', attachments: [] };
  localOutgoing(state, message, true);
  const draft = state.mails.find(m => m.folder === 'drafts');
  localOutgoing(state, { ...message, draftId: draft.id }, false);
  assert.equal(state.mails.filter(m => m.folder === 'drafts').length, 0);
  assert.equal(state.mails.filter(m => m.subject === 'Test' && m.folder === 'sent').length, 1);
  assert.equal(state.mails.filter(m => m.folder === 'inbox').length, inbox);
});
test('message movement preserves data and permanently deleting removes only selected message', () => {
  const state = createDemo(); const id = state.mails[0].id; const body = state.mails[0].body;
  applyLocalAction(state, { id, kind: 'move', folder: 'trash' });
  assert.equal(state.mails.find(m => m.id === id).body, body);
  applyLocalAction(state, { id, kind: 'delete' });
  assert.equal(state.mails.some(m => m.id === id), false);
  assert.throws(() => applyLocalAction(state, { id, kind: 'delete' }));
});
test('IPC validation rejects insecure ports, extra fields and arbitrary paths', () => {
  const good = { email: 'a@example.com', password: 'secret', imapHost: 'imap.example.com', imapPort: 993, smtpHost: 'smtp.example.com', smtpPort: 587 };
  assert.ok(imapSchema.safeParse(good).success);
  assert.equal(imapSchema.safeParse({ ...good, imapPort: 143 }).success, false);
  assert.equal(imapSchema.safeParse({ ...good, smtpPort: 25 }).success, false);
  assert.equal(imapSchema.safeParse({ ...good, imapHost: 'https://evil/path' }).success, false);
  assert.equal(mailActionSchema.safeParse({ id: 'x', kind: 'move', folder: 'arbitrary' }).success, false);
  assert.equal(outgoingSchema.safeParse({ to: 'a@b.com', cc: '', subject: '', body: '', attachments: [], filePath: '/secret' }).success, false);
});
test('recipients reject SMTP header injection and validate every address', () => {
  assert.deepEqual(recipients('a@example.com; b@example.com'), ['a@example.com', 'b@example.com']);
  assert.throws(() => recipients('a@example.com\r\nBcc: victim@example.com'));
  assert.throws(() => recipients('valid@example.com,invalid'));
  assert.deepEqual(recipients(''), []);
});
test('calendar validation rejects impossible intervals', () => {
  const event = { title: 'Test', start: '2026-10-13T10:00', end: '2026-10-13T09:00', location: '', notes: '' };
  assert.equal(eventSchema.safeParse(event).success, false);
  assert.ok(eventSchema.safeParse({ ...event, end: '2026-10-13T11:00' }).success);
});
