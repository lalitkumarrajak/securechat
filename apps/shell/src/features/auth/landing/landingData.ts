import { Gamepad2, Lock, MessageCircle, NotebookPen, Smartphone, UserPlus, Wallet, Wifi } from 'lucide-react';

export const APPS = [
  { icon: MessageCircle, name: 'Chat', text: 'Messages, groups, stories, voice notes, and voice and video calls.', bg: 'linear-gradient(140deg, #14b8a6, #0f3d3a)' },
  { icon: Gamepad2, name: 'Games', text: 'Ludo and UNO with friends, anyone with a link, or computer players.', bg: 'linear-gradient(140deg, #6366f1, #312e81)' },
  { icon: NotebookPen, name: 'Diary', text: 'Private notes and a daily diary, synced and encrypted.', bg: 'linear-gradient(140deg, #f59e0b, #92400e)' },
  { icon: Wallet, name: 'Split', text: 'Share bills and trips with friends. Coming soon.', bg: 'linear-gradient(140deg, #64748b, #1e293b)', soon: true },
];

export const SAFETY = [
  { icon: Lock, title: 'End-to-end encrypted', text: 'Messages, photos, calls and notes are locked on your device. Not even our server can read them.' },
  { icon: UserPlus, title: 'Friends only', text: 'Nobody can message you until you accept their friend request.' },
  { icon: Wifi, title: 'Made for slow networks', text: 'A small app with compressed photos. Messages wait offline and send when you’re back.' },
  { icon: Smartphone, title: 'Works like an app', text: 'Install it from your browser on any phone or computer. No app store needed.' },
];
