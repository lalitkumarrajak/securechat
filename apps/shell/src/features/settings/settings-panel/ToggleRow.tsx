import { Switch } from '@sanga/ui/switch';

export function ToggleRow({ label, sub, checked, onChange, disabled }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-4 px-5 py-3.5 hover:bg-hover">
      <span className="min-w-0 flex-1"><span className="block">{label}</span>{sub && <span className="block text-sm text-muted">{sub}</span>}</span>
      <Switch checked={checked} onCheckedChange={onChange} label={label} disabled={disabled} />
    </label>
  );
}
