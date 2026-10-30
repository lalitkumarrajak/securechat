import { Search } from 'lucide-react';

// KLIPY's terms require "Search KLIPY" as the search box placeholder.
export function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search KLIPY"
        className="h-9 w-full rounded-full bg-panel-2 pr-3 pl-9 text-sm outline-none placeholder:text-muted focus:ring-2 focus:ring-accent/30" />
    </div>
  );
}
