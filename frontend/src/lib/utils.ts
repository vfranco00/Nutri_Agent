import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Usamos 'any' aqui para evitar o erro de importação do tipo ClassValue
export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

// Mesma regra do backend (schemas/profile.py): campo não pode ser só número/símbolo
const HAS_LETTER_RE = /[a-zA-ZÀ-ÖØ-öø-ÿ]/;

export function isFreeText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return HAS_LETTER_RE.test(trimmed);
}

export function cleanMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*/g, '')   // Remove negrito
    .replace(/\*/g, '')     // Remove itálico
    .replace(/#/g, '')      // Remove headers
    .replace(/`/g, '')      // Remove code blocks
    .replace(/_/g, '')      // Remove underline
    .trim();
}