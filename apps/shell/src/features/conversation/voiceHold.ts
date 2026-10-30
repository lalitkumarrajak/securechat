import type { VoiceRecorder } from '../../lib/voice';

// ---------- voice messages ----------
// Hold the mic to record and release to send; slide left to cancel. A quick tap instead
// "locks" recording on, with Delete and Send buttons (easier on desktop).
// Shared by the mic button and the recording bar.
export const voice: { recorder: VoiceRecorder | null; pressStart: number; pressX: number } = { recorder: null, pressStart: 0, pressX: 0 };
export const hold = { active: false, cancelled: false, released: false };
