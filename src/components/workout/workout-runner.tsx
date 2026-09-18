'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, CloudOff, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ChecklistDrawer } from '@/components/workout/checklist-drawer';
import { ExerciseCard } from '@/components/workout/exercise-card';
import { RestTimerBar } from '@/components/workout/rest-timer-bar';
import type { ClientSet } from '@/components/workout/set-row';
import { useRestTimer } from '@/components/workout/use-rest-timer';
import { SplitBadge, type SplitType } from '@/components/split-badge';
import { COOLDOWN, WARMUP } from '@/lib/db/routine-data';
import { enqueue, mergeQueued, readQueue } from '@/lib/offline/queue';
import { useSyncQueue } from '@/lib/offline/use-sync-queue';
import type { Unit } from '@/lib/units';
import { abandonWorkout, completeWorkout } from '@/server/actions/workout';
import { addSet } from '@/server/actions/sets';
import type { WorkoutDetail } from '@/server/queries/workout';

const VALUE_DEBOUNCE_MS = 400;
/** Between movements inside a tri-set or circuit — not a full rest. */
const TRANSITION_REST_SECONDS = 15;

export function WorkoutRunner({ detail, unit }: { detail: WorkoutDetail; unit: Unit }) {
  const router = useRouter();
  const logId = detail.log.id;
  const readOnly = detail.log.status !== 'in_progress';

  const timer = useRestTimer(logId);
  const sync = useSyncQueue(logId);
  const [isFinishing, startFinishing] = useTransition();

  const serverSets = useMemo(
    () =>
      detail.groups
        .flatMap((g) => g.exercises)
        .flatMap((e) => e.sets)
        .map((s) => ({
          id: s.id,
          templateExerciseId: s.templateExerciseId ?? '',
          setIndex: s.setIndex,
          weightKg: s.weightKg,
          reps: s.reps,
          durationSeconds: s.durationSeconds,
          rpe: s.rpe,
          isCompleted: s.isCompleted,
          isWarmup: s.isWarmup,
        })),
    [detail.groups],
  );

  /**
   * Local state is authoritative during a session: it survives a dropped
   * connection, and it never snaps back the way a reverting optimistic update
   * would. Seeded from the server on the first render (localStorage isn't
   * readable during SSR), then merged with the offline queue on mount.
   */
  const [sets, setSets] = useState<ClientSet[]>(() =>
    serverSets.map((s) => ({ ...s, pending: false })),
  );

  // Re-merge whenever the server sends new rows (e.g. after "Add set"),
  // keeping anything still queued locally on top.
  const serverSetIds = serverSets.map((s) => s.id).join(',');

  useEffect(() => {
    // Merges the offline queue over the server rows. Runs after mount
    // because localStorage is unreadable during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSets(mergeQueued(serverSets, readQueue(logId)));
    // Keyed on the set ids so this runs when rows are added or removed rather
    // than on every unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSetIds, logId]);

  const exerciseById = useMemo(() => {
    const map = new Map<
      string,
      { restSeconds: number; name: string; groupKey: string | null; groupPosition: number | null }
    >();
    for (const group of detail.groups) {
      for (const exercise of group.exercises) {
        map.set(exercise.id, {
          restSeconds: exercise.restSeconds,
          name: exercise.name,
          groupKey: exercise.groupKey,
          groupPosition: exercise.groupPosition,
        });
      }
    }
    return map;
  }, [detail.groups]);

  const groupByKey = useMemo(() => new Map(detail.groups.map((g) => [g.key, g])), [detail.groups]);

  const setsByExercise = useMemo(() => {
    const map = new Map<string, ClientSet[]>();
    for (const set of sets) {
      const list = map.get(set.templateExerciseId) ?? [];
      list.push(set);
      map.set(set.templateExerciseId, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.setIndex - b.setIndex);
    return map;
  }, [sets]);

  const debounceTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
    };
  }, []);

  const persist = useCallback(
    (set: ClientSet) => {
      enqueue(logId, {
        clientSetId: set.id,
        templateExerciseId: set.templateExerciseId,
        setIndex: set.setIndex,
        weightKg: set.weightKg,
        reps: set.reps,
        durationSeconds: set.durationSeconds,
        rpe: set.rpe,
        isCompleted: set.isCompleted,
        isWarmup: set.isWarmup,
        updatedAt: Date.now(),
      });
      sync.refreshCount();
      void sync.flush();
    },
    [logId, sync],
  );

  /** Typing is debounced; the completion tap is not — it starts the timer. */
  const handleChangeSet = useCallback(
    (setId: string, patch: Partial<ClientSet>) => {
      setSets((current) => {
        const next = current.map((s) => (s.id === setId ? { ...s, ...patch, pending: true } : s));
        const updated = next.find((s) => s.id === setId);

        if (updated) {
          const existing = debounceTimers.current.get(setId);
          if (existing) clearTimeout(existing);
          debounceTimers.current.set(
            setId,
            setTimeout(() => {
              persist(updated);
              debounceTimers.current.delete(setId);
            }, VALUE_DEBOUNCE_MS),
          );
        }

        return next;
      });
    },
    [persist],
  );

  const handleToggleSet = useCallback(
    (setId: string) => {
      timer.primeAudio();

      setSets((current) => {
        const next = current.map((s) =>
          s.id === setId ? { ...s, isCompleted: !s.isCompleted, pending: true } : s,
        );
        const updated = next.find((s) => s.id === setId);
        if (!updated) return next;

        const pendingWrite = debounceTimers.current.get(setId);
        if (pendingWrite) {
          clearTimeout(pendingWrite);
          debounceTimers.current.delete(setId);
        }
        persist(updated);

        if (updated.isCompleted) {
          const exercise = exerciseById.get(updated.templateExerciseId);
          if (exercise) {
            const group = exercise.groupKey ? groupByKey.get(exercise.groupKey) : undefined;
            const isMidGroup =
              group != null &&
              group.exercises.length > 1 &&
              (exercise.groupPosition ?? 0) < group.exercises.length - 1;

            if (isMidGroup) {
              timer.start(TRANSITION_REST_SECONDS, 'Next movement');
            } else if (exercise.restSeconds > 0) {
              timer.start(exercise.restSeconds, exercise.name);
            }
          }
        }

        return next;
      });
    },
    [exerciseById, groupByKey, persist, timer],
  );

  const handleAddSet = useCallback(
    (templateExerciseId: string) => {
      void addSet({ logId, templateExerciseId }).then(() => router.refresh());
    },
    [logId, router],
  );

  const completed = sets.filter((s) => s.isCompleted).length;
  const total = sets.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  function finish() {
    startFinishing(async () => {
      // Never bank a workout while sets are still only on this device.
      if (sync.pendingCount > 0) {
        await sync.flush();
        if (readQueue(logId).length > 0) {
          toast.error('Still syncing', {
            description: `${readQueue(logId).length} set(s) haven't reached the server yet.`,
          });
          return;
        }
      }

      const result = await completeWorkout({ logId });
      if (!result.ok) {
        toast.error(result.error ?? 'Could not finish the workout.');
        return;
      }

      toast.success('Session logged.', { description: 'Next one is queued up.' });
      router.push('/dashboard');
    });
  }

  function abandon() {
    startFinishing(async () => {
      await abandonWorkout(logId);
      toast('Workout discarded.', { description: 'Your place in the cycle is unchanged.' });
      router.push('/dashboard');
    });
  }

  return (
    <div className='flex flex-col gap-4'>
      <header>
        <div className='flex items-center gap-2'>
          <h1 className='text-2xl font-semibold tracking-tight'>{detail.template.name}</h1>
          <SplitBadge split={detail.template.splitType as SplitType} />
        </div>
        <p className='text-muted-foreground mt-1 text-sm'>
          Session {detail.log.templateOrdinal} of 6 · {completed}/{total} sets
        </p>

        <div
          className='bg-muted mt-3 h-1.5 overflow-hidden rounded-full'
          role='progressbar'
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label='Session progress'
        >
          <div
            className='bg-primary h-full rounded-full transition-[width] duration-300'
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {sync.pendingCount > 0 ? (
        <div className='border-warning/40 bg-warning/10 text-warning flex items-center gap-2 rounded-lg border px-3 py-2 text-xs'>
          {sync.isFlushing ? (
            <Loader2 className='size-3.5 animate-spin' aria-hidden />
          ) : (
            <CloudOff className='size-3.5' aria-hidden />
          )}
          {sync.pendingCount} set{sync.pendingCount === 1 ? '' : 's'} saved on this device
          {sync.isOffline ? ' — offline' : ', syncing…'}
        </div>
      ) : null}

      <div className='flex gap-2'>
        <ChecklistDrawer
          logId={logId}
          variant='warmup'
          title={WARMUP.title}
          minutes={WARMUP.minutes}
          items={WARMUP.items}
        />
        <ChecklistDrawer
          logId={logId}
          variant='cooldown'
          title={COOLDOWN.title}
          minutes={COOLDOWN.minutes}
          items={COOLDOWN.items}
        />
      </div>

      <div className='flex flex-col gap-3'>
        {detail.groups.map((group) => (
          <ExerciseCard
            key={group.key}
            group={group}
            setsByExercise={setsByExercise}
            unit={unit}
            readOnly={readOnly}
            onChangeSet={handleChangeSet}
            onToggleSet={handleToggleSet}
            onAddSet={handleAddSet}
            onStartPartnerTimer={(seconds, label) => {
              timer.primeAudio();
              timer.start(seconds, label);
            }}
          />
        ))}
      </div>

      {!readOnly ? (
        <div className='mt-2 flex flex-col gap-2'>
          <Button size='lg' onClick={finish} disabled={isFinishing}>
            {isFinishing ? (
              <Loader2 className='size-5 animate-spin' aria-hidden />
            ) : (
              <CheckCircle2 className='size-5' aria-hidden />
            )}
            Finish session
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='text-muted-foreground'
            onClick={abandon}
            disabled={isFinishing}
          >
            <XCircle className='size-4' aria-hidden />
            Discard this workout
          </Button>
        </div>
      ) : null}

      {timer.isActive ? (
        <RestTimerBar
          label={timer.label}
          secondsLeft={timer.secondsLeft}
          totalSeconds={timer.totalSeconds}
          isElapsed={timer.isElapsed}
          onExtend={timer.extend}
          onStop={timer.stop}
        />
      ) : null}
    </div>
  );
}
