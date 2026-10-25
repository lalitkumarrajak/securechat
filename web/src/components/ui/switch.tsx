import * as Sw from '@radix-ui/react-switch';

export function Switch({ checked, onCheckedChange, label, id, disabled }: {
  checked: boolean; onCheckedChange: (v: boolean) => void; label: string; id?: string; disabled?: boolean;
}) {
  return (
    <Sw.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className="relative h-6 w-11 shrink-0 rounded-full bg-line transition data-[state=checked]:bg-accent disabled:opacity-50"
    >
      <Sw.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition data-[state=checked]:translate-x-[22px]" />
    </Sw.Root>
  );
}
