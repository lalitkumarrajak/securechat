import * as M from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';

export function MenuSubTrigger({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <M.SubTrigger className="flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-hover data-[state=open]:bg-hover [&_svg]:size-[18px] [&_svg]:text-muted">
      {icon}{children}
    </M.SubTrigger>
  );
}
