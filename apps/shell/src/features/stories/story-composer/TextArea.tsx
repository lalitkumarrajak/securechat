import { useEffect, useRef } from 'react';
import { MAX_TEXT } from '../../../lib/stories';
import { cn } from '@sanga/ui/utils';

export function TextArea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} maxLength={MAX_TEXT} rows={5} placeholder="Type something…" aria-label="Story text"
      className={cn('w-full resize-none bg-transparent text-center font-semibold text-white outline-none placeholder:text-white/60',
        value.length > 160 ? 'text-xl' : value.length > 60 ? 'text-2xl' : 'text-4xl')} />
  );
}
