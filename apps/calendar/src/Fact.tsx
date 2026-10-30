export function Fact({ label, value, sub }: { label: React.ReactNode; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-xs text-muted">{label}</dt>
      <dd className="truncate font-semibold">{value}</dd>
      {sub && <dd className="truncate text-xs text-muted">{sub}</dd>}
    </div>
  );
}
