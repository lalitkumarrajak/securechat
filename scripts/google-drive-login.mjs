// Connects a Google account's Drive to Sanga's server, once: signs in with Google in your browser and
// prints the GDRIVE_REFRESH_TOKEN to put in the server's environment (e.g. Render → Environment), next
// to GDRIVE_CLIENT_ID and GDRIVE_CLIENT_SECRET. It then checks it works by finding (or making) the
// "Sanga Drive" folder. Only the drive.file permission is asked for: Sanga sees just its own files.
//
//   npm run google-drive-login
//   (it asks for the client id and secret, or reads GDRIVE_CLIENT_ID / GDRIVE_CLIENT_SECRET)
import crypto from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';
import readline from 'node:readline/promises';
import { checkDrive } from './google-drive-check.mjs';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q, v) => v?.trim() || (await rl.question(q)).trim();

const clientId = await ask('OAuth client ID: ', process.env.GDRIVE_CLIENT_ID);
const clientSecret = await ask('OAuth client secret: ', process.env.GDRIVE_CLIENT_SECRET);
rl.close();
if (!clientId || !clientSecret) { console.error('Both the client ID and the secret are needed.'); process.exit(1); }

const b64url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const verifier = b64url(crypto.randomBytes(48));
const state = b64url(crypto.randomBytes(16));

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname !== '/') { res.writeHead(404); return res.end(); }
    const fail = u.searchParams.get('error');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fail ? `<p>Google said: ${fail.replace(/[<>&]/g, '')}. You can close this tab.</p>` : '<p>Done. You can close this tab and go back to the terminal.</p>');
    server.close();
    if (fail) reject(new Error(fail));
    else if (u.searchParams.get('state') !== state) reject(new Error('the sign-in answer didn’t match; try again'));
    else resolve({ code: u.searchParams.get('code'), redirect: `http://127.0.0.1:${server.address()?.port ?? port}` });
  });
  let port;
  server.listen(0, '127.0.0.1', () => {
    port = server.address().port;
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: clientId, redirect_uri: `http://127.0.0.1:${port}`, response_type: 'code', scope: SCOPE,
      access_type: 'offline', prompt: 'consent', state,
      code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256',
    });
    console.log('\nOpen this link, sign in with the Google account whose Drive Sanga should use, and allow access:\n');
    console.log(url + '\n');
    try { spawn(process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open', [url], { stdio: 'ignore', detached: true }).on('error', () => {}).unref(); } catch { /* print only */ }
  });
});

const res = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code: code.code, code_verifier: verifier, grant_type: 'authorization_code', redirect_uri: code.redirect }),
});
const data = await res.json();
if (!res.ok || !data.refresh_token) {
  console.error('Google didn’t give a refresh token:', data.error_description || data.error || res.status);
  process.exit(1);
}

console.log('\nSigned in. Add these in Render → your service → Environment (keep them secret, don’t paste them in chats):\n');
console.log(`GDRIVE_CLIENT_ID=${clientId}`);
console.log('GDRIVE_CLIENT_SECRET=(the secret you entered)');
console.log(`GDRIVE_REFRESH_TOKEN=${data.refresh_token}\n`);

// Check it works, with the server's own code: the folder, then a test file up, back and deleted.
console.log('Checking it works the way Sanga’s server uses it:\n');
try {
  await checkDrive({ GDRIVE_CLIENT_ID: clientId, GDRIVE_CLIENT_SECRET: clientSecret, GDRIVE_REFRESH_TOKEN: data.refresh_token });
  console.log('\nAll good. Put the three values above in Render and save.\n');
} catch (e) {
  const off = /has not been used|is disabled|accessNotConfigured|SERVICE_DISABLED/i.test(e.message);
  console.error(off
    ? 'The Google Drive API is off in this Google Cloud project. Turn it on (APIs & Services → Library → Google Drive API → Enable),\nwait 2–5 minutes, and run this again.'
    : 'That step failed with the reason above. Paste it to Claude (it contains no secrets).');
  process.exit(1);
}
