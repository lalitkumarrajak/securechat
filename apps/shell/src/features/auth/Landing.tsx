import { useEffect, useState } from 'react';
import { resetSection } from '../../lib/nav';
import { hasPendingLink } from '../games/store';
import { pendingGroupInvite, pendingInviter } from '../../lib/invite';
import { AuthScreen } from './landing/AuthScreen';
import { Welcome } from './landing/Welcome';
import type { Auth } from './landing/types';

export function Landing() {
  const invite = hasPendingLink() || !!pendingGroupInvite() || !!pendingInviter();
  const [auth, setAuthState] = useState<Auth | null>(() => (!invite ? null : pendingInviter() && !hasPendingLink() && !pendingGroupInvite() ? 'signup' : 'signin'));
  useEffect(() => { resetSection(); }, []);
  // The phone's back button closes the sign-in screen.
  useEffect(() => {
    const back = () => setAuthState(null);
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);
  const open = (a: Auth) => { history.pushState({ auth: true }, ''); setAuthState(a); window.scrollTo(0, 0); };
  const close = () => { if (history.state?.auth) history.back(); else setAuthState(null); };

  return auth ? <AuthScreen tab={auth} setTab={setAuthState} onBack={invite ? undefined : close} /> : <Welcome open={open} />;
}
