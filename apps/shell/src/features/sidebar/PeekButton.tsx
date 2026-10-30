import { Eye, EyeOff } from 'lucide-react';
import { IconButton } from '@sanga/ui/button';
import { useSettings } from '../../state/settings';
import { togglePeek, usePeek } from '../../lib/privacy';

/** With the privacy screen on: show everything for a moment, or blur it again. */
export function PeekButton() {
  const on = useSettings((s) => s.privacyScreen);
  const peek = usePeek();
  if (!on) return null;
  return <IconButton label={peek ? 'Blur chats' : 'Show chats for 30 seconds'} onClick={() => togglePeek()}>{peek ? <EyeOff /> : <Eye />}</IconButton>;
}
