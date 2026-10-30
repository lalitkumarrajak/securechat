import type { ReactNode } from 'react';

export function MockTile({ bg, icon, name, stat }: { bg: string; icon: ReactNode; name: string; stat: string }) {
  return (
    <div className="rounded-2xl p-3 text-white" style={{ background: bg }}>
      <span className="grid size-7 place-items-center rounded-lg bg-white/20">{icon}</span>
      <p className="mt-5 text-sm font-bold">{name}</p>
      <p className="text-[10px] text-white/80">{stat}</p>
    </div>
  );
}
