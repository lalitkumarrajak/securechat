import { type Pt } from '../geometry';

export function Arrow({ at, ang, color }: { at: Pt; ang: number; color: string }) {
  const deg = (ang * 180) / Math.PI;
  return <path d="M-0.28 -0.18 L0.12 -0.18 L0.12 -0.3 L0.34 0 L0.12 0.3 L0.12 0.18 L-0.28 0.18 Z" fill={color} opacity="0.95"
    transform={`translate(${at.x} ${at.y}) rotate(${deg}) scale(0.85)`} />;
}
