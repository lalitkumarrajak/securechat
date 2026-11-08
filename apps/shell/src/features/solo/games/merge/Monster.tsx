// The twelve monsters, drawn in SVG: an egg, then round critters that grow sprouts, horns, ears,
// spikes, wings and at last a crown. Each level has its own colour, eyes and name.
import { tk } from '@sanga/i18n';

export const NAMES = ['', tk('Egg'), tk('Sprout'), tk('Bloop'), tk('Nibble'), tk('Whisker'), tk('Spike'), tk('Flutter'), tk('Grumble'), tk('Starlo'), tk('Zephyr'), tk('Blaze'), tk('King Mo')];
const BODY = ['', '#fef3c7', '#86efac', '#7dd3fc', '#fda4af', '#fcd34d', '#c4b5fd', '#5eead4', '#f9a8d4', '#fdba74', '#a5b4fc', '#f87171', '#facc15'];
const DARK = ['', '#d6b98c', '#16a34a', '#0284c7', '#e11d48', '#d97706', '#7c3aed', '#0d9488', '#db2777', '#ea580c', '#4f46e5', '#b91c1c', '#ca8a04'];
const EYES = [0, 0, 2, 1, 2, 2, 3, 2, 1, 2, 3, 2, 2];

function Eye({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#fff" stroke="#1e293b" strokeWidth="1.5" />
      <circle cx={x + r * 0.15} cy={y + r * 0.15} r={r * 0.55} fill="#1e293b" />
      <circle cx={x + r * 0.35} cy={y - r * 0.2} r={r * 0.2} fill="#fff" />
    </g>
  );
}

export function Monster({ tier, className }: { tier: number; className?: string }) {
  const body = BODY[tier], dark = DARK[tier];
  if (tier === 1) return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <ellipse cx="50" cy="90" rx="24" ry="5" fill="#0003" />
      <path d="M50 12 C72 12 80 48 80 64 C80 82 66 92 50 92 C34 92 20 82 20 64 C20 48 28 12 50 12Z" fill={body} stroke={dark} strokeWidth="3" />
      <circle cx="38" cy="40" r="5" fill="#fbbf24" /><circle cx="62" cy="58" r="6" fill="#f472b6" /><circle cx="44" cy="72" r="4" fill="#60a5fa" />
      <path d="M30 52 L38 47 L44 54 L52 47 L58 54 L66 48 L72 53" fill="none" stroke={dark} strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="38" cy="26" rx="5" ry="8" fill="#fff8" transform="rotate(-25 38 26)" />
    </svg>
  );
  const eyes = EYES[tier];
  const eyeR = eyes === 1 ? 11 : eyes === 3 ? 7 : 8.5;
  const xs = eyes === 1 ? [50] : eyes === 2 ? [39, 61] : [34, 50, 66];
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <ellipse cx="50" cy="92" rx="28" ry="5" fill="#0003" />
      {(tier === 7 || tier === 8 || tier >= 10) && (
        <g fill={tier >= 10 ? '#fff' : body} stroke={dark} strokeWidth="2.5" opacity="0.95">
          <path d={tier >= 10 ? 'M24 50 C2 30 2 64 10 72 C14 62 20 64 24 66Z' : 'M24 52 C10 40 8 62 14 68 C18 62 22 62 26 64Z'} />
          <path d={tier >= 10 ? 'M76 50 C98 30 98 64 90 72 C86 62 80 64 76 66Z' : 'M76 52 C90 40 92 62 86 68 C82 62 78 62 74 64Z'} />
        </g>
      )}
      {tier === 5 && <g fill={body} stroke={dark} strokeWidth="2.5"><path d="M26 34 L22 12 L42 26Z" /><path d="M74 34 L78 12 L58 26Z" /></g>}
      {(tier === 4 || tier === 8) && <g fill="#fff7ed" stroke={dark} strokeWidth="2.5"><path d="M32 28 Q26 12 36 8 Q36 18 42 24Z" /><path d="M68 28 Q74 12 64 8 Q64 18 58 24Z" /></g>}
      {tier === 6 && <path d="M28 30 L32 14 L40 26 L46 10 L54 24 L60 10 L66 26 L72 14 L74 30Z" fill={dark} />}
      {tier === 2 && <g><path d="M50 22 Q50 12 50 8" stroke="#15803d" strokeWidth="3" fill="none" /><path d="M50 10 Q38 2 34 10 Q42 16 50 10Z M50 10 Q62 2 66 10 Q58 16 50 10Z" fill="#22c55e" stroke="#15803d" strokeWidth="1.5" /></g>}
      {(tier === 3 || tier === 9) && <g><path d="M50 22 Q46 12 52 6" stroke={dark} strokeWidth="3" fill="none" />
        {tier === 9 ? <path transform="translate(0 4)" d="M52 -1 L55 5 L61 5 L56 9 L58 15 L52 11 L46 15 L48 9 L43 5 L49 5Z" fill="#fde047" stroke="#ca8a04" strokeWidth="1.2" /> : <circle cx="52" cy="6" r="5" fill="#f472b6" stroke={dark} strokeWidth="2" />}</g>}
      <path d="M50 20 C76 20 84 44 84 62 C84 82 70 90 50 90 C30 90 16 82 16 62 C16 44 24 20 50 20Z" fill={body} stroke={dark} strokeWidth="3" />
      <ellipse cx="50" cy="72" rx="20" ry="14" fill="#fff" opacity="0.35" />
      <path d="M26 86 Q30 94 36 88 M64 88 Q70 94 74 86" stroke={dark} strokeWidth="3" fill="none" strokeLinecap="round" />
      {xs.map((x) => <Eye key={x} x={x} y={eyes === 1 ? 46 : 48} r={eyeR} />)}
      <circle cx="28" cy="62" r="5" fill="#fb7185" opacity="0.45" /><circle cx="72" cy="62" r="5" fill="#fb7185" opacity="0.45" />
      <path d={tier % 2 ? 'M40 64 Q50 74 60 64' : 'M42 64 Q50 70 58 64'} stroke="#1e293b" strokeWidth="2.5" fill={tier % 2 ? '#7f1d1d' : 'none'} strokeLinecap="round" />
      {tier >= 6 && <path d="M45 65 L47 70 L49 65Z M51 65 L53 70 L55 65Z" fill="#fff" />}
      {tier >= 11 && (
        <g>
          <path d="M34 22 L36 6 L44 14 L50 2 L56 14 L64 6 L66 22Z" fill="#fde047" stroke="#a16207" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="50" cy="14" r="2.5" fill="#ef4444" /><circle cx="40" cy="17" r="1.8" fill="#3b82f6" /><circle cx="60" cy="17" r="1.8" fill="#22c55e" />
        </g>
      )}
      {tier === 12 && <g fill="#fff"><path d="M12 22 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2Z" /><path d="M86 14 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5Z" /></g>}
    </svg>
  );
}
