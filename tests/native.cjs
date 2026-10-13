const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { _electron } = require('playwright');
test('native desktop: isolated bridge, validated IPC, local persistence and sandbox settings', { timeout: 60000 }, async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'postblick-native-'));
  const args = ['.', '--disable-gpu'];
  if (process.env.POSTBLICK_TEST_DISABLE_SANDBOX === '1') args.push('--no-sandbox');
  const options = { args, env: { ...process.env, XDG_CONFIG_HOME: profile, XDG_CACHE_HOME: '/workspace/.cache' } };
  let app;
  try {
    app = await _electron.launch(options);
    const page = await app.firstWindow();
    await page.getByRole('heading', { name: 'Posteingang', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => typeof require), 'undefined');
    assert.equal(await page.evaluate(() => typeof window.postblick.invoke), 'undefined');
    const preferences = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
    assert.equal(preferences.contextIsolation, true); assert.equal(preferences.nodeIntegration, false); assert.equal(preferences.sandbox, true); assert.equal(preferences.webSecurity, true);
    const invalid = await page.evaluate(async () => { try { await window.postblick.mailAction({ id: 'demo-1', kind: 'move', folder: '/secret' }); return false; } catch { return true; } });
    assert.equal(invalid, true);
    const state = await page.evaluate(() => window.postblick.saveTask({ title: 'Native test task', due: '', done: false }));
    assert.ok(state.tasks.some(t => t.title === 'Native test task'));
    const draft = await page.evaluate(() => window.postblick.saveDraft({ to: '', cc: '', subject: 'Draft without recipient', body: 'Work in progress', attachments: [] }));
    assert.ok(draft.mails.some(m => m.folder === 'drafts' && m.to === '' && m.subject === 'Draft without recipient'));
    assert.equal(await page.evaluate(async () => { try { await window.postblick.send({ to: '', cc: '', subject: 'Invalid', body: '', attachments: [] }); return false; } catch { return true; } }), true);
    const blocked = await page.evaluate(async () => { try { await fetch('https://example.invalid/tracking'); return false; } catch { return true; } });
    assert.equal(blocked, true);
    const caps = await page.evaluate(() => window.postblick.capabilities());
    assert.equal(caps.desktop, true);
    if (!caps.secureStorage) assert.equal(await page.evaluate(async () => { try { await window.postblick.connectMicrosoft('12345678-1234-1234-1234-123456789abc'); return false; } catch { return true; } }), true);
    await app.close(); app = null;
    app = await _electron.launch(options);
    const restarted = await app.firstWindow();
    await restarted.getByRole('heading', { name: 'Posteingang', exact: true }).waitFor();
    assert.ok((await restarted.evaluate(() => window.postblick.state())).tasks.some(t => t.title === 'Native test task'));
  } finally { if (app) await app.close(); await rm(profile, { recursive: true, force: true }); }
});
