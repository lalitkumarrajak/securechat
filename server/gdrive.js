// Google Drive, for Drive's sealed file pieces: each piece is a file in one folder ("Sanga Drive") of the
// Google account that signed in with `npm run google-drive-login`. The app only asks for the drive.file
// permission, so it can see and change only the files it made itself, nothing else in that Drive.
//
//   GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET   the Google Cloud OAuth client (type: Desktop app)
//   GDRIVE_REFRESH_TOKEN                     printed by `npm run google-drive-login`
//   GDRIVE_FOLDER                            the folder's name (default "Sanga Drive"; made if missing)
//   GDRIVE_FOLDER_ID                         or an exact folder id instead
//
// Tests point GDRIVE_TOKEN_URL / GDRIVE_API_URL / GDRIVE_UPLOAD_URL at a fake Google.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function gdriveFromEnv(env = process.env) {
  const clientId = env.GDRIVE_CLIENT_ID?.trim(), clientSecret = env.GDRIVE_CLIENT_SECRET?.trim(), refresh = env.GDRIVE_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refresh) return null;
  const TOKEN = env.GDRIVE_TOKEN_URL || 'https://oauth2.googleapis.com/token';
  const API = (env.GDRIVE_API_URL || 'https://www.googleapis.com/drive/v3').replace(/\/+$/, '');
  const UPLOAD = (env.GDRIVE_UPLOAD_URL || 'https://www.googleapis.com/upload/drive/v3').replace(/\/+$/, '');
  const folderName = env.GDRIVE_FOLDER?.trim() || 'Sanga Drive';

  // ---------- access ----------
  let token = null; // { value, exp }
  async function accessToken(fresh = false) {
    if (!fresh && token && token.exp > Date.now()) return token.value;
    const res = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refresh, grant_type: 'refresh_token' }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      // invalid_grant: the sign-in was withdrawn or expired (e.g. the consent screen left in "Testing").
      throw new Error(`Google sign-in failed (${data.error || res.status}): run npm run google-drive-login again`);
    }
    token = { value: data.access_token, exp: Date.now() + (Number(data.expires_in) || 3600) * 1000 - 60_000 };
    return token.value;
  }

  /** A signed-in request; tries again when Google says slow down or has a hiccup, and once with a new token on 401. */
  async function call(method, url, { body, headers = {}, ok404 = false } = {}) {
    let renewed = false;
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, {
        method, body,
        headers: { ...headers, Authorization: `Bearer ${await accessToken(renewed)}` },
        signal: AbortSignal.timeout(120_000),
      }).catch((e) => ({ status: 0, ok: false, err: e }));
      if (res.ok) return res;
      if (res.status === 404 && ok404) return null;
      if (res.status === 401 && !renewed) { renewed = true; continue; }
      const text = res.text ? await res.text().catch(() => '') : String(res.err?.message ?? '');
      const busy = res.status === 0 || res.status === 429 || res.status >= 500 || (res.status === 403 && /rate|limit/i.test(text));
      if (busy && attempt < 4) { await sleep(500 * 2 ** attempt + Math.random() * 250); continue; }
      throw new Error(`Google Drive ${method} ${res.status}: ${text.slice(0, 200)}`);
    }
  }

  // ---------- the folder ----------
  let folderP = env.GDRIVE_FOLDER_ID?.trim() ? Promise.resolve(env.GDRIVE_FOLDER_ID.trim()) : null;
  function folder() {
    return (folderP ??= (async () => {
      const q = `name = '${folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      const found = await (await call('GET', `${API}/files?${new URLSearchParams({ q, spaces: 'drive', fields: 'files(id)', pageSize: '1' })}`)).json();
      if (found.files?.[0]?.id) return found.files[0].id;
      const made = await (await call('POST', `${API}/files?fields=id`, {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: folderName, mimeType: 'application/vnd.google-apps.folder' }),
      })).json();
      return made.id;
    })().catch((e) => { folderP = null; throw e; }));
  }

  return {
    name: 'Google Drive', where: folderName, folder,
    /** Saves the bytes as a new file; its Google Drive id. */
    async put(name, buf) {
      const boundary = 'sanga' + Math.random().toString(36).slice(2);
      const meta = JSON.stringify({ name, parents: [await folder()], mimeType: 'application/octet-stream' });
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
        buf,
        Buffer.from(`\r\n--${boundary}--`),
      ]);
      const res = await call('POST', `${UPLOAD}/files?uploadType=multipart&fields=id`, { body, headers: { 'Content-Type': `multipart/related; boundary=${boundary}` } });
      const { id } = await res.json();
      if (!id) throw new Error('Google Drive gave no file id');
      return id;
    },
    async get(id) {
      const res = await call('GET', `${API}/files/${encodeURIComponent(id)}?alt=media`, { ok404: true });
      return res ? Buffer.from(await res.arrayBuffer()) : null;
    },
    async del(id) { await call('DELETE', `${API}/files/${encodeURIComponent(id)}`, { ok404: true }); },
  };
}
