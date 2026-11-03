import { Gamepad2, Lock, MessageCircle, NotebookPen, Smartphone, UserPlus, Wallet, Wifi } from 'lucide-react';
import { tk } from '@sanga/i18n';

export const APPS = [
  { icon: MessageCircle, name: tk('Chat'), text: tk('Messages, groups, stories, voice notes, and voice and video calls.'), bg: 'linear-gradient(140deg, #14b8a6, #0f3d3a)' },
  { icon: Gamepad2, name: tk('Games'), text: tk('Ludo and UNO with friends, anyone with a link, or computer players.'), bg: 'linear-gradient(140deg, #6366f1, #312e81)' },
  { icon: NotebookPen, name: tk('Diary'), text: tk('Private notes and a daily diary, synced and encrypted.'), bg: 'linear-gradient(140deg, #f59e0b, #92400e)' },
  { icon: Wallet, name: tk('Split'), text: tk('Share bills and trips with friends. Coming soon.'), bg: 'linear-gradient(140deg, #64748b, #1e293b)', soon: true },
];

export const SAFETY = [
  { icon: Lock, title: tk('End-to-end encrypted'), text: tk('Messages, photos, calls and notes are locked on your device. Not even our server can read them.') },
  { icon: UserPlus, title: tk('Friends only'), text: tk('Nobody can message you until you accept their friend request.') },
  { icon: Wifi, title: tk('Made for slow networks'), text: tk('A small app with compressed photos. Messages wait offline and send when you’re back.') },
  { icon: Smartphone, title: tk('Works like an app'), text: tk('Install it from your browser on any phone or computer. No app store needed.') },
];
