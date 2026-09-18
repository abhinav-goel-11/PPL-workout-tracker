import 'server-only';

import { sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { diffDays } from '@/lib/date';

/**
 * A streak is an unbroken run of *completed workouts* where no two consecutive
 * workouts are more than MAX_GAP_DAYS apart — i.e. up to two rest days between
 * sessions. It is measured in workouts, not days, and it is "live" only if the
 * last workout is still within the window.
 *
 * Explicitly logged rest days are journal entries: they neither extend the
 * tolerance nor count as streak units.
 */
export const MAX_GAP_DAYS = 3;

export type StreakSummary = {
  current: number;
  currentStartedOn: string | null;
  longest: number;
  lastWorkoutOn: string | null;
  daysSinceLast: number | null;
  /** Days left before the current streak lapses. The motivating number. */
  graceDaysRemaining: number;
  totalWorkouts: number;
};

type IslandRow = {
  workouts: number;
  started: string;
  last_day: string;
};

export async function getStreak(
  userId: string,
  opts: { today: string; maxGapDays?: number },
): Promise<StreakSummary> {
  const maxGap = opts.maxGapDays ?? MAX_GAP_DAYS;

  // Classic gaps-and-islands: number each run where the day-gap exceeds the
  // tolerance, then aggregate per run.
  const result = await db.execute<IslandRow>(sql`
    with days as (
      select distinct performed_on as d
      from workout_logs
      where user_id = ${userId} and status = 'completed'
    ), marked as (
      select d, d - lag(d) over (order by d) as gap from days
    ), islands as (
      select d,
             sum(case when gap is null or gap > ${maxGap} then 1 else 0 end)
               over (order by d rows unbounded preceding) as island
      from marked
    )
    select count(*)::int as workouts,
           min(d)::text  as started,
           max(d)::text  as last_day
    from islands
    group by island
    order by max(d) desc
  `);

  const rows = (result.rows ?? []) as IslandRow[];

  if (rows.length === 0) {
    return {
      current: 0,
      currentStartedOn: null,
      longest: 0,
      lastWorkoutOn: null,
      daysSinceLast: null,
      graceDaysRemaining: 0,
      totalWorkouts: 0,
    };
  }

  const newest = rows[0];
  const daysSinceLast = diffDays(newest.last_day, opts.today);
  const isLive = daysSinceLast <= maxGap;

  return {
    current: isLive ? newest.workouts : 0,
    currentStartedOn: isLive ? newest.started : null,
    longest: Math.max(...rows.map((r) => r.workouts)),
    lastWorkoutOn: newest.last_day,
    daysSinceLast,
    graceDaysRemaining: isLive ? Math.max(0, maxGap - daysSinceLast) : 0,
    totalWorkouts: rows.reduce((sum, r) => sum + r.workouts, 0),
  };
}
