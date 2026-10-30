import * as M from '@radix-ui/react-dropdown-menu';
import { cn } from '@sanga/ui/utils';
import { type Action } from '../chatUi';
import { ICONS } from './icons';

export function ActionItem({ a }: { a: Action }) {
  return (
    <M.Item onSelect={a.run} disabled={a.disabled}
      className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-hover data-[disabled]:cursor-default data-[disabled]:opacity-45 [&_svg]:size-[18px]',
        a.danger ? 'text-danger' : '[&_svg]:text-muted')}>
      {ICONS[a.key]}
      <span>{a.label}{a.hint && <span className="block text-xs text-muted">{a.hint}</span>}</span>
    </M.Item>
  );
}
