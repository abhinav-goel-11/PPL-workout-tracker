'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { setLogs, templateExercises, workoutLogs } from '@/lib/db/schema';
import { requireUser } from '@/server/queries/user';

const setEntrySchema = z.object({
  clientSetId: z.string().min(1).max(64),
  templateExerciseId: z.string().min(1),
  setIndex: z.number().int().min(0).max(49),
  weightKg: z.number().min(0).max(1000).nullable().optional(),
  reps: z.number().int().min(0).max(1000).nullable().optional(),
  durationSeconds: z.number().int().min(0).max(36_000).nullable().optional(),
  rpe: z.number().min(1).max(10).nullable().optional(),
  isCompleted: z.boolean(),
  isWarmup: z.boolean().optional(),
});

export type SetEntry = z.infer<typeof setEntrySchema>;

const syncSchema = z.object({
  logId: z.string().min(1),
  entries: z.array(setEntrySchema).min(1).max(60),
});

export type SyncResult =
  { ok: true; syncedClientSetIds: string[] } | { ok: false; error: string; retryable: boolean };

/**
 * The single write path for sets — used both by a live tap and by the offline
 * queue replaying a backlog.
 *
 * Idempotent by construction: every row upserts on the
 * (workout_log_id, template_exercise_id, set_index) unique slot, so a replay,
 * a double-tap, or two tabs racing can never duplicate a set.
 */
export async function syncSetLogs(input: z.infer<typeof syncSchema>): Promise<SyncResult> {
  const user = await requireUser();

  const parsed = syncSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid set data.', retryable: false };
  const { logId, entries } = parsed.data;

  const [log] = await db
    .select({
      id: workoutLogs.id,
      templateId: workoutLogs.templateId,
      performedOn: workoutLogs.performedOn,
      status: workoutLogs.status,
    })
    .from(workoutLogs)
    .where(and(eq(workoutLogs.id, logId), eq(workoutLogs.userId, user.id)))
    .limit(1);

  if (!log) return { ok: false, error: 'Workout not found.', retryable: false };
  if (log.status === 'abandoned') {
    return { ok: false, error: 'That workout was abandoned.', retryable: false };
  }

  // Exercise metadata is denormalised onto each set row, so analytics and PR
  // lookups never have to join back through the template.
  const exercises = await db
    .select({
      id: templateExercises.id,
      name: templateExercises.name,
      muscleGroup: templateExercises.muscleGroup,
    })
    .from(templateExercises)
    .where(eq(templateExercises.templateId, log.templateId));

  const byId = new Map(exercises.map((e) => [e.id, e]));

  const rows = entries.flatMap((entry) => {
    const exercise = byId.get(entry.templateExerciseId);
    if (!exercise) return []; // exercise removed from the template since

    return [
      {
        workoutLogId: logId,
        templateExerciseId: entry.templateExerciseId,
        userId: user.id,
        performedOn: log.performedOn,
        exerciseName: exercise.name,
        muscleGroup: exercise.muscleGroup,
        setIndex: entry.setIndex,
        weightKg: entry.weightKg ?? null,
        reps: entry.reps ?? null,
        durationSeconds: entry.durationSeconds ?? null,
        rpe: entry.rpe ?? null,
        isCompleted: entry.isCompleted,
        isWarmup: entry.isWarmup ?? false,
        completedAt: entry.isCompleted ? new Date() : null,
        clientSetId: entry.clientSetId,
        updatedAt: new Date(),
      },
    ];
  });

  if (rows.length === 0) {
    return { ok: false, error: 'No matching exercises.', retryable: false };
  }

  try {
    await db
      .insert(setLogs)
      .values(rows)
      .onConflictDoUpdate({
        target: [setLogs.workoutLogId, setLogs.templateExerciseId, setLogs.setIndex],
        set: {
          weightKg: sql`excluded.weight_kg`,
          reps: sql`excluded.reps`,
          durationSeconds: sql`excluded.duration_seconds`,
          rpe: sql`excluded.rpe`,
          isCompleted: sql`excluded.is_completed`,
          isWarmup: sql`excluded.is_warmup`,
          completedAt: sql`excluded.completed_at`,
          clientSetId: sql`excluded.client_set_id`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  } catch {
    // Network or DB blip: the client keeps the entries queued and retries.
    return { ok: false, error: 'Could not save. Will retry.', retryable: true };
  }

  // Required: without this the RSC payload lags and useOptimistic visibly
  // snaps values back when the transition closes.
  revalidatePath(`/workout/${logId}`, 'page');

  return { ok: true, syncedClientSetIds: entries.map((e) => e.clientSetId) };
}

const addSetSchema = z.object({
  logId: z.string().min(1),
  templateExerciseId: z.string().min(1),
});

/** Appends one set past the template target. */
export async function addSet(input: z.infer<typeof addSetSchema>): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const { logId, templateExerciseId } = addSetSchema.parse(input);

  const [log] = await db
    .select({ performedOn: workoutLogs.performedOn, status: workoutLogs.status })
    .from(workoutLogs)
    .where(and(eq(workoutLogs.id, logId), eq(workoutLogs.userId, user.id)))
    .limit(1);

  if (!log || log.status !== 'in_progress') return { ok: false };

  const [exercise] = await db
    .select({
      id: templateExercises.id,
      name: templateExercises.name,
      muscleGroup: templateExercises.muscleGroup,
    })
    .from(templateExercises)
    .where(eq(templateExercises.id, templateExerciseId))
    .limit(1);

  if (!exercise) return { ok: false };

  const [{ nextIndex }] = await db
    .select({ nextIndex: sql<number>`coalesce(max(${setLogs.setIndex}) + 1, 0)::int` })
    .from(setLogs)
    .where(
      and(eq(setLogs.workoutLogId, logId), eq(setLogs.templateExerciseId, templateExerciseId)),
    );

  await db
    .insert(setLogs)
    .values({
      workoutLogId: logId,
      templateExerciseId,
      userId: user.id,
      performedOn: log.performedOn,
      exerciseName: exercise.name,
      muscleGroup: exercise.muscleGroup,
      setIndex: nextIndex,
      isCompleted: false,
    })
    .onConflictDoNothing();

  revalidatePath(`/workout/${logId}`, 'page');
  return { ok: true };
}

const removeSetSchema = z.object({
  logId: z.string().min(1),
  setLogId: z.string().min(1),
});

export async function removeSet(input: z.infer<typeof removeSetSchema>): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const { logId, setLogId } = removeSetSchema.parse(input);

  await db.delete(setLogs).where(and(eq(setLogs.id, setLogId), eq(setLogs.userId, user.id)));

  revalidatePath(`/workout/${logId}`, 'page');
  return { ok: true };
}
