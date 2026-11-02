import * as T from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';

export function TabsList({ tabs }: { tabs: { value: string; label: ReactNode }[] }) {
  return (
    <T.List className="flex gap-1 rounded-xl bg-panel-2 p-1">
      {tabs.map((t) => (
        <T.Trigger key={t.value} value={t.value}
          className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-1.5 py-2 text-[13px] font-medium sm:px-3 sm:text-sm text-muted transition data-[state=active]:bg-panel data-[state=active]:text-ink data-[state=active]:shadow-sm">
          {t.label}
        </T.Trigger>
      ))}
    </T.List>
  );
}
