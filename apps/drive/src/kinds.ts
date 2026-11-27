// What kind of file something is (from its type, or its name when the browser didn't say), how to
// show it in the list, and how it can be previewed.
import { t } from '@sanga/i18n';

export type Kind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'doc' | 'sheet' | 'slides' | 'archive' | 'other';

const EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp',
  svg: 'image/svg+xml', heic: 'image/heic', heif: 'image/heif', ico: 'image/x-icon',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', '3gp': 'video/3gpp', avi: 'video/x-msvideo',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/opus', flac: 'audio/flac', amr: 'audio/amr',
  pdf: 'application/pdf',
  txt: 'text/plain', md: 'text/markdown', markdown: 'text/markdown', csv: 'text/csv', tsv: 'text/tab-separated-values', log: 'text/plain',
  json: 'application/json', xml: 'application/xml', yaml: 'text/yaml', yml: 'text/yaml', toml: 'text/plain', ini: 'text/plain', env: 'text/plain',
  html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', ts: 'text/plain', tsx: 'text/plain', jsx: 'text/plain',
  py: 'text/x-python', java: 'text/plain', c: 'text/plain', h: 'text/plain', cpp: 'text/plain', cs: 'text/plain', go: 'text/plain', rs: 'text/plain',
  rb: 'text/plain', php: 'text/plain', sh: 'text/plain', sql: 'text/plain', kt: 'text/plain', swift: 'text/plain', dart: 'text/plain', vcf: 'text/vcard', srt: 'text/plain',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', odt: 'application/vnd.oasis.opendocument.text', rtf: 'application/rtf',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ods: 'application/vnd.oasis.opendocument.spreadsheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', odp: 'application/vnd.oasis.opendocument.presentation',
  zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed', tar: 'application/x-tar', gz: 'application/gzip',
  apk: 'application/vnd.android.package-archive',
};

export const ext = (name: string) => { const m = /\.([^./]+)$/.exec(name); return m ? m[1].toLowerCase() : ''; };

/** The file's type: what the browser said, or what its name suggests. */
export function mimeOf(name: string, type?: string) {
  if (type && type !== 'application/octet-stream') return type;
  return EXT[ext(name)] ?? 'application/octet-stream';
}

export function kindOf(mime: string, name = ''): Kind {
  const e = ext(name);
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  if (/word|opendocument\.text|rtf/.test(mime)) return 'doc';
  if (/sheet|excel|spreadsheet/.test(mime) && e !== 'csv') return 'sheet';
  if (/presentation|powerpoint/.test(mime)) return 'slides';
  if (/zip|rar|7z|tar|gzip|compressed/.test(mime)) return 'archive';
  if (mime.startsWith('text/') || /json|xml|javascript|yaml/.test(mime) || EXT[e]?.startsWith('text/')) return 'text';
  return 'other';
}

/** A kind's colour, the way Drive apps tell files apart at a glance. */
export const KIND_COLOR: Record<Kind, string> = {
  image: '#e11d48', video: '#dc2626', audio: '#9333ea', pdf: '#ef4444', text: '#64748b',
  doc: '#2563eb', sheet: '#16a34a', slides: '#f59e0b', archive: '#a16207', other: '#64748b',
};

export function kindName(k: Kind) {
  return ({
    image: t('Photo'), video: t('Video'), audio: t('Audio'), pdf: t('PDF'), text: t('Text'), doc: t('Document'),
    sheet: t('Spreadsheet'), slides: t('Presentation'), archive: t('Archive'), other: t('File'),
  } as const)[k];
}

/** Photos the browser can show itself; HEIC is turned into JPEG first (see thumbs.ts). */
export const isHeic = (mime: string, name: string) => /image\/hei[cf]/.test(mime) || /^hei[cf]$/.test(ext(name));

/** Previews worth trying: the rest are shown as an icon with a Download button. */
export function previewable(mime: string, name: string, size: number) {
  const k = kindOf(mime, name);
  if (k === 'text') return size <= 5e6;
  return k === 'image' || k === 'video' || k === 'audio' || k === 'pdf';
}

export function fmtSize(bytes: number) {
  if (bytes < 1024) return t('{n} B', { n: bytes });
  const units = [t('KB'), t('MB'), t('GB'), t('TB')];
  let v = bytes / 1024, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, '')} ${units[i]}`;
}

/** A name that isn't taken in the folder: "Photo.jpg" → "Photo (1).jpg". */
export function freeName(name: string, taken: Set<string>) {
  const low = (s: string) => s.toLowerCase();
  const has = new Set([...taken].map(low));
  if (!has.has(low(name))) return name;
  const m = /^(.*?)(\.[^./]{1,10})?$/.exec(name)!;
  for (let i = 1; ; i++) { const n = `${m[1]} (${i})${m[2] ?? ''}`; if (!has.has(low(n))) return n; }
}
