import 'server-only';

import { and, asc, eq, gte, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { addDays, startOfWeek, todayIn } from '@/lib/date';
import { getStreak, type StreakSummary } from '@/lib/analytics/streak';
import { weeklyVolumeByMuscle } from '@/lib/analytics/volume';
import { BUCKETS, bucketOf, type Bucket } from '@/lib/analytics/muscle-buckets';
import { bodyMetrics, setLogs, workoutLogs, type MuscleGroup, type User } from '@/lib/db/schema';

export type WeeklyPoint = { week: string } & Partial<Record<Bucket, number>>;

export type MuscleVolumeRow = {
  muscleGroup: MuscleGroup;
  volumeKg: number;
  workingSets: number;
};

export type BodyPoint = {
  date: string;
  weightKg: number | null;
  /** 7-day rolling mean — the line you actually read for recomp. */
  trendKg: number | null;
};

export type StatsData = {
  today: string;
  weekly: WeeklyPoint[];
  weeklySets: WeeklyPoint[];
  byMuscle: MuscleVolumeRow[];
  body: BodyPoint[];
  latestWeightKg: number | null;
  weightChangeKg: number | null;
  streak: StreakSummary;
  activeDays: string[];
  totalVolumeKg: number;
};

const WEEKS = 12;

export async function getStatsData(user: User): Promise<StatsData> {
  const today = todayIn(user.timeZone);
  const from = startOfWeek(addDays(today, -7 * (WEEKS - 1)), user.weekStartsOn);

  const [rows, muscleRows, metrics, streak, activeRows] = await Promise.all([
    weeklyVolumeByMuscle(user.id, from, user.weekStartsOn),
    db
      .select({
        muscleGroup: setLogs.muscleGroup,
        volumeKg: sql<number>`coalesce(sum(${setLogs.weightKg} * ${setLogs.reps}), 0)::float8`,
        workingSets: sql<number>`count(*)::int`,
      })
      .from(setLogs)
      .where(
        and(
          eq(setLogs.userId, user.id),
          eq(setLogs.isCompleted, true),
          eq(setLogs.isWarmup, false),
          gte(setLogs.performedOn, addDays(today, -27)),
        ),
      )
      .groupBy(setLogs.muscleGroup),
    db
      .select({ date: bodyMetrics.date, weightKg: bodyMetrics.weightKg })
      .from(bodyMetrics)
      .where(and(eq(bodyMetrics.userId, user.id), gte(bodyMetrics.date, addDays(today, -180))))
      .orderBy(asc(bodyMetrics.date)),
    getStreak(user.id, { today }),
    db
      .selectDistinct({ date: workoutLogs.performedOn })
      .from(workoutLogs)
      .where(
        and(
          eq(workoutLogs.userId, user.id),
          eq(workoutLogs.status, 'completed'),
          gte(workoutLogs.performedOn, addDays(today, -111)),
        ),
      ),
  ]);

  // Roll the 12 muscle groups up into the 5 chartable buckets.
  const weekly = new Map<string, WeeklyPoint>();
  const weeklySets = new Map<string, WeeklyPoint>();
  let totalVolumeKg = 0;

  for (const row of rows) {
    const bucket = bucketOf(row.muscleGroup);

    const vol = weekly.get(row.week) ?? { week: row.week };
    vol[bucket] = Math.round((vol[bucket] ?? 0) + row.volumeKg);
    weekly.set(row.week, vol);

    const sets = weeklySets.get(row.week) ?? { week: row.week };
    sets[bucket] = (sets[bucket] ?? 0) + row.workingSets;
    weeklySets.set(row.week, sets);

    totalVolumeKg += row.volumeKg;
  }

  // Dense weekly axis so gaps read as gaps rather than closing up.
  const weeks: string[] = [];
  for (let i = 0; i < WEEKS; i++) weeks.push(addDays(from, i * 7));

  const densify = (map: Map<string, WeeklyPoint>): WeeklyPoint[] =>
    weeks.map((week) => {
      const point = map.get(week) ?? { week };
      for (const bucket of BUCKETS) point[bucket] ??= 0;
      return point;
    });

  return {
    today,
    weekly: densify(weekly),
    weeklySets: densify(weeklySets),
    byMuscle: muscleRows
      .filter((r) => r.volumeKg > 0 || r.workingSets > 0)
      .sort((a, b) => b.volumeKg - a.volumeKg),
    body: withRollingMean(metrics),
    latestWeightKg: metrics.at(-1)?.weightKg ?? null,
    weightChangeKg: weightChange(metrics),
    streak,
    activeDays: activeRows.map((r) => r.date),
    totalVolumeKg,
  };
}

/** Bodyweight is noisy day to day; the 7-day mean is the actual signal. */
function withRollingMean(rows: Array<{ date: string; weightKg: number | null }>): BodyPoint[] {
  const window: number[] = [];

  return rows.map((row) => {
    if (row.weightKg != null) {
      window.push(row.weightKg);
      if (window.length > 7) window.shift();
    }

    return {
      date: row.date,
      weightKg: row.weightKg,
      trendKg: window.length
        ? Math.round((window.reduce((a, b) => a + b, 0) / window.length) * 10) / 10
        : null,
    };
  });
}

function weightChange(rows: Array<{ weightKg: number | null }>): number | null {
  const values = rows.map((r) => r.weightKg).filter((v): v is number => v != null);
  if (values.length < 2) return null;
  return Math.round((values[values.length - 1] - values[0]) * 10) / 10;
}
