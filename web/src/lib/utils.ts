import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const isTouch = () => matchMedia('(pointer: coarse)').matches;
export const isDesktop = () => matchMedia('(min-width: 768px)').matches;
