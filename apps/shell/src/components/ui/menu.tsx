import * as M from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuSub = M.Sub;

const content = 'z-50 min-w-48 overflow-hidden rounded-xl border border-line bg-panel p-1 text-ink shadow-xl animate-fade-in';

export function MenuContent({ children, align = 'end', className, ...props }: M.DropdownMenuContentProps) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={6} collisionPadding={8} className={cn(content, className)} {...props}>{children}</M.Content>
    </M.Portal>
  );
}

export function MenuItem({ icon, children, danger, className, ...props }: M.DropdownMenuItemProps & { icon?: ReactNode; danger?: boolean }) {
  return (
    <M.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none',
        'data-[highlighted]:bg-hover data-[disabled]:opacity-40 [&_svg]:size-[18px] [&_svg]:text-muted',
        danger && 'text-danger [&_svg]:text-danger', className,
      )}
      {...props}
    >
      {icon}{children}
    </M.Item>
  );
}

export function MenuSubTrigger({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <M.SubTrigger className="flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-hover data-[state=open]:bg-hover [&_svg]:size-[18px] [&_svg]:text-muted">
      {icon}{children}
    </M.SubTrigger>
  );
}

export function MenuSubContent({ children }: { children: ReactNode }) {
  return <M.Portal><M.SubContent sideOffset={4} collisionPadding={8} className={content}>{children}</M.SubContent></M.Portal>;
}

export const MenuSeparator = () => <M.Separator className="my-1 h-px bg-line" />;
