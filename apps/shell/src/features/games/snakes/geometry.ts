// Where things sit on the Snakes & Ladders board: a 10 × 10 grid read in a zigzag from the bottom left,
// drawn in a 100 × 100 box (plus a strip underneath where tokens wait before square 1).
export interface Pt { x: number; y: number }

/** Centre of square n (1–100). Square 0 is the waiting strip; `slot` spreads several tokens there. */
export function center(n: number, slot = 0): Pt {
  if (n <= 0) return { x: 8 + slot * 9, y: 105 };
  const k = n - 1, row = Math.floor(k / 10);
  const col = row % 2 === 0 ? k % 10 : 9 - (k % 10);
  return { x: col * 10 + 5, y: (9 - row) * 10 + 5 };
}

/** A wavy snake from its head (the high square) down to its tail. */
export function snakePath(head: number, tail: number) {
  const a = center(head), b = center(tail);
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const waves = Math.max(2, Math.round(len / 18));
  let d = `M ${a.x} ${a.y}`;
  for (let i = 0; i < waves; i++) {
    const t1 = (i + 0.5) / waves, t2 = (i + 1) / waves;
    const amp = (i % 2 === 0 ? 1 : -1) * 4.2;
    d += ` Q ${a.x + dx * t1 + nx * amp} ${a.y + dy * t1 + ny * amp} ${a.x + dx * t2} ${a.y + dy * t2}`;
  }
  return { d, a, b };
}

/** A ladder from its foot to its top: two rails and rungs between. */
export function ladderParts(foot: number, top: number) {
  const a = center(foot), b = center(top);
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * 1.7, ny = (dx / len) * 1.7;
  const rungs = Math.max(2, Math.floor(len / 4.5));
  return {
    rails: [[{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }], [{ x: a.x - nx, y: a.y - ny }, { x: b.x - nx, y: b.y - ny }]],
    rungs: Array.from({ length: rungs }, (_, i) => {
      const t = (i + 0.5) / rungs;
      const cx = a.x + dx * t, cy = a.y + dy * t;
      return [{ x: cx + nx, y: cy + ny }, { x: cx - nx, y: cy - ny }];
    }),
  };
}
