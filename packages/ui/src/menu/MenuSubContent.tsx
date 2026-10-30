import * as M from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { content } from './content';

export function MenuSubContent({ children }: { children: ReactNode }) {
  return <M.Portal><M.SubContent sideOffset={4} collisionPadding={8} className={content}>{children}</M.SubContent></M.Portal>;
}
