import 'server-only';

import { and, eq, gte, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { eachWeekStart } from '@/lib/date';
import { setLogs, type MuscleGroup } from '@/lib/db/schema';

export type WeeklyVolumeRow = {
  week: string;
  muscleGroup: MuscleGroup;
  volumeKg: number;
  totalReps: number;
  workingSets: number;
  topSetKg: number | null;
};

/**
 * Weekly training volume per muscle group.
 *
 * The ::float8 / ::int casts are load-bearing: sum() over a numeric column
 * comes back from the driver as a *string*, which silently breaks the charts.
 */
export async function weeklyVolumeByMuscle(
  userId: string,
  sinceISO: string,
  weekStartsOn = 1,
): Promise<WeeklyVolumeRow[]> {
  // date_trunc('week') is Monday-based; shift the input for other week starts.
  const offset = (8 - weekStartsOn) % 7;
  const week = sql<string>`(date_trunc('week', ${setLogs.performedOn} + ${sql.raw(`interval '${offset} day'`)})::date - ${sql.raw(`interval '${offset} day'`)})::date::text`;

  const rows = await db
    .select({
      week,
      muscleGroup: setLogs.muscleGroup,
      volumeKg: sql<number>`coalesce(sum(${setLogs.weightKg} * ${setLogs.reps}), 0)::float8`,
      totalReps: sql<number>`coalesce(sum(${setLogs.reps}), 0)::int`,
      workingSets: sql<number>`count(*)::int`,
      topSetKg: sql<number | null>`max(${setLogs.weightKg})::float8`,
    })
    .from(setLogs)
    .where(
      and(
        eq(setLogs.userId, userId),
        eq(setLogs.isCompleted, true),
        eq(setLogs.isWarmup, false),
        gte(setLogs.performedOn, sinceISO),
      ),
    )
    .groupBy(week, setLogs.muscleGroup)
    .orderBy(week);

  return rows as WeeklyVolumeRow[];
}

export type VolumeSeriesPoint = { week: string } & Partial<Record<MuscleGroup, number>>;

/**
 * Pivots the grouped rows into one dense row per week, gap-filling weeks with
 * no training. Done here rather than with a generate_series join — the chart
 * needs the dense array anyway.
 */
export function toVolumeSeries(
  rows: WeeklyVolumeRow[],
  from: string,
  to: string,
  weekStartsOn = 1,
): VolumeSeriesPoint[] {
  const byWeek = new Map<string, VolumeSeriesPoint>();
  for (const week of eachWeekStart(from, to, weekStartsOn)) {
    byWeek.set(week, { week });
  }

  for (const row of rows) {
    const point = byWeek.get(row.week) ?? { week: row.week };
    point[row.muscleGroup] = Math.round((point[row.muscleGroup] ?? 0) + row.volumeKg);
    byWeek.set(row.week, point);
  }

  return [...byWeek.values()].sort((a, b) => a.week.localeCompare(b.week));
}

/** Sets per muscle group per week — the real hypertrophy input variable. */
export function toSetsSeries(
  rows: WeeklyVolumeRow[],
  from: string,
  to: string,
  weekStartsOn = 1,
): VolumeSeriesPoint[] {
  const byWeek = new Map<string, VolumeSeriesPoint>();
  for (const week of eachWeekStart(from, to, weekStartsOn)) {
    byWeek.set(week, { week });
  }

  for (const row of rows) {
    const point = byWeek.get(row.week) ?? { week: row.week };
    point[row.muscleGroup] = (point[row.muscleGroup] ?? 0) + row.workingSets;
    byWeek.set(row.week, point);
  }

  return [...byWeek.values()].sort((a, b) => a.week.localeCompare(b.week));
}
