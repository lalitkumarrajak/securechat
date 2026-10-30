import { cn } from '@sanga/ui/utils';

export function Row({ icon, label, sub, danger, onClick }: { icon: React.ReactNode; label: string; sub?: string; danger?: boolean; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={cn('flex w-full items-center gap-4 px-6 py-3 text-left [&_svg]:size-5', onClick && 'hover:bg-hover', danger ? 'text-danger' : '[&_svg]:text-muted')}>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        {sub && <span className="block text-sm text-muted">{sub}</span>}
      </span>
    </Tag>
  );
}
