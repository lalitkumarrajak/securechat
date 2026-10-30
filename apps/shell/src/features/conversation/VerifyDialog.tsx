import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { Dialog } from '@sanga/ui/dialog';
import { acceptNewKey, verifyCodes } from '../../lib/engine';
import { setChatUi, useChatUi } from './chatUi';

export function VerifyDialog({ peer, name }: { peer: string; name: string }) {
  const open = useChatUi((s) => s.verify);
  const [codes, setCodes] = useState<{ current: string[]; next: string[] | null } | null>(null);
  useEffect(() => { if (open) verifyCodes(peer).then(setCodes).catch(() => setCodes(null)); }, [open, peer]);
  const Code = ({ groups }: { groups: string[] }) => (
    <div className="grid grid-cols-4 gap-x-3 gap-y-2 rounded-xl bg-panel-2 p-4 text-center font-mono text-lg font-semibold tracking-wider">
      {groups.map((g, i) => <span key={i}>{g}</span>)}
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && setChatUi({ verify: false })} title="Verify security code"
      description={`Compare these numbers with ${name}, in person or on a call. If they match, nobody is intercepting your messages.`}>
      {codes && <Code groups={codes.current} />}
      {codes?.next && (
        <div className="mt-5">
          <p className="mb-3 flex gap-2 text-sm text-danger"><ShieldAlert className="size-5 shrink-0" />
            {name}’s key changed. This happens when they sign in after resetting their account, or if someone is trying to intercept your chat. Only accept it after checking the new code with them.</p>
          <Code groups={codes.next} />
          <Button variant="danger" className="mt-4 w-full" onClick={async () => {
            await acceptNewKey(peer);
            setChatUi({ verify: false });
            toast.success('New security code accepted');
          }}>Accept new code</Button>
        </div>
      )}
    </Dialog>
  );
}
