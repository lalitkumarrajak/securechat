export function Quick({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-20 flex-col items-center gap-1.5 rounded-2xl border border-line py-3 text-xs font-medium text-accent-ink hover:bg-hover [&_svg]:size-5">
      {icon}{label}
    </button>
  );
}
