'use client';

import { Plus, Timer, Trophy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { KindBadge } from '@/components/workout/kind-badge';
import { MediaLinks } from '@/components/workout/media-links';
import { SetRow, type ClientSet } from '@/components/workout/set-row';
import { formatShortDate } from '@/lib/date';
import { formatWeight, type Unit } from '@/lib/units';
import { cn } from '@/lib/utils';
import type { RunnerExercise, RunnerGroup } from '@/server/queries/workout';

function targetLabel(exercise: RunnerExercise): string {
  if (exercise.isTimed) return `${exercise.targetSets} × timed`;
  if (exercise.repLow && exercise.repHigh) {
    const reps =
      exercise.repLow === exercise.repHigh
        ? `${exercise.repLow}`
        : `${exercise.repLow}–${exercise.repHigh}`;
    return `${exercise.targetSets} × ${reps}`;
  }
  return `${exercise.targetSets} sets`;
}

function ExerciseBlock({
  exercise,
  sets,
  unit,
  readOnly,
  onChangeSet,
  onToggleSet,
  onAddSet,
}: {
  exercise: RunnerExercise;
  sets: ClientSet[];
  unit: Unit;
  readOnly: boolean;
  onChangeSet: (setId: string, patch: Partial<ClientSet>) => void;
  onToggleSet: (setId: string) => void;
  onAddSet: (exerciseId: string) => void;
}) {
  const last = exercise.lastPerformance;
  const pr = exercise.personalRecord;

  return (
    <div>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h3 className='text-[15px] leading-tight font-semibold'>{exercise.name}</h3>
          <p className='text-muted-foreground mt-0.5 text-xs'>
            {targetLabel(exercise)} · {exercise.restSeconds}s rest
          </p>
        </div>
      </div>

      {last ? (
        <p className='text-muted-foreground mt-1.5 text-xs'>
          Last: {formatWeight(last.weightKg, unit)} × {last.reps ?? '—'} on{' '}
          {formatShortDate(last.performedOn)}
        </p>
      ) : null}

      {pr?.estimated1rm ? (
        <p className='text-warning mt-0.5 inline-flex items-center gap-1 text-xs'>
          <Trophy className='size-3' aria-hidden />
          PR {formatWeight(pr.weightKg, unit)} × {pr.reps}
        </p>
      ) : null}

      {exercise.notes ? (
        <p className='text-muted-foreground mt-1.5 text-xs italic'>{exercise.notes}</p>
      ) : null}

      <MediaLinks links={exercise.media} />

      <div className='mt-3 space-y-1'>
        {!exercise.isTimed ? (
          <div className='text-muted-foreground grid grid-cols-[2rem_1fr_1fr_2.75rem] gap-2 px-1 text-[10px] uppercase'>
            <span className='text-center'>Set</span>
            <span className='text-center'>{unit}</span>
            <span className='text-center'>Reps</span>
            <span />
          </div>
        ) : null}

        {sets.map((set) => (
          <SetRow
            key={set.id}
            set={set}
            unit={unit}
            isTimed={exercise.isTimed}
            placeholderWeight={last?.weightKg != null ? String(last.weightKg) : '—'}
            placeholderReps={
              last?.reps != null ? String(last.reps) : (exercise.repLow?.toString() ?? '—')
            }
            onChange={(patch) => onChangeSet(set.id, patch)}
            onToggle={() => onToggleSet(set.id)}
          />
        ))}
      </div>

      {!readOnly ? (
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='text-muted-foreground mt-1.5 h-8'
          onClick={() => onAddSet(exercise.id)}
        >
          <Plus className='size-3.5' aria-hidden />
          Add set
        </Button>
      ) : null}
    </div>
  );
}

export function ExerciseCard({
  group,
  setsByExercise,
  unit,
  readOnly,
  onChangeSet,
  onToggleSet,
  onAddSet,
  onStartPartnerTimer,
}: {
  group: RunnerGroup;
  setsByExercise: Map<string, ClientSet[]>;
  unit: Unit;
  readOnly: boolean;
  onChangeSet: (setId: string, patch: Partial<ClientSet>) => void;
  onToggleSet: (setId: string) => void;
  onAddSet: (exerciseId: string) => void;
  onStartPartnerTimer: (seconds: number, label: string) => void;
}) {
  const isGrouped = group.exercises.length > 1;
  const isCardio =
    group.kind === 'cardio_superset' ||
    group.kind === 'finisher_circuit' ||
    group.kind === 'cardio_finisher';

  const allSets = group.exercises.flatMap((e) => setsByExercise.get(e.id) ?? []);
  const done = allSets.filter((s) => s.isCompleted).length;
  const complete = allSets.length > 0 && done === allSets.length;

  return (
    <section
      className={cn(
        'rounded-2xl border p-4 transition-colors',
        complete
          ? 'border-success/40 bg-success/5'
          : isCardio
            ? 'border-cardio/30 bg-surface'
            : 'border-border bg-surface',
      )}
    >
      <div className='mb-3 flex flex-wrap items-center gap-2'>
        <KindBadge kind={group.kind} />
        {group.rounds ? (
          <span className='text-muted-foreground text-[11px]'>{group.rounds} rounds</span>
        ) : null}
        <span className='text-muted-foreground ml-auto text-[11px] tabular-nums'>
          {done}/{allSets.length}
        </span>
      </div>

      <div className={cn(isGrouped && 'divide-border space-y-4 divide-y [&>*+*]:pt-4')}>
        {group.exercises.map((exercise) => (
          <ExerciseBlock
            key={exercise.id}
            exercise={exercise}
            sets={setsByExercise.get(exercise.id) ?? []}
            unit={unit}
            readOnly={readOnly}
            onChangeSet={onChangeSet}
            onToggleSet={onToggleSet}
            onAddSet={onAddSet}
          />
        ))}
      </div>

      {group.exercises.map((exercise) =>
        exercise.supersetPartnerName ? (
          <button
            key={`${exercise.id}-partner`}
            type='button'
            onClick={() =>
              onStartPartnerTimer(
                exercise.supersetDurationSeconds ?? 45,
                exercise.supersetPartnerName!,
              )
            }
            className='border-cardio/40 bg-cardio/10 text-cardio hover:bg-cardio/20 mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm font-medium transition-colors'
          >
            <Timer className='size-4' aria-hidden />
            {exercise.supersetPartnerName} · {exercise.supersetDurationSeconds ?? 45}s
          </button>
        ) : null,
      )}
    </section>
  );
}
