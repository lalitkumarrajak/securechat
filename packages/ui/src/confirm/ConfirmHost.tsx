import * as A from '@radix-ui/react-alert-dialog';
import { Button } from '../button/Button';
import { useConfirm } from './store';

export function ConfirmHost() {
  const req = useConfirm((s) => s.req);
  const done = (v: string | null) => { req?.resolve(v); useConfirm.setState({ req: null }); };
  return (
    <A.Root open={!!req} onOpenChange={(o) => { if (!o) done(null); }}>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-[60] bg-overlay animate-fade-in" />
        <A.Content className="fixed left-1/2 top-1/2 z-[61] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-panel p-6 text-ink shadow-2xl animate-fade-in">
          <A.Title className="text-lg font-semibold">{req?.title}</A.Title>
          <A.Description className={req?.description ? 'mt-2 text-sm text-muted' : 'sr-only'}>{req?.description || req?.title}</A.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <A.Cancel asChild><Button variant="secondary">Cancel</Button></A.Cancel>
            {req?.actions.map((a) => (
              <Button key={a.value} variant={a.variant || 'primary'} onClick={() => done(a.value)}>{a.label}</Button>
            ))}
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
