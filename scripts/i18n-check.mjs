// Checks Sanga's translations: every text the code shows through t()/tn()/tx()/tk() has a Hindi and a Marathi entry
// with the same {placeholders}, no entry is left over, and no English is shown without going through
// them (text between tags, the usual text attributes, toasts and errors). `// i18n-ok` on a line lets
// it be (a name, a code). Run: node scripts/i18n-check.mjs [--list] — exits 1 if anything is wrong.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
export const NAMESPACES = ['apps/shell/src', 'apps/split/src', 'apps/calendar/src', 'apps/notes/src', 'apps/accounts/src', 'packages/ui/src', 'packages/sdk/src', 'packages/ledger/src'];
const LANGS = ['hi', 'mr'];

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return e.name === 'locales' || e.name === 'node_modules' ? [] : walk(p);
  return /\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name) && e.name !== 'locale.ts' ? [p] : [];
});

const STR = String.raw`(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|\x60((?:\\.|[^\x60\\])*)\x60)`;
const unq = (m, i) => (m[i] ?? m[i + 1] ?? m[i + 2] ?? '').replace(/\\(['"\x60\\])/g, '$1').replace(/\\n/g, '\n');
const CALL = new RegExp(String.raw`(?<![\w.])(t|tk|tx)\(\s*` + STR, 'g');
/** tn(count, 'one', 'other'): the count may hold calls and arrows, so it is skipped by bracket depth. */
const PAIR = new RegExp(String.raw`^\s*` + STR + String.raw`\s*,\s*` + STR);
function* plurals(src) {
  for (const m of src.matchAll(/(?<![\w.])tn\(/g)) {
    let i = m.index + m[0].length, depth = 0;
    for (; i < src.length; i++) {
      const c = src[i];
      if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) { if (depth-- === 0) break; }
      else if (c === ',' && depth === 0) break;
    }
    const r = PAIR.exec(src.slice(i + 1));
    if (src[i] === ',' && r) yield r;
  }
}
const holes = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

// English left in plain sight: words in a string or between tags that don't go through t() and friends.
// Comments, imports and the strings handed to t()/tn()/tx()/tk() are blanked first (same length, so
// line numbers stay right); class names, ids, URLs, keys and the like aren't words, so they pass.
const blank = (x) => x.replace(/[^\n]/g, ' ');
/** Comments blanked, strings kept: a scan that knows where strings are (so 'image/*' isn't a comment). */
function noComments(src) {
  let out = '', i = 0, q = '';
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (q) { out += c; if (c === '\\') { out += d ?? ''; i += 2; continue; } if (c === q) q = ''; i++; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; out += c; i++; continue; }
    if (c === '/' && d === '/') { const e = src.indexOf('\n', i); const j = e < 0 ? src.length : e; out += blank(src.slice(i, j)); i = j; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); const j = e < 0 ? src.length : e + 2; out += blank(src.slice(i, j)); i = j; continue; }
    if (c === '/' && /(^|[(,=:[!&|?{;]|return|typeof)\s*$/.test(out.slice(-12))) { // a regex literal: copied as it is, quotes in it aren't strings
      let j = i + 1, cls = false;
      for (; j < src.length && src[j] !== '\n'; j++) {
        if (src[j] === '\\') { j++; continue; }
        if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; else if (src[j] === '/' && !cls) break;
      }
      if (src[j] === '/') { out += blank(src.slice(i, j + 1)); i = j + 1; continue; }
    }
    out += c; i++;
  }
  return out;
}
function prose(src) {
  return noComments(src)
    .replace(/^\s*(import|export \{[^}]*\} from)\b.*$/gm, blank)
    .replace(new RegExp(String.raw`(?<![\w.])(tn|t|tk|tx)\(\s*` + STR + String.raw`(\s*,\s*` + STR + ')?', 'g'), blank)
    .replace(new RegExp(String.raw`(?<![\w.])tn\([^,()]+(?:\([^()]*\))?[^,()]*,\s*` + STR + String.raw`\s*,\s*` + STR, 'g'), blank)
    .replace(/console\.\w+\([^)]*\)/g, blank);
}
const CLASSY = /^[a-z0-9:\-\[\]\/.%!_#()&>~+=*,@]+$/;
function wordy(s) {
  const x = s.trim();
  if (x.length < 2 || !/[A-Za-z]{2,}/.test(x) || /^(https?:|\/|\.\/|#|data:|mailto:)/.test(x) || /\$\{/.test(x) && !/[A-Za-z]{3,} [A-Za-z]{3,}/.test(x.replace(/\$\{[^}]*\}/g, ''))) return false;
  const words = x.split(/\s+/);
  if (words.every((w) => CLASSY.test(w)) && (words.some((w) => /[-:\[\]\/]/.test(w)) || words.length === 1)) return false; // class names, ids, keys
  if (words.length === 1) return /^[A-Z][a-z’']{2,}[.!?…]?$/.test(x) && !/^(GET|POST|PUT|DELETE|Enter|Escape|Tab|Backspace|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Space|Shift|Control|Meta|Alt|Bearer|Content|Infinity|Date|Error|Promise|Object|Array|String|Number|Boolean|Map|Set|Notification|PushManager|AbortError|NotAllowedError|TimeoutError|QuotaExceededError|SecurityError|NotFoundError|NotReadableError|OverconstrainedError|TypeError|Uint8Array|ArrayBuffer|Blob|File|Image|Audio|Response|Request|Headers|Sanga)$/.test(x);
  return words.filter((w) => /[A-Za-z]{2,}/.test(w)).length >= 2 && !/^[\w.-]+=/.test(x) && !/^(M|L|C|Q|A|Z)[\d\s.,-]/.test(x) && !/^[a-z]+(\.[a-z]+)+$/i.test(x);
}
const LITERAL = new RegExp(STR, 'g');
const JSXTEXT = />([^<>{}]*[A-Za-z]{2,}[^<>{}]*)</g;

export function check() {
  const problems = [];
  const stats = {};
  for (const ns of NAMESPACES) {
    const dir = path.join(ROOT, ns);
    const used = new Map(); // key -> 'plain' | 'plural'
    for (const f of walk(dir)) {
      const src = fs.readFileSync(f, 'utf8');
      const rel = path.relative(ROOT, f);
      for (const m of src.matchAll(CALL)) {
        const s = unq(m, 2);
        if (m[4] !== undefined && /\$\{/.test(m[4])) problems.push(`${rel}: ${m[1]}(\`…\${}…\`) — use {name} placeholders, not \${}: ${s.slice(0, 60)}`);
        used.set(s, used.get(s) ?? 'plain');
      }
      for (const m of plurals(src)) { used.set(unq(m, 4), 'plural'); used.set('\u0000one:' + unq(m, 1), 'one'); }
      const lines = src.split('\n');
      const lineOf = (i) => src.slice(0, i).split('\n').length;
      const ok = (i) => /i18n-ok/.test(lines[lineOf(i) - 1] ?? '');
      const code = prose(src);
      for (const m of code.matchAll(LITERAL)) {
        const text = unq(m, 1);
        const before = code.slice(Math.max(0, m.index - 40), m.index);
        if (/(className|class|key|id|type|role|name|href|src|rel|target|inputMode|autoComplete|accept|capture|lang|dir|method|mode|variant|size|side|align|kind|data-[\w-]+)=\{?\s*$|\b(cn|clsx|querySelector(All)?|getElementById|addEventListener|removeEventListener|matchMedia|get|getItem|setItem|removeItem|startsWith|endsWith|includes|split|join|replace|test|match|createElement|sessionStorage|localStorage|postMessage|fetch|api|post|on|off|emit|send|open)\(\s*[^()]*$|\bcase\s*$|===?\s*$|!==?\s*$/.test(before)) continue;
        if (!wordy(text) || ok(m.index)) continue;
        problems.push(`${rel}:${lineOf(m.index)}: English not translated: "${text.slice(0, 60)}"`);
      }
      if (f.endsWith('.tsx')) {
        for (const m of code.matchAll(JSXTEXT)) {
          const text = m[1].trim();
          if (!text || ok(m.index) || /[()=;]|&&|\|\||\?\s|^[\s\d\W]*$/.test(text) || !/[A-Za-z]{2,}/.test(text)) continue;
          problems.push(`${rel}:${lineOf(m.index)}: English between tags: "${text.slice(0, 60)}"`);
        }
      }
    }
    for (const lang of LANGS) {
      const ldir = path.join(dir, 'locales', lang);
      const dict = {};
      if (fs.existsSync(ldir)) for (const f of fs.readdirSync(ldir).filter((x) => x.endsWith('.json'))) {
        let part;
        try { part = JSON.parse(fs.readFileSync(path.join(ldir, f), 'utf8')); } catch (e) { problems.push(`${ns}/locales/${lang}/${f}: not JSON (${e.message})`); continue; }
        for (const [k, v] of Object.entries(part)) {
          if (k in dict && JSON.stringify(dict[k]) !== JSON.stringify(v)) problems.push(`${ns}/locales/${lang}: "${k}" is in two parts with different translations`);
          dict[k] = v;
        }
      }
      for (const [k, kind] of used) {
        if (k.startsWith('\u0000')) continue;
        const v = dict[k];
        if (v === undefined) { problems.push(`${ns}: no ${lang} for "${k.slice(0, 70)}"`); continue; }
        if (kind === 'plural' && typeof v !== 'string' && (typeof v.one !== 'string' || typeof v.other !== 'string')) { problems.push(`${ns}: ${lang} plural for "${k}" needs one and other`); continue; }
        const forms = typeof v === 'string' ? [v] : [v.one, v.other];
        const want = new Set(holes(k).split(',').filter(Boolean));
        for (const tr of forms) {
          const got = new Set(holes(tr).split(',').filter(Boolean));
          const same = kind === 'plural' ? [...got].every((h) => h === 'n' || want.has(h)) : got.size === want.size && [...got].every((h) => want.has(h));
          if (!same) problems.push(`${ns}: ${lang} "${k.slice(0, 50)}" has placeholders {${[...got]}}, English has {${[...want]}}`);
        }
      }
      for (const k of Object.keys(dict)) if (!used.has(k)) problems.push(`${ns}: ${lang} has "${k.slice(0, 70)}", which nothing shows`);
      stats[ns] = { ...stats[ns], keys: [...used.keys()].filter((k) => !k.startsWith('\u0000')).length, [lang]: Object.keys(dict).length };
    }
  }
  return { problems, stats };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { problems, stats } = check();
  console.table(stats);
  for (const p of problems.slice(0, process.argv.includes('--list') ? Infinity : 200)) console.log(p);
  if (problems.length) { console.log(`\n${problems.length} problems`); process.exit(1); }
  console.log('Translations OK');
}
