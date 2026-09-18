import 'server-only';

import { and, desc, eq, gte, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { addDays, todayIn } from '@/lib/date';
import {
  restDays,
  sessionTemplates,
  setLogs,
  workoutLogs,
  type RestKind,
  type User,
} from '@/lib/db/schema';

export type HistoryEntry =
  | {
      kind: 'workout';
      id: string;
      date: string;
      name: string;
      ordinal: number;
      splitType: 'push' | 'pull' | 'legs';
      sets: number;
      volumeKg: number;
      durationMinutes: number | null;
    }
  | { kind: 'rest'; id: string; date: string; restKind: RestKind; note: string | null };

export async function getHistory(user: User, days = 90): Promise<HistoryEntry[]> {
  const since = addDays(todayIn(user.timeZone), -days);

  const [workouts, rests] = await Promise.all([
    db
      .select({
        id: workoutLogs.id,
        date: workoutLogs.performedOn,
        name: sessionTemplates.name,
        ordinal: workoutLogs.templateOrdinal,
        splitType: sessionTemplates.splitType,
        startedAt: workoutLogs.startedAt,
        completedAt: workoutLogs.completedAt,
        sets: sql<number>`count(${setLogs.id})::int`,
        volumeKg: sql<number>`coalesce(sum(${setLogs.weightKg} * ${setLogs.reps}), 0)::float8`,
      })
      .from(workoutLogs)
      .innerJoin(sessionTemplates, eq(sessionTemplates.id, workoutLogs.templateId))
      .leftJoin(
        setLogs,
        and(eq(setLogs.workoutLogId, workoutLogs.id), eq(setLogs.isCompleted, true)),
      )
      .where(
        and(
          eq(workoutLogs.userId, user.id),
          eq(workoutLogs.status, 'completed'),
          gte(workoutLogs.performedOn, since),
        ),
      )
      .groupBy(
        workoutLogs.id,
        sessionTemplates.name,
        sessionTemplates.splitType,
        workoutLogs.templateOrdinal,
      )
      .orderBy(desc(workoutLogs.performedOn), desc(workoutLogs.completedAt)),
    db
      .select({
        id: restDays.id,
        date: restDays.date,
        restKind: restDays.kind,
        note: restDays.note,
      })
      .from(restDays)
      .where(and(eq(restDays.userId, user.id), gte(restDays.date, since)))
      .orderBy(desc(restDays.date)),
  ]);

  const entries: HistoryEntry[] = [
    ...workouts.map((w) => ({
      kind: 'workout' as const,
      id: w.id,
      date: w.date,
      name: w.name,
      ordinal: w.ordinal,
      splitType: w.splitType,
      sets: w.sets,
      volumeKg: w.volumeKg,
      durationMinutes: w.completedAt
        ? Math.max(1, Math.round((w.completedAt.getTime() - w.startedAt.getTime()) / 60_000))
        : null,
    })),
    ...rests.map((r) => ({
      kind: 'rest' as const,
      id: r.id,
      date: r.date,
      restKind: r.restKind,
      note: r.note,
    })),
  ];

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export type WorkoutSummary = {
  id: string;
  date: string;
  name: string;
  ordinal: number;
  splitType: 'push' | 'pull' | 'legs';
  notes: string | null;
  durationMinutes: number | null;
  exercises: Array<{
    name: string;
    muscleGroup: string;
    sets: Array<{
      setIndex: number;
      weightKg: number | null;
      reps: number | null;
      durationSeconds: number | null;
    }>;
  }>;
  totalVolumeKg: number;
};

export async function getWorkoutSummary(
  logId: string,
  userId: string,
): Promise<WorkoutSummary | null> {
  const [log] = await db
    .select({
      id: workoutLogs.id,
      date: workoutLogs.performedOn,
      name: sessionTemplates.name,
      ordinal: workoutLogs.templateOrdinal,
      splitType: sessionTemplates.splitType,
      notes: workoutLogs.notes,
      startedAt: workoutLogs.startedAt,
      completedAt: workoutLogs.completedAt,
    })
    .from(workoutLogs)
    .innerJoin(sessionTemplates, eq(sessionTemplates.id, workoutLogs.templateId))
    .where(and(eq(workoutLogs.id, logId), eq(workoutLogs.userId, userId)))
    .limit(1);

  if (!log) return null;

  const sets = await db
    .select()
    .from(setLogs)
    .where(and(eq(setLogs.workoutLogId, logId), eq(setLogs.isCompleted, true)))
    .orderBy(setLogs.exerciseName, setLogs.setIndex);

  const byExercise = new Map<string, WorkoutSummary['exercises'][number]>();
  let totalVolumeKg = 0;

  for (const set of sets) {
    const entry = byExercise.get(set.exerciseName) ?? {
      name: set.exerciseName,
      muscleGroup: set.muscleGroup,
      sets: [],
    };
    entry.sets.push({
      setIndex: set.setIndex,
      weightKg: set.weightKg,
      reps: set.reps,
      durationSeconds: set.durationSeconds,
    });
    byExercise.set(set.exerciseName, entry);
    totalVolumeKg += (set.weightKg ?? 0) * (set.reps ?? 0);
  }

  return {
    id: log.id,
    date: log.date,
    name: log.name,
    ordinal: log.ordinal,
    splitType: log.splitType,
    notes: log.notes,
    durationMinutes: log.completedAt
      ? Math.max(1, Math.round((log.completedAt.getTime() - log.startedAt.getTime()) / 60_000))
      : null,
    exercises: [...byExercise.values()],
    totalVolumeKg,
  };
}
