export function CardButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-xs font-medium hover:bg-hover">
      {children}{label}
    </button>
  );
}
