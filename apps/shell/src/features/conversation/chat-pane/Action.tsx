import { toast } from 'sonner';

export function Action({ onClick, children }: { onClick: () => Promise<unknown>; children: React.ReactNode }) { // i18n-ok
  return <button className="font-semibold text-accent-ink hover:underline" onClick={() => onClick().catch((e) => toast.error(e.message))}>{children}</button>;
}
