import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Button } from '@sanga/ui/button';
import { Tabs, TabsContent, TabsList } from '@sanga/ui/tabs';
import { useApp } from '../../../state/app';
import { AuthForm } from './AuthForm';
import { InviteBanner } from './InviteBanner';
import { Logo } from './Logo';
import { APPS } from './landingData';
import type { Auth } from './types';

export function AuthScreen({ tab, setTab, onBack }: { tab: Auth; setTab: (t: Auth) => void; onBack?: () => void }) {
  const signupOpen = useApp((s) => s.signupOpen);
  return (
    <div className="grid h-full overflow-y-auto bg-bg md:grid-cols-2">
      <aside className="relative hidden overflow-hidden p-10 text-white md:flex md:flex-col"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.07) 0 1.5px, transparent 2px) 0 0 / 26px 26px, linear-gradient(150deg, var(--accent), #1e1b4b)' }}>
        <span className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="" className="size-9 rounded-xl" />
          <span className="text-xl font-bold">Sanga</span>
        </span>
        <div className="mt-auto max-w-md">
          <h2 className="text-4xl leading-tight font-bold">Chat, play and write with the people you choose.</h2>
          <ul className="mt-8 grid gap-3 text-white/85">
            {APPS.filter((a) => !a.soon).map(({ icon: Icon, name, text }) => (
              <li key={name} className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/15"><Icon className="size-4" /></span><span className="text-sm"><b className="text-white">{name}.</b> {text}</span></li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="flex min-h-full flex-col px-5 py-6 md:px-12">
        <div className="flex items-center gap-2">
          {onBack && <Button variant="ghost" onClick={onBack} className="-ml-2 gap-1.5"><ArrowLeft className="size-4" /> Back</Button>}
          <span className="ml-auto md:hidden"><Logo /></span>
        </div>
        <div className="mx-auto my-auto w-full max-w-sm py-8">
          <InviteBanner />
          <h1 className="text-3xl font-bold tracking-tight">{tab === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
          <p className="mt-2 mb-6 text-muted">{tab === 'signup' ? 'Pick a username and a strong password.' : 'Sign in to continue to Sanga.'}</p>
          <Tabs value={tab} onValueChange={(v) => setTab(v as Auth)}>
            <TabsList tabs={[
              { value: 'signin', label: 'Sign in' },
              ...(signupOpen ? [{ value: 'signup', label: 'Create account' }] : []),
            ]} />
            <TabsContent value="signin" className="mt-6"><AuthForm mode="signin" /></TabsContent>
            {signupOpen && <TabsContent value="signup" className="mt-6"><AuthForm mode="signup" /></TabsContent>}
          </Tabs>
          <p className="mt-6 flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-px size-4 shrink-0 text-accent-ink" />
            Your password unlocks your encryption key and never leaves this device. It can’t be reset, so keep it safe.
          </p>
        </div>
      </main>
    </div>
  );
}
