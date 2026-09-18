import { Flame, Trophy } from 'lucide-react';

import type { StreakSummary } from '@/lib/analytics/streak';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className='text-muted-foreground text-xs'>{label}</p>
      <p className='mt-0.5 text-xl font-semibold tabular-nums'>{value}</p>
      {hint ? <p className='text-muted-foreground mt-0.5 text-[11px]'>{hint}</p> : null}
    </div>
  );
}

export function StreakCard({ streak }: { streak: StreakSummary }) {
  const live = streak.current > 0;

  return (
    <section className='border-border bg-surface rounded-2xl border p-5'>
      <div className='flex items-center gap-2'>
        {live ? (
          <Flame className='text-warning size-4' aria-hidden />
        ) : (
          <Trophy className='text-muted-foreground size-4' aria-hidden />
        )}
        <h2 className='text-sm font-medium'>{live ? 'Current streak' : 'No live streak'}</h2>
      </div>

      <div className='mt-4 grid grid-cols-3 gap-4'>
        <Stat
          label='Streak'
          value={live ? `${streak.current}` : '—'}
          hint={live ? 'workouts' : undefined}
        />
        <Stat label='Longest' value={`${streak.longest}`} hint='workouts' />
        <Stat label='Total' value={`${streak.totalWorkouts}`} hint='logged' />
      </div>

      {live ? (
        <p className='text-muted-foreground mt-4 text-sm'>
          {streak.graceDaysRemaining === 0
            ? 'Train today to keep the streak alive.'
            : `${streak.graceDaysRemaining} day${streak.graceDaysRemaining === 1 ? '' : 's'} of grace left.`}
        </p>
      ) : streak.lastWorkoutOn ? (
        <p className='text-muted-foreground mt-4 text-sm'>
          Last session {streak.daysSinceLast} days ago. Your best run was {streak.longest}.
        </p>
      ) : (
        <p className='text-muted-foreground mt-4 text-sm'>
          Log your first session to start a streak.
        </p>
      )}
    </section>
  );
}
