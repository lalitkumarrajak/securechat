import { cn } from '@sanga/ui/utils';

export function Round({ label, onClick, children, className, small, pressed, ping }: {
  label: string; onClick: () => void; children: React.ReactNode; className?: string; small?: boolean; pressed?: boolean; ping?: boolean;
}) {
  return (
    <span className="relative flex flex-col items-center gap-1.5">
      {ping && <span className="pointer-events-none absolute top-0 size-[72px] animate-ping rounded-full bg-green-500/40" aria-hidden />}
      <button onClick={onClick} aria-label={label} aria-pressed={pressed}
        className={cn('relative grid place-items-center rounded-full text-white shadow-lg transition active:scale-95', small ? 'size-12 [&_svg]:size-5 sm:size-14 sm:[&_svg]:size-6' : 'size-[72px] [&_svg]:size-8', className)}>
        {children}
      </button>
      {!small && <span className="text-xs text-white/80">{label}</span>}
    </span>
  );
}
