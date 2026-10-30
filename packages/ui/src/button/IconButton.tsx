import { forwardRef } from 'react';
import { cn } from '../utils';
import { Button, type ButtonProps } from './Button';

/** An icon-only button; `label` is required so screen readers can announce it. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(
  ({ label, className, variant = 'ghost', size = 'icon', ...props }, ref) => (
    <Button ref={ref} aria-label={label} title={label} variant={variant} size={size}
      className={cn('text-muted hover:text-ink [&_svg]:size-5', className)} {...props} />
  ),
);
IconButton.displayName = 'IconButton';
