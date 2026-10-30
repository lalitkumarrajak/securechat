import { toast } from 'sonner';

export function Action({ onClick, children }: { onClick: () => Promise<unknown>; children: React.ReactNode }) {
  return <button className="font-semibold text-accent-ink hover:underline" onClick={() => onClick().catch((e) => toast.error(e.message))}>{children}</button>;
}
