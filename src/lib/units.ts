import type { User } from '@/lib/db/schema';

export type Unit = User['unit'];

const LB_PER_KG = 2.2046226218;

/** Weights are stored in kg; this converts for display only. */
export function fromKg(kg: number, unit: Unit): number {
  return unit === 'lb' ? kg * LB_PER_KG : kg;
}

/** Converts a user-entered display value back to the stored kg. */
export function toKg(value: number, unit: Unit): number {
  return unit === 'lb' ? value / LB_PER_KG : value;
}

/** Rounds to the nearest plate-ish increment and drops trailing zeroes. */
export function formatWeight(kg: number | null | undefined, unit: Unit): string {
  if (kg == null) return '—';
  const v = fromKg(kg, unit);
  const rounded = Math.round(v * 100) / 100;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} ${unit}`;
}

/** Volume (kg·reps) is large; show it as tonnes past 1000. */
export function formatVolume(kg: number, unit: Unit): string {
  const v = fromKg(kg, unit);
  if (v >= 1000) return `${(v / 1000).toFixed(1)}${unit === 'kg' ? 't' : 'k lb'}`;
  return `${Math.round(v)} ${unit}`;
}

/** Epley estimated one-rep max. */
export function estimated1rm(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}
