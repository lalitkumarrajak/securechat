import { poly, type Pt } from '../geometry';

export function Star({ at }: { at: Pt }) {
  const pts = Array.from({ length: 10 }, (_, k) => {
    const r = k % 2 ? 0.16 : 0.36, a = -Math.PI / 2 + (k * Math.PI) / 5;
    return { x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r };
  });
  return <polygon points={poly(pts)} fill="#d7dce5" stroke="#8f99a8" strokeWidth="0.05" strokeLinejoin="round" />;
}
