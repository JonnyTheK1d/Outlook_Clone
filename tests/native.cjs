const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { _electron } = require('playwright');
test('native desktop: isolated bridge, validated IPC, local persistence and sandbox settings', { timeout: 120000 }, async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'postblick-native-'));
  const args = ['.', '--disable-gpu', '--user-data-dir=' + profile];
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
    const organized = await page.evaluate(async () => {
      await window.postblick.manage({kind:'folder',operation:'create',name:'Native project'});
      await window.postblick.manage({kind:'queue',message:{to:'queued@example.com',cc:'',bcc:'hidden@example.com',subject:'Native queue',body:'Persist after restart',attachments:[],scheduledAt:'2099-01-01T10:00:00Z'}});
      await window.postblick.manage({kind:'autosave',message:{to:'',cc:'',subject:'Recovery',body:'Native recovery',attachments:[]}});
      return window.postblick.state();
    });
    assert.ok(organized.folders.some(f=>f.name==='Native project'));
    assert.equal(organized.outbox.length,1);
    assert.equal(organized.workingDraft.body,'Native recovery');
    assert.equal(await page.evaluate(async()=>{try{await window.postblick.manage({kind:'import',format:'eml',path:'/secret'});return false;}catch{return true;}}),true);
    const encryption = await app.evaluate(({safeStorage}) => {
      if(!safeStorage.isEncryptionAvailable())return {available:false};
      const encrypted=safeStorage.encryptString('postblick-storage-roundtrip');
      return {available:true, matches:safeStorage.decryptString(encrypted)==='postblick-storage-roundtrip', ciphertext:encrypted.toString('base64')};
    });
    if(process.platform==='win32')assert.equal(encryption.available,true);
    if(encryption.available){assert.equal(encryption.matches,true);assert.ok(!encryption.ciphertext.includes('postblick-storage-roundtrip'));}
    const caps = await page.evaluate(() => window.postblick.capabilities());
    assert.equal(caps.desktop, true);
    if (!caps.secureStorage) assert.equal(await page.evaluate(async () => { try { await window.postblick.connectMicrosoft('12345678-1234-1234-1234-123456789abc'); return false; } catch { return true; } }), true);
    await app.close(); app = null;
    app = await _electron.launch(options);
    const restarted = await app.firstWindow();
    await restarted.getByRole('heading', { name: 'Posteingang', exact: true }).waitFor();
    const restored = await restarted.evaluate(()=>window.postblick.state());
    assert.equal(restored.outbox[0].message.bcc,'hidden@example.com');
    assert.equal(restored.workingDraft.body,'Native recovery');
    assert.ok(restored.folders.some(f=>f.name==='Native project'));
    assert.ok((await restarted.evaluate(() => window.postblick.state())).tasks.some(t => t.title === 'Native test task'));
  } finally { if (app) await app.close(); await rm(profile, { recursive: true, force: true }); }
});
test('native desktop: pop-out read and compose windows share the validated bridge', { timeout: 120000 }, async () => {
  const profile = await mkdtemp(path.join(tmpdir(), 'postblick-windows-'));
  const args = ['.', '--disable-gpu', '--user-data-dir=' + profile];
  if (process.env.POSTBLICK_TEST_DISABLE_SANDBOX === '1') args.push('--no-sandbox');
  let app;
  try {
    app = await _electron.launch({ args, env: { ...process.env, XDG_CONFIG_HOME: profile, XDG_CACHE_HOME: '/workspace/.cache' } });
    const page = await app.firstWindow();
    await page.getByRole('heading', { name: 'Posteingang', exact: true }).waitFor();
    // Ctrl+R must reply, not reload the renderer through the default Electron menu.
    await page.locator('.message-item').first().click();
    await page.keyboard.press('Control+r');
    await page.getByRole('dialog', { name: 'Neue Nachricht' }).waitFor();
    page.once('dialog', dialog => dialog.accept()); await page.keyboard.press('Escape');
    const [reader] = await Promise.all([app.waitForEvent('window'), page.locator('.message-item').filter({ hasText: 'Design-Review' }).dblclick()]);
    await reader.getByRole('heading', { name: 'Design-Review · Donnerstag' }).waitFor();
    const readerPreferences = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(w => w.webContents.getLastWebPreferences()).map(p => [p.contextIsolation, p.nodeIntegration, p.sandbox]));
    assert.deepEqual(readerPreferences, [[true, false, true], [true, false, true]]);
    assert.equal(await reader.evaluate(() => typeof require), 'undefined');
    // A change in the pop-out reaches the main window without a reload.
    await reader.getByRole('button', { name: 'Flagge entfernen', exact: true }).first().click();
    await page.locator('.message-item').filter({ hasText: 'Design-Review' }).locator('.message-indicators svg').waitFor({ state: 'detached' });
    assert.equal(await reader.evaluate(async () => { try { await window.postblick.openWindow({ kind: 'mail', id: 'x', url: 'https://example.invalid' }); return false; } catch { return true; } }), true);
    const [composer] = await Promise.all([app.waitForEvent('window'), reader.getByRole('button', { name: 'Weiterleiten', exact: true }).first().click()]);
    await composer.getByRole('textbox', { name: 'Betreff', exact: true }).waitFor();
    assert.equal(await composer.getByRole('textbox', { name: 'Betreff', exact: true }).inputValue(), 'WG: Design-Review · Donnerstag');
    assert.equal(await page.evaluate(() => window.postblick.windowPayload()), null);
    await composer.getByRole('combobox', { name: 'Empfänger', exact: true }).fill('team@example.com');
    await composer.getByRole('button', { name: 'Lokal senden', exact: true }).click();
    await composer.waitForEvent('close').catch(() => {});
    const state = await page.evaluate(() => window.postblick.state());
    assert.ok(state.mails.some(m => m.folder === 'sent' && m.subject === 'WG: Design-Review · Donnerstag'));
    // Escape closes the read window, as in Outlook.
    await Promise.all([reader.waitForEvent('close'), reader.keyboard.press('Escape').catch(() => {})]);
    // Dropped files arrive as bytes, are validated and travel with a sent message.
    const dropped = await page.evaluate(async () => {
      const attachment = await window.postblick.attachData('bericht.txt', new TextEncoder().encode('Inhalt'));
      const rejected = await window.postblick.attachData('x', '/etc/passwd').then(() => false, () => true);
      const sent = await window.postblick.send({ to: 'team@example.com', cc: '', subject: 'Mit Anhang', body: 'Siehe Anhang', attachments: [attachment] });
      return { attachment, rejected, names: sent.mails.find(m => m.subject === 'Mit Anhang').attachments.map(a => a.name) };
    });
    assert.equal(dropped.attachment.size, 6); assert.equal(dropped.rejected, true); assert.deepEqual(dropped.names, ['bericht.txt']);
    // A move can be undone through the native bridge.
    const undone = await page.evaluate(async () => {
      await window.postblick.manage({ kind: 'batch', ids: ['demo-3'], action: 'move', folder: 'archive' });
      const state = await window.postblick.manage({ kind: 'undo' });
      return state.mails.find(m => m.id === 'demo-3').folder;
    });
    assert.equal(undone, 'inbox');
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
  } finally { if (app) await app.close(); await rm(profile, { recursive: true, force: true }); }
});
