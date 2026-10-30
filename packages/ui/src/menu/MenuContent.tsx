import * as M from '@radix-ui/react-dropdown-menu';
import { cn } from '../utils';
import { content } from './content';

export function MenuContent({ children, align = 'end', className, ...props }: M.DropdownMenuContentProps) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={6} collisionPadding={8} className={cn(content, className)} {...props}>{children}</M.Content>
    </M.Portal>
  );
}
