

export function Banner({ icon, children, action }: { icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-line bg-warn px-4 py-2.5 text-sm">
      {icon}<span className="flex-1">{children}</span>{action}
    </div>
  );
}
