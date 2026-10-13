import { createServer } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { shell } from 'electron';
import type { Credentials } from './store';
const authority = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const scope = 'openid profile offline_access User.Read Mail.ReadWrite Mail.Send Calendars.ReadWrite Contacts.ReadWrite';
async function tokens(params: URLSearchParams, clientId: string): Promise<Extract<Credentials, { type: 'microsoft' }>> {
  const response = await fetch(authority + '/token', { method: 'POST', body: params, signal: AbortSignal.timeout(30000), redirect: 'error' });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok || typeof body.access_token !== 'string' || typeof body.refresh_token !== 'string') throw new Error('Microsoft-Anmeldung fehlgeschlagen. Prüfe App-Registrierung, Kontotyp und Berechtigungen.');
  return { type: 'microsoft', clientId, accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt: Date.now() + Number(body.expires_in) * 1000 };
}
export async function refresh(credentials: Extract<Credentials, { type: 'microsoft' }>) {
  return tokens(new URLSearchParams({ client_id: credentials.clientId, grant_type: 'refresh_token', refresh_token: credentials.refreshToken, scope }), credentials.clientId);
}
export async function authorize(clientId: string): Promise<Extract<Credentials, { type: 'microsoft' }>> {
  const verifier = randomBytes(48).toString('base64url');
  const state = randomBytes(32).toString('base64url');
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = (server.address() as { port: number }).port;
  const redirect = `http://localhost:${port}/callback`;
  let timer: NodeJS.Timeout | undefined;
  const codePromise = new Promise<string>((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Die Anmeldung wurde nach drei Minuten abgebrochen.')), 180000);
    server.on('request', (request, response) => {
      const url = new URL(request.url ?? '/', redirect);
      const supplied = url.searchParams.get('state') ?? '';
      if (url.pathname !== '/callback' || request.method !== 'GET' || Buffer.byteLength(supplied) !== Buffer.byteLength(state) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(state))) { response.writeHead(400); response.end('Invalid callback'); return; }
      response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      const code = url.searchParams.get('code');
      if (!code) { response.end('Anmeldung nicht abgeschlossen. Du kannst dieses Fenster schließen.'); reject(new Error('Microsoft-Anmeldung wurde abgebrochen oder verweigert.')); return; }
      response.end('Anmeldung empfangen. Du kannst dieses Fenster schließen und zu Postblick zurückkehren.');
      resolve(code);
    });
  });
  const url = authority + '/authorize?' + new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirect, scope, state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', prompt: 'select_account' });
  try {
    // Browser failures must not leave a pending rejected callback promise.
    await shell.openExternal(url).catch(() => { throw new Error('Der Systembrowser konnte nicht geöffnet werden.'); });
    const code = await codePromise;
    return await tokens(new URLSearchParams({ client_id: clientId, grant_type: 'authorization_code', code, redirect_uri: redirect, code_verifier: verifier, scope }), clientId);
  } finally { if (timer) clearTimeout(timer); server.closeAllConnections(); server.close(); }
}
