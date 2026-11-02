import type { ReactNode } from 'react';

export function Empty({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="grid place-items-center px-6 py-14 text-center">
      <div>
        <div className="text-5xl" aria-hidden>{emoji}</div>
        <p className="mt-3 text-base font-semibold">{title}</p>
        {children && <div className="mt-1 text-sm text-muted">{children}</div>}
      </div>
    </div>
  );
}
