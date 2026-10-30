// A small gold crown in the middle of the board, where tokens finish.
export function Crown() {
  return (
    <g transform="translate(0 0.05) scale(0.55)" opacity="0.95">
      <circle r="0.95" fill="#fff" fillOpacity="0.92" stroke="#e1b448" strokeWidth="0.1" />
      <path d="M-0.55 0.3 L-0.62 -0.32 L-0.28 -0.05 L0 -0.45 L0.28 -0.05 L0.62 -0.32 L0.55 0.3 Z" fill="#f2b81b" stroke="#b9820a" strokeWidth="0.06" strokeLinejoin="round" />
    </g>
  );
}
