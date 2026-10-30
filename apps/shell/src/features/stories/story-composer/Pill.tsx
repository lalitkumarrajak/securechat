export function Pill({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/12 px-3 text-sm font-medium hover:bg-white/20">
      {icon}{children}
    </button>
  );
}
