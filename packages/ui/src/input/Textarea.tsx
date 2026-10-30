import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../utils';
import { field } from './field';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(field, 'py-2.5 resize-none', className)} {...props} />,
);
Textarea.displayName = 'Textarea';
