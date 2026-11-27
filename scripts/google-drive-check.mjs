// Checks that Sanga's server can use a Google Drive with the settings it will have: signs in, finds the
// folder, uploads a small test file, reads it back and deletes it, with the server's own code
// (server/gdrive.js). Prints each step and, if one fails, Google's reason. Never prints the secrets.
//
//   npm run google-drive-check
//   (it asks for the client id, secret and refresh token, or reads GDRIVE_CLIENT_ID,
//    GDRIVE_CLIENT_SECRET and GDRIVE_REFRESH_TOKEN, exactly as set on the server)
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { gdriveFromEnv } from '../server/gdrive.js';

export async function checkDrive(env, log = console.log) {
  const gd = gdriveFromEnv(env);
  if (!gd) throw new Error('missing GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET or GDRIVE_REFRESH_TOKEN');
  const step = async (name, fn) => {
    try { const r = await fn(); log(`  ✔ ${name}`); return r; }
    catch (e) { log(`  ✘ ${name}\n\n    ${e.message}\n`); throw Object.assign(e, { step: name }); }
  };
  const folder = await step(`sign in to Google and find the folder “${gd.where}”`, () => gd.folder());
  log(`    https://drive.google.com/drive/folders/${folder}`);
  const data = crypto.randomBytes(1000);
  const id = await step('upload a test file', () => gd.put('sanga-check-' + Date.now(), data));
  const back = await step('read it back', () => gd.get(id));
  if (!back || !back.equals(data)) { log('  ✘ what came back is different'); throw new Error('mismatch'); }
  await step('delete it', () => gd.del(id));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (q, v) => v?.trim() || (await rl.question(q)).trim();
  const env = {
    GDRIVE_CLIENT_ID: await ask('OAuth client ID: ', process.env.GDRIVE_CLIENT_ID),
    GDRIVE_CLIENT_SECRET: await ask('OAuth client secret: ', process.env.GDRIVE_CLIENT_SECRET),
    GDRIVE_REFRESH_TOKEN: await ask('Refresh token: ', process.env.GDRIVE_REFRESH_TOKEN),
    GDRIVE_FOLDER: process.env.GDRIVE_FOLDER, GDRIVE_FOLDER_ID: process.env.GDRIVE_FOLDER_ID,
  };
  rl.close();
  console.log('\nChecking Google Drive the way Sanga’s server uses it:\n');
  try {
    await checkDrive(env);
    console.log('\nAll good: these settings work. Put exactly these three in Render → Environment.\n');
  } catch {
    console.log('That step failed with the reason above. Paste it to Claude (it contains no secrets).\n');
    process.exit(1);
  }
}
