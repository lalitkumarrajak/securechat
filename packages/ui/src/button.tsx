import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:brightness-110 active:brightness-95 shadow-sm',
  secondary: 'bg-panel-2 text-ink hover:bg-hover',
  ghost: 'bg-transparent text-ink hover:bg-hover',
  outline: 'border border-line bg-panel text-ink hover:bg-hover',
  danger: 'bg-danger text-white hover:brightness-110',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-5 text-base rounded-xl gap-2',
  icon: 'size-10 rounded-full',
  'icon-sm': 'size-8 rounded-full',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium transition select-none',
        'disabled:opacity-50 disabled:pointer-events-none',
        variants[variant], sizes[size], className,
      )}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

/** An icon-only button; `label` is required so screen readers can announce it. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(
  ({ label, className, variant = 'ghost', size = 'icon', ...props }, ref) => (
    <Button ref={ref} aria-label={label} title={label} variant={variant} size={size}
      className={cn('text-muted hover:text-ink [&_svg]:size-5', className)} {...props} />
  ),
);
IconButton.displayName = 'IconButton';

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('size-5 shrink-0 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
