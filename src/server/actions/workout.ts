'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { todayIn } from '@/lib/date';
import { sessionTemplates, setLogs, templateExercises, workoutLogs } from '@/lib/db/schema';
import { assertOrdinal } from '@/lib/queue/ordinal';
import { getNextUp } from '@/lib/queue/next-session';
import { requireUser } from '@/server/queries/user';

/** Postgres unique-violation — how the "one active workout" rule surfaces. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

const startSchema = z.object({
  ordinal: z.number().int().min(1).max(6).optional(),
  performedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/**
 * Starts (or resumes) a session and redirects into the runner.
 *
 * Pre-creates one empty set row per target set, so the runner only ever
 * upserts on the (log, exercise, setIndex) slot — which is what makes the
 * offline replay idempotent.
 */
export async function startWorkout(input: z.infer<typeof startSchema>): Promise<never> {
  const user = await requireUser();
  const { ordinal, performedOn } = startSchema.parse(input);

  const today = todayIn(user.timeZone);
  const date = performedOn ?? today;

  const targetOrdinal = ordinal
    ? assertOrdinal(ordinal)
    : await getNextUp(user.id, { timeZone: user.timeZone }).then((n) =>
        n.kind === 'resume' ? assertOrdinal(n.log.templateOrdinal) : n.ordinal,
      );

  const [template] = await db
    .select()
    .from(sessionTemplates)
    .where(and(eq(sessionTemplates.userId, user.id), eq(sessionTemplates.ordinal, targetOrdinal)))
    .limit(1);

  if (!template) throw new Error(`No template at ordinal ${targetOrdinal}`);

  let logId: string;

  try {
    const [created] = await db
      .insert(workoutLogs)
      .values({
        userId: user.id,
        templateId: template.id,
        templateOrdinal: template.ordinal,
        performedOn: date,
        status: 'in_progress',
      })
      .returning({ id: workoutLogs.id });

    logId = created.id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    // Someone double-tapped Start, or a second tab beat us. Resume theirs.
    const [existing] = await db
      .select({ id: workoutLogs.id })
      .from(workoutLogs)
      .where(and(eq(workoutLogs.userId, user.id), eq(workoutLogs.status, 'in_progress')))
      .limit(1);

    if (!existing) throw error;
    redirect(`/workout/${existing.id}`);
  }

  const exercises = await db
    .select()
    .from(templateExercises)
    .where(eq(templateExercises.templateId, template.id))
    .orderBy(templateExercises.orderIndex);

  const rows = exercises.flatMap((ex) =>
    Array.from({ length: ex.targetSets }, (_, setIndex) => ({
      workoutLogId: logId,
      templateExerciseId: ex.id,
      userId: user.id,
      performedOn: date,
      exerciseName: ex.name,
      muscleGroup: ex.muscleGroup,
      setIndex,
      isCompleted: false,
    })),
  );

  if (rows.length) {
    await db.insert(setLogs).values(rows).onConflictDoNothing();
  }

  revalidatePath('/dashboard');
  redirect(`/workout/${logId}`);
}

const completeSchema = z.object({
  logId: z.string().min(1),
  notes: z.string().max(2000).optional(),
});

export async function completeWorkout(
  input: z.infer<typeof completeSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const { logId, notes } = completeSchema.parse(input);

  const updated = await db
    .update(workoutLogs)
    .set({ status: 'completed', completedAt: new Date(), notes: notes ?? null })
    .where(
      and(
        eq(workoutLogs.id, logId),
        eq(workoutLogs.userId, user.id),
        eq(workoutLogs.status, 'in_progress'),
      ),
    )
    .returning({ id: workoutLogs.id });

  if (updated.length === 0) return { ok: false, error: 'That workout is no longer active.' };

  // Drop the empty placeholder sets so history and analytics stay honest.
  await db
    .delete(setLogs)
    .where(and(eq(setLogs.workoutLogId, logId), eq(setLogs.isCompleted, false)));

  revalidatePath('/dashboard');
  revalidatePath('/history');
  revalidatePath('/stats');
  return { ok: true };
}

export async function abandonWorkout(logId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();

  await db
    .update(workoutLogs)
    .set({ status: 'abandoned', completedAt: new Date() })
    .where(
      and(
        eq(workoutLogs.id, logId),
        eq(workoutLogs.userId, user.id),
        eq(workoutLogs.status, 'in_progress'),
      ),
    );

  // An abandoned session must not advance the cycle, so its sets go too.
  await db.delete(setLogs).where(eq(setLogs.workoutLogId, logId));

  revalidatePath('/dashboard');
  revalidatePath('/history');
  return { ok: true };
}

export async function deleteWorkout(logId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();

  await db
    .delete(workoutLogs)
    .where(and(eq(workoutLogs.id, logId), eq(workoutLogs.userId, user.id)));

  revalidatePath('/dashboard');
  revalidatePath('/history');
  revalidatePath('/stats');
  return { ok: true };
}
