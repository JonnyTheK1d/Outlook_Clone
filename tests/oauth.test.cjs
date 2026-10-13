const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const Module = require('node:module');
const originalLoad = Module._load;
const nativeFetch = global.fetch;
let challenge;
const shell = { openExternal: async address => {
  const url = new URL(address);
  assert.equal(url.origin, 'https://login.microsoftonline.com');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(url.searchParams.get('scope').includes('offline_access'));
  challenge = url.searchParams.get('code_challenge');
  const callback = new URL(url.searchParams.get('redirect_uri'));
  callback.hostname = '127.0.0.1';
  callback.searchParams.set('state', 'wrong-state');
  callback.searchParams.set('code', 'test-code');
  const rejected = await nativeFetch(callback);
  assert.equal(rejected.status, 400); await rejected.text();
  callback.searchParams.set('state', url.searchParams.get('state'));
  const accepted = await nativeFetch(callback);
  assert.equal(accepted.status, 200); await accepted.text();
} };
Module._load = function(id, ...args) { if (id === 'electron') return { shell }; return originalLoad.call(this, id, ...args); };
const { authorize } = require('../dist-electron/electron/oauth');
Module._load = originalLoad;
test('OAuth loopback rejects invalid state and binds token exchange to the PKCE challenge', async () => {
  global.fetch = async (address, options) => {
    assert.equal(address, 'https://login.microsoftonline.com/common/oauth2/v2.0/token');
    assert.equal(options.redirect, 'error');
    assert.equal(options.body.get('code'), 'test-code');
    assert.equal(createHash('sha256').update(options.body.get('code_verifier')).digest('base64url'), challenge);
    return Response.json({ access_token: 'test-access-token', refresh_token: 'test-refresh-token', expires_in: 3600 });
  };
  try {
    const credentials = await authorize('12345678-1234-1234-1234-123456789abc');
    assert.equal(credentials.type, 'microsoft');
    assert.ok(credentials.expiresAt > Date.now());
  } finally { global.fetch = nativeFetch; }
});
