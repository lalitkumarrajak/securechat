export function Token({ color, dark }: { color: string; dark: string }) {
  return (
    <g filter="url(#tok-shadow)" transform="translate(0 -0.12)">
      <ellipse cx="0" cy="0.4" rx="0.26" ry="0.08" fill="#000" opacity="0.25" />
      <path d="M0 0.4 C-0.1 0.2 -0.34 0.06 -0.34 -0.16 A0.34 0.34 0 1 1 0.34 -0.16 C0.34 0.06 0.1 0.2 0 0.4 Z" fill={color} stroke="#fff" strokeWidth="0.07" />
      <circle cx="0" cy="-0.16" r="0.15" fill="#fff" />
      <circle cx="0" cy="-0.16" r="0.09" fill={dark} />
      <path d="M0 0.4 C-0.1 0.2 -0.34 0.06 -0.34 -0.16 A0.34 0.34 0 1 1 0.34 -0.16 C0.34 0.06 0.1 0.2 0 0.4 Z" fill="url(#tok-shine)" />
    </g>
  );
}
