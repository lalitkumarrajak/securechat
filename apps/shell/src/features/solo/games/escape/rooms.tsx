// The three rooms, drawn in SVG (360 × 400). Every thing you can tap goes through `spot`, which makes it
// a button; how it looks follows what you've done (a lifted rug, a lit stove, an open locker).
import type { ReactNode } from 'react';

export interface RoomProps { flags: string[]; spot: (id: string, children: ReactNode) => ReactNode }

const BOOKS = ['#b91c1c', '#1d4ed8', '#15803d', '#a16207', '#7e22ce', '#0f766e', '#be185d', '#c2410c'];

export function Study({ flags, spot }: RoomProps) {
  const f = (x: string) => flags.includes(x);
  return (
    <>
      <rect width="360" height="270" fill="#7c5a43" />
      <rect y="200" width="360" height="70" fill="#6b4a35" />
      <line x1="0" y1="200" x2="360" y2="200" stroke="#4a3020" strokeWidth="3" />
      <rect y="270" width="360" height="130" fill="#4a2f1f" />
      {[292, 316, 340, 364, 388].map((y) => <line key={y} x1="0" y1={y} x2="360" y2={y} stroke="#3a2416" strokeWidth="2" />)}
      {spot('bookshelf', (
        <g>
          <rect x="14" y="48" width="98" height="222" rx="3" fill="#3b2416" />
          {[0, 1, 2, 3].map((r) => (
            <g key={r}>
              {Array.from({ length: 8 }, (_, i) => <rect key={i} x={20 + i * 11} y={60 + r * 52 + (i % 3) * 3} width="9" height={38 - (i % 3) * 3} rx="1" fill={BOOKS[(i + r * 3) % 8]} />)}
              <rect x="16" y={98 + r * 52} width="94" height="5" fill="#2a170d" />
            </g>
          ))}
          {f('lit') && (
            <g>
              <circle cx="63" cy="132" r="42" fill="#fde68a" opacity="0.45" />
              <path d="M36 122h20m4 0h14m4 0h12M38 134h16m4 0h22m4 0h8" stroke="#422006" strokeWidth="3" strokeLinecap="round" />
            </g>
          )}
        </g>
      ))}
      {spot('painting', (
        <g>
          <rect x="128" y="38" width="114" height="78" rx="3" fill="#c9a227" />
          <rect x="136" y="46" width="98" height="62" fill="#7dd3fc" />
          <rect x="136" y="84" width="98" height="24" fill="#1d4ed8" />
          <path d="M160 84h44l-6 9h-32z" fill="#78350f" />
          <path d="M182 82V54l16 26z" fill="#f8fafc" /><path d="M180 82V60l-12 20z" fill="#e2e8f0" />
          <path d="M208 102h20" stroke="#fde68a" strokeWidth="2" />
        </g>
      ))}
      {spot('clock', (
        <g>
          <circle cx="302" cy="50" r="26" fill="#f5f0e1" stroke="#5b3a24" strokeWidth="5" />
          {Array.from({ length: 12 }, (_, i) => <circle key={i} cx={302 + Math.sin((i * Math.PI) / 6) * 19} cy={50 - Math.cos((i * Math.PI) / 6) * 19} r="1.4" fill="#5b3a24" />)}
          <line x1="302" y1="50" x2={302 + Math.sin((4.17 * Math.PI) / 6) * 11} y2={50 - Math.cos((4.17 * Math.PI) / 6) * 11} stroke="#1c1917" strokeWidth="3" strokeLinecap="round" />
          <line x1="302" y1="50" x2={302 + Math.sin(Math.PI / 3) * 17} y2={50 - Math.cos(Math.PI / 3) * 17} stroke="#1c1917" strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
      {spot('door', (
        <g>
          <rect x="262" y="92" width="82" height="178" rx="2" fill="#3d2616" />
          <rect x="272" y="104" width="62" height="70" rx="2" fill="none" stroke="#2a170d" strokeWidth="3" />
          <rect x="272" y="186" width="62" height="74" rx="2" fill="none" stroke="#2a170d" strokeWidth="3" />
          <circle cx="334" cy="184" r="4" fill="#d4a017" />
          <rect x="244" y="160" width="14" height="22" rx="2" fill="#111827" />
          {[0, 1, 2].map((r) => [0, 1].map((c) => <circle key={`${r}${c}`} cx={248 + c * 6} cy={165 + r * 6} r="1.4" fill="#4ade80" />))}
        </g>
      ))}
      {spot('desk', (
        <g>
          <rect x="116" y="188" width="134" height="11" rx="2" fill="#5a3a22" />
          <rect x="124" y="199" width="118" height="71" fill="#6d4529" />
          {f('drawer') ? (
            <g>
              <rect x="146" y="210" width="74" height="24" fill="#1c0f07" />
              <path d="M140 228h86l6 16h-98z" fill="#8a5a36" />
              <circle cx="183" cy="238" r="3" fill="#d4a017" />
            </g>
          ) : (
            <g>
              <rect x="148" y="210" width="70" height="24" rx="2" fill="#7d5233" stroke="#4a2f1f" strokeWidth="2" />
              <circle cx="183" cy="222" r="3" fill="#d4a017" /><rect x="182" y="224" width="2" height="5" fill="#1c0f07" />
            </g>
          )}
        </g>
      ))}
      {spot('lamp', (
        <g>
          <ellipse cx="224" cy="186" rx="12" ry="3" fill="#1f2937" />
          <rect x="222" y="152" width="4" height="34" fill="#374151" />
          <path d="M208 156h32l-8-22h-16z" fill="#fbbf24" stroke="#92400e" strokeWidth="1.5" />
        </g>
      ))}
      {spot('rug', (
        <g>
          <ellipse cx="180" cy="338" rx="122" ry="36" fill="#9f1239" />
          <ellipse cx="180" cy="338" rx="104" ry="26" fill="none" stroke="#fbbf24" strokeWidth="3" strokeDasharray="8 6" />
          <ellipse cx="180" cy="338" rx="48" ry="11" fill="#be123c" stroke="#fbbf24" strokeWidth="2" />
          {f('rug') && <path d="M258 318l44 20-10 24z" fill="#fda4af" stroke="#9f1239" strokeWidth="2" />}
        </g>
      ))}
    </>
  );
}

export function Kitchen({ flags, spot }: RoomProps) {
  const f = (x: string) => flags.includes(x);
  return (
    <>
      <defs>
        <pattern id="esc-tiles" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#e7e5e4" /><path d="M20 0H0V20" fill="none" stroke="#d6d3d1" /></pattern>
        <pattern id="esc-floor" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#d4d4d8" /><rect width="20" height="20" fill="#a1a1aa" /><rect x="20" y="20" width="20" height="20" fill="#a1a1aa" /></pattern>
      </defs>
      <rect width="360" height="300" fill="url(#esc-tiles)" />
      <rect y="300" width="360" height="100" fill="url(#esc-floor)" />
      {spot('fridge', (
        <g>
          <rect x="14" y="68" width="80" height="232" rx="8" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
          <line x1="14" y1="140" x2="94" y2="140" stroke="#94a3b8" strokeWidth="2" />
          <rect x="80" y="90" width="5" height="34" rx="2" fill="#94a3b8" /><rect x="80" y="156" width="5" height="60" rx="2" fill="#94a3b8" />
          {!f('fridge') && <rect x="26" y="80" width="12" height="12" rx="2" fill="#bae6fd" />}
        </g>
      ))}
      {spot('recipe', (
        <g transform="rotate(-4 143 118)">
          <rect x="112" y="94" width="62" height="46" rx="2" fill="#fef3c7" stroke="#d97706" />
          <circle cx="143" cy="98" r="3" fill="#dc2626" />
          {[0, 1, 2, 3].map((i) => <circle key={i} cx={124 + i * 13} cy="124" r="4.5" fill={i === 1 ? '#a8a29e' : '#f97316'} />)}
          <path d="M120 110h44" stroke="#a8a29e" strokeWidth="2" />
        </g>
      ))}
      {spot('stove', (
        <g>
          <rect x="106" y="196" width="102" height="104" rx="3" fill="#e5e7eb" stroke="#6b7280" strokeWidth="2" />
          <rect x="106" y="190" width="102" height="8" rx="2" fill="#374151" />
          {[0, 1, 2, 3].map((i) => <circle key={i} cx={122 + i * 23} cy="212" r="5" fill="#1f2937" />)}
          <rect x="118" y="228" width="78" height="56" rx="4" fill="#111827" opacity="0.85" />
          {f('lit') && [128, 186].map((x) => <path key={x} d={`M${x - 10} 190q4-14 10-18q-2 8 4 10q2-6 6-8q2 10-4 16z`} fill="#3b82f6" opacity="0.9" />)}
        </g>
      ))}
      {spot('shelf', (
        <g>
          <rect x="212" y="94" width="138" height="6" fill="#92400e" />
          {[0, 1, 2].map((i) => <ellipse key={i} cx={224 + i * 11} cy="82" rx="5" ry="12" fill="#f8fafc" stroke="#94a3b8" />)}
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={262 + i * 11} y="83" width="8" height="11" rx="1.5" fill="#0ea5e9" />)}
          {[0, 1].map((i) => <rect key={i} x={318 + i * 15} y="76" width="11" height="18" rx="2" fill="#fbbf24" stroke="#b45309" />)}
        </g>
      ))}
      {spot('pantry', (
        <g>
          <rect x="214" y="122" width="62" height="72" rx="2" fill="#b45309" stroke="#78350f" strokeWidth="2" />
          {f('pantry') ? (
            <g>
              <rect x="218" y="126" width="54" height="64" fill="#3f1d08" />
              {[0, 1, 2].map((i) => <rect key={i} x={224 + i * 16} y="166" width="11" height="20" rx="2" fill={['#dc2626', '#16a34a', '#eab308'][i]} />)}
            </g>
          ) : (
            <g>
              <line x1="245" y1="122" x2="245" y2="194" stroke="#78350f" strokeWidth="2" />
              <circle cx="245" cy="158" r="4" fill="#fde68a" /><rect x="244" y="161" width="2" height="6" fill="#1c0f07" />
            </g>
          )}
        </g>
      ))}
      {spot('sink', (
        <g>
          <rect x="214" y="214" width="62" height="86" fill="#cbd5e1" stroke="#64748b" strokeWidth="2" />
          <rect x="222" y="208" width="46" height="12" rx="4" fill="#94a3b8" />
          <path d="M245 208v-14h10" stroke="#64748b" strokeWidth="4" fill="none" strokeLinecap="round" />
          <circle cx="255" cy="200" r="2" fill="#38bdf8" />
        </g>
      ))}
      {spot('door', (
        <g>
          <rect x="284" y="112" width="66" height="188" rx="2" fill="#475569" />
          <rect x="294" y="124" width="46" height="70" rx="3" fill="#64748b" />
          <circle cx="342" cy="214" r="4" fill="#cbd5e1" />
          <path d="M296 204a8 8 0 0 1 16 0v6" fill="none" stroke="#e5e7eb" strokeWidth="3" />
          <rect x="292" y="208" width="24" height="20" rx="3" fill="#eab308" />
        </g>
      ))}
      {spot('table', (
        <g>
          <rect x="96" y="314" width="176" height="12" rx="3" fill="#a16207" />
          <rect x="106" y="326" width="10" height="60" fill="#854d0e" /><rect x="252" y="326" width="10" height="60" fill="#854d0e" />
          {f('drawer') ? <rect x="152" y="326" width="62" height="14" fill="#713f12" stroke="#422006" /> : <rect x="160" y="326" width="48" height="4" fill="#854d0e" />}
        </g>
      ))}
    </>
  );
}

export function Lab({ flags, spot }: RoomProps) {
  const f = (x: string) => flags.includes(x);
  return (
    <>
      <rect width="360" height="310" fill="#dbe4ee" />
      <rect y="310" width="360" height="90" fill="#94a3b8" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <line key={i} x1={i * 45} y1="310" x2={i * 45} y2="400" stroke="#7b8ba1" />)}
      {spot('whiteboard', (
        <g>
          <rect x="14" y="34" width="132" height="82" rx="3" fill="white" stroke="#94a3b8" strokeWidth="4" />
          {['#16a34a', '#2563eb', '#dc2626', '#2563eb'].map((c, i) => <rect key={i} x={28 + i * 28} y="58" width="18" height="18" rx="3" fill={c} />)}
          <path d="M28 94h70" stroke="#64748b" strokeWidth="2" strokeDasharray="6 4" />
        </g>
      ))}
      {spot('bottles', (
        <g>
          <rect x="158" y="110" width="116" height="6" fill="#64748b" />
          {[['#dc2626', '2'], ['#16a34a', '6'], ['#2563eb', '9']].map(([c, n], i) => (
            <g key={n}>
              <rect x={172 + i * 34} y="70" width="10" height="12" fill={c} opacity="0.7" />
              <rect x={166 + i * 34} y="80" width="22" height="30" rx="5" fill={c} />
              <rect x={170 + i * 34} y="88" width="14" height="14" rx="2" fill="white" />
              <text x={177 + i * 34} y="99.5" fontSize="11" fontWeight="bold" textAnchor="middle" fill="#0f172a">{n}</text>
            </g>
          ))}
        </g>
      ))}
      {spot('locker', (
        <g>
          <rect x="14" y="138" width="66" height="172" rx="3" fill={f('locker') ? '#1e293b' : '#64748b'} stroke="#475569" strokeWidth="2" />
          {f('locker') ? <path d="M80 140l18 8v154l-18 8z" fill="#94a3b8" /> : [0, 1, 2].map((i) => <rect key={i} x="28" y={154 + i * 8} width="38" height="3" rx="1" fill="#475569" />)}
          <rect x="60" y="212" width="12" height="18" rx="2" fill="#0f172a" />
          <circle cx="66" cy="217" r="2" fill={f('locker') ? '#4ade80' : '#ef4444'} />
        </g>
      ))}
      {spot('fuses', (
        <g>
          <rect x="94" y="130" width="50" height="52" rx="3" fill="#475569" />
          <path d="M122 138l-10 16h8l-6 16 14-20h-8l6-12z" fill="#facc15" />
          <circle cx="136" cy="174" r="3" fill={f('power') ? '#4ade80' : '#334155'} />
        </g>
      ))}
      {spot('coat', (
        <g>
          <circle cx="119" cy="200" r="4" fill="#475569" />
          <path d="M119 204l-20 14-6 82h52l-6-82z" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
          <path d="M119 204v96" stroke="#cbd5e1" strokeWidth="2" />
          <rect x="125" y="252" width="14" height="12" rx="2" fill="none" stroke="#94a3b8" />
        </g>
      ))}
      {spot('computer', (
        <g>
          <rect x="156" y="232" width="126" height="10" rx="2" fill="#475569" />
          <rect x="164" y="242" width="8" height="68" fill="#475569" /><rect x="266" y="242" width="8" height="68" fill="#475569" />
          <rect x="216" y="222" width="8" height="10" fill="#334155" />
          <rect x="180" y="166" width="80" height="58" rx="4" fill="#1e293b" />
          <rect x="185" y="171" width="70" height="48" rx="2" fill={f('power') ? (f('unlocked') ? '#14532d' : '#064e3b') : '#0f172a'} />
          {f('power') && !f('unlocked') && [0, 1, 2, 3].map((i) => <rect key={i} x={195 + i * 14} y="190" width="10" height="12" rx="1" fill="#34d399" opacity="0.6" />)}
          {f('unlocked') && <path d="M206 196l10 10 18-20" stroke="#4ade80" strokeWidth="5" fill="none" strokeLinecap="round" />}
        </g>
      ))}
      {spot('bin', (
        <g>
          <path d="M168 298h40l-5 46h-30z" fill="#64748b" stroke="#475569" strokeWidth="2" />
          <rect x="164" y="292" width="48" height="8" rx="2" fill="#475569" />
        </g>
      ))}
      {spot('door', (
        <g>
          <rect x="290" y="108" width="60" height="202" rx="2" fill="#334155" />
          <rect x="298" y="120" width="44" height="58" rx="3" fill="#475569" />
          <rect x="336" y="200" width="6" height="26" rx="2" fill="#94a3b8" />
          <circle cx="320" cy="98" r="6" fill={f('unlocked') ? '#4ade80' : '#ef4444'} />
        </g>
      ))}
      {!f('power') && <rect width="360" height="400" fill="#020617" opacity="0.38" pointerEvents="none" />}
    </>
  );
}
