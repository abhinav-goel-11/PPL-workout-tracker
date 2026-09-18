import type { MuscleGroup } from '@/lib/db/schema';

/**
 * Twelve muscle groups is far too many series for one stacked chart — well
 * past the eight-slot limit where a categorical palette stops being readable.
 * They roll up into the five buckets a PPL split actually trains, which is
 * also the more meaningful cut. Per-muscle detail is shown separately, as a
 * ranked single-hue bar list where the count doesn't matter.
 */
export const BUCKETS = ['Push', 'Pull', 'Legs', 'Core', 'Cardio'] as const;

export type Bucket = (typeof BUCKETS)[number];

const BUCKET_OF: Record<MuscleGroup, Bucket> = {
  chest: 'Push',
  shoulders: 'Push',
  triceps: 'Push',
  back: 'Pull',
  biceps: 'Pull',
  forearms: 'Pull',
  quads: 'Legs',
  hamstrings: 'Legs',
  glutes: 'Legs',
  calves: 'Legs',
  core: 'Core',
  cardio: 'Cardio',
};

export function bucketOf(group: MuscleGroup): Bucket {
  return BUCKET_OF[group];
}

/** Fixed slot order — a series keeps its colour even when others drop out. */
export const BUCKET_COLOR: Record<Bucket, string> = {
  Push: 'var(--chart-1)',
  Pull: 'var(--chart-2)',
  Legs: 'var(--chart-3)',
  Core: 'var(--chart-4)',
  Cardio: 'var(--chart-5)',
};

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: 'Chest',
  shoulders: 'Shoulders',
  triceps: 'Triceps',
  back: 'Back',
  biceps: 'Biceps',
  forearms: 'Forearms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Core',
  cardio: 'Cardio',
};
