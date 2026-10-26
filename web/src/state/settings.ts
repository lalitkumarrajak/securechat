// Appearance and behaviour settings, saved on this device. theme-boot.js reads the same
// localStorage key before the app loads, so the saved theme applies without a flash.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'system' | 'light' | 'dark';
export type Accent = 'teal' | 'blue' | 'violet' | 'pink' | 'orange' | 'green';
export type FontSize = 'sm' | 'md' | 'lg';
export type Wallpaper = 'doodle' | 'dots' | 'grid' | 'gradient' | 'plain';

import type { PinHash } from '../lib/pin';

export interface Settings {
  theme: Theme;
  accent: Accent;
  fontSize: FontSize;
  wallpaper: Wallpaper;
  enterToSend: boolean;
  sound: boolean;
  gameSound: boolean;
  push: boolean;
  signOutOnClose: boolean; // this device only: closing the tab signs out and erases local data
  headerTitle: string;     // shown at the top of the chat list; empty = your username
  appLock: PinHash | null; // app lock PIN (this device only); see lib/applock.ts
  lockAfterMs: number;     // lock after being away this long (0 = as soon as you leave)
  privacyScreen: boolean;  // blur names, previews and messages (this device only); see lib/privacy.ts
  privacyKeep: number;     // …except the newest this many messages in a chat
  privacyBlurAway: boolean; // blur the whole app while you're in another app or window
}

export const ACCENTS: { id: Accent; label: string; color: string }[] = [
  { id: 'teal', label: 'Teal', color: '#0d9488' },
  { id: 'blue', label: 'Blue', color: '#2563eb' },
  { id: 'violet', label: 'Violet', color: '#7c3aed' },
  { id: 'pink', label: 'Pink', color: '#db2777' },
  { id: 'orange', label: 'Orange', color: '#ea580c' },
  { id: 'green', label: 'Green', color: '#16a34a' },
];

const defaults: Settings = {
  theme: 'system',
  accent: 'teal',
  fontSize: 'md',
  wallpaper: 'doodle',
  enterToSend: !matchMedia('(pointer: coarse)').matches, // phones: Enter adds a new line
  sound: true,
  gameSound: true,
  push: false,
  signOutOnClose: false,
  headerTitle: '',
  appLock: null,
  lockAfterMs: 0,
  privacyScreen: false,
  privacyKeep: 0,
  privacyBlurAway: true,
};

export const useSettings = create<Settings>()(persist(() => defaults, { name: 'chattrix-settings', version: 1 }));

export const setSettings = (s: Partial<Settings>) => useSettings.setState(s);

const darkQuery = matchMedia('(prefers-color-scheme: dark)');

function apply(s: Settings) {
  const r = document.documentElement;
  const dark = s.theme === 'dark' || (s.theme === 'system' && darkQuery.matches);
  r.dataset.theme = dark ? 'dark' : 'light';
  r.dataset.accent = s.accent;
  r.dataset.font = s.fontSize;
  r.dataset.privacy = s.privacyScreen ? 'on' : 'off';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0f1419' : '#f7f8fa');
}

export function initSettings() {
  apply(useSettings.getState());
  useSettings.subscribe(apply);
  darkQuery.addEventListener('change', () => apply(useSettings.getState()));
}
