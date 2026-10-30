import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../utils';
import { field } from './field';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(field, 'h-11 text-[0.95rem]', className)} {...props} />,
);
Input.displayName = 'Input';
