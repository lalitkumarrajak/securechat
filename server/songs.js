// Song search for stories, via Apple's iTunes Search API (no account or key needed): title, artist,
// cover and a 30-second preview. Searches go through this server so people's searches don't reach
// Apple from their phones; the previews themselves play straight from Apple's CDN, and the story shows
// the title and artist. Only Apple's own media hosts are passed on.
import { sendJson, rateLimited } from './http.js';
import { config } from './config.js';

const isAppleMedia = (u, hosts) => {
  try { const { protocol, hostname } = new URL(u); return protocol === 'https:' && hosts.some((h) => hostname === h || hostname.endsWith('.' + h)); }
  catch { return false; }
};

function song(r) {
  if (!r?.previewUrl || !isAppleMedia(r.previewUrl, ['audio-ssl.itunes.apple.com', 'mzstatic.com'])) return null;
  const art = r.artworkUrl100 && isAppleMedia(r.artworkUrl100, ['mzstatic.com']) ? r.artworkUrl100 : undefined;
  return { id: String(r.trackId ?? r.previewUrl), title: String(r.trackName || '').slice(0, 100), artist: String(r.artistName || '').slice(0, 100), src: r.previewUrl, ...(art && { art }) };
}

export const routes = {
  // ?q=search
  'GET /api/songs': async (req, res, me, token, url) => {
    if (rateLimited('song:' + me, 40, 60e3)) return sendJson(res, 429, { error: 'Slow down' });
    const q = String(url.searchParams.get('q') || '').trim().slice(0, 80);
    if (!q) return sendJson(res, 200, { songs: [] });
    const params = new URLSearchParams({ term: q, media: 'music', entity: 'song', limit: '20' });
    try {
      const r = await fetch(`${config.itunesBase}/search?${params}`, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error('iTunes ' + r.status);
      const body = await r.json();
      sendJson(res, 200, { songs: (body?.results || []).map(song).filter((s) => s && s.title) });
    } catch (err) {
      console.error('song search failed', err.message);
      sendJson(res, 502, { error: 'Song search is unavailable right now' });
    }
  },
};
