// Messages that are just 1–3 emoji are shown large and animated, like in WhatsApp.
const segmenter = new Intl.Segmenter();

const isEmoji = (s: string) =>
  /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️)+$/u.test(s) &&
  /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(s);

export function emojiOnly(text: string): string[] | null {
  const t = text.trim();
  if (!t || t.length > 40) return null;
  const parts = [...segmenter.segment(t)].map((s) => s.segment).filter((s) => s.trim());
  if (parts.length > 3) return null;
  return parts.every(isEmoji) ? parts : null;
}

/** Noto file name for an emoji: hex code points joined by "_", without variation selectors. */
export const codepoints = (e: string) =>
  [...e].map((c) => c.codePointAt(0)!.toString(16)).filter((h) => h !== 'fe0f').join('_');

export const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍'];

export const EMOJI_PICKER = [
  '😀', '😃', '😄', '😁', '😆', '🥹', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋',
  '😜', '🤪', '🤗', '🤭', '🤫', '🤔', '🫡', '🤐', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '😌', '😔',
  '😪', '😴', '😷', '🤒', '🤕', '🤢', '🥵', '🥶', '😵', '🤯', '🥳', '😎', '🤓', '😕', '😟', '🙁', '😮', '😯',
  '😲', '😳', '🥺', '😦', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '😤', '😡',
  '😠', '🤬', '😈', '💀', '💩', '🤡', '👻', '👽', '🤖', '😺', '🙈', '🙉', '🙊', '💋', '💌', '💘', '💝', '💖',
  '💗', '💓', '💞', '💕', '❣️', '💔', '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '💯', '💢', '💥',
  '💫', '💦', '💨', '💬', '💤', '👋', '🤚', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙',
  '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏',
  '💪', '🧠', '👀', '👁️', '👅', '👄', '🌹', '🌸', '🌻', '🌈', '☀️', '⭐', '🌟', '✨', '⚡', '🔥', '🎉', '🎊',
  '🎁', '🎂', '🍰', '🍕', '🍔', '🍟', '☕', '🍵', '🍺', '🥂', '⚽', '🏏', '🏆', '🎵', '🎶', '🎮', '📚', '✈️',
  '🚀', '🏠', '💡', '📷', '📱', '💻', '⏰', '📌', '✅', '❌', '❓', '❗', '⚠️', '🆗', '🇮🇳',
];
