'use client';

import { Check, CloudOff } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { formatWeight } from '@/lib/units';
import type { Unit } from '@/lib/units';
import { cn } from '@/lib/utils';

export type ClientSet = {
  id: string;
  templateExerciseId: string;
  setIndex: number;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  rpe: number | null;
  isCompleted: boolean;
  isWarmup: boolean;
  pending: boolean;
};

export function SetRow({
  set,
  unit,
  isTimed,
  placeholderWeight,
  placeholderReps,
  onChange,
  onToggle,
}: {
  set: ClientSet;
  unit: Unit;
  isTimed: boolean;
  placeholderWeight: string;
  placeholderReps: string;
  onChange: (patch: Partial<ClientSet>) => void;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-[2rem_1fr_1fr_2.75rem] items-center gap-2 rounded-lg px-1 py-1 transition-colors',
        set.isCompleted && 'bg-success/10',
      )}
    >
      <span className='text-muted-foreground text-center text-xs tabular-nums'>
        {set.setIndex + 1}
      </span>

      {isTimed ? (
        <>
          <Input
            type='number'
            inputMode='numeric'
            aria-label={`Set ${set.setIndex + 1} seconds`}
            placeholder='sec'
            className='h-11 text-center text-base'
            value={set.durationSeconds ?? ''}
            onChange={(e) =>
              onChange({ durationSeconds: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
          <div className='text-muted-foreground text-center text-xs'>seconds</div>
        </>
      ) : (
        <>
          <Input
            type='number'
            inputMode='decimal'
            step='0.5'
            aria-label={`Set ${set.setIndex + 1} weight in ${unit}`}
            placeholder={placeholderWeight}
            className='h-11 text-center text-base'
            value={set.weightKg ?? ''}
            onChange={(e) =>
              onChange({ weightKg: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
          <Input
            type='number'
            inputMode='numeric'
            aria-label={`Set ${set.setIndex + 1} reps`}
            placeholder={placeholderReps}
            className='h-11 text-center text-base'
            value={set.reps ?? ''}
            onChange={(e) =>
              onChange({ reps: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </>
      )}

      <button
        type='button'
        onClick={onToggle}
        aria-pressed={set.isCompleted}
        aria-label={`Mark set ${set.setIndex + 1} ${set.isCompleted ? 'incomplete' : 'complete'}`}
        className={cn(
          'relative flex h-11 w-11 items-center justify-center rounded-lg border transition-colors',
          set.isCompleted
            ? 'border-success bg-success text-success-foreground'
            : 'border-border text-muted-foreground hover:border-primary hover:text-primary',
        )}
      >
        <Check className='size-5' strokeWidth={3} aria-hidden />
        {set.pending ? (
          <CloudOff
            className='text-warning absolute -top-1 -right-1 size-3.5'
            aria-label='Not yet synced'
          />
        ) : null}
      </button>
    </div>
  );
}

export function setSummary(set: ClientSet, unit: Unit): string {
  if (set.durationSeconds != null) return `${set.durationSeconds}s`;
  if (set.weightKg == null && set.reps == null) return '—';
  return `${formatWeight(set.weightKg, unit)} × ${set.reps ?? '—'}`;
}
