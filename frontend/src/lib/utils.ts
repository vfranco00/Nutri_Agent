import { ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// NOVA FUNÇÃO: Remove Markdown (*, #, _, etc)
export function cleanMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*/g, '')   // Remove negrito **
    .replace(/\*/g, '')     // Remove itálico *
    .replace(/#/g, '')      // Remove headers #
    .replace(/`/g, '')      // Remove code blocks
    .replace(/_/g, '')      // Remove underline
    .trim();
}