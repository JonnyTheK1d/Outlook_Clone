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
