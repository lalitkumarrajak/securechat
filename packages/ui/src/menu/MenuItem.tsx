import * as M from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from '../utils';

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
