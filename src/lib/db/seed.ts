import 'server-only';

import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { ROUTINE } from '@/lib/db/routine-data';
import { exerciseMediaLinks, sessionTemplates, templateExercises, users } from '@/lib/db/schema';

/**
 * Clones the 6 baseline PPL sessions into a user's own rows, which is what
 * makes routines editable per user without a global-template + fork-on-edit
 * split.
 *
 * Idempotent: the unique index on (user_id, ordinal) is the real guard, so a
 * concurrent or retried call can't double-seed. `seededAt` is written last, so
 * a crash mid-way leaves the user unseeded and the next call retries.
 */
export async function seedRoutinesForUser(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ seededAt: users.seededAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new Error(`seedRoutinesForUser: no such user ${userId}`);
  if (user.seededAt) return false;

  const insertedTemplates = await db
    .insert(sessionTemplates)
    .values(
      ROUTINE.map((s) => ({
        userId,
        ordinal: s.ordinal,
        name: s.name,
        splitType: s.splitType,
        variant: s.variant,
        estimatedMinutes: s.estimatedMinutes,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: sessionTemplates.id, ordinal: sessionTemplates.ordinal });

  // Lost the race (or a partial retry) — read back whatever is actually there.
  const templates =
    insertedTemplates.length === ROUTINE.length
      ? insertedTemplates
      : await db
          .select({ id: sessionTemplates.id, ordinal: sessionTemplates.ordinal })
          .from(sessionTemplates)
          .where(eq(sessionTemplates.userId, userId));

  const templateIdByOrdinal = new Map(templates.map((t) => [t.ordinal, t.id]));

  const exerciseRows = ROUTINE.flatMap((session) => {
    const templateId = templateIdByOrdinal.get(session.ordinal);
    if (!templateId) throw new Error(`seed: no template for ordinal ${session.ordinal}`);

    return session.exercises.map((ex, orderIndex) => ({
      templateId,
      orderIndex,
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      kind: ex.kind ?? ('normal' as const),
      targetSets: ex.targetSets,
      repLow: ex.repLow ?? null,
      repHigh: ex.repHigh ?? null,
      restSeconds: ex.restSeconds,
      isTimed: ex.isTimed ?? false,
      groupKey: ex.groupKey ?? null,
      groupPosition: ex.groupPosition ?? null,
      groupRounds: ex.groupRounds ?? null,
      supersetPartnerName: ex.supersetPartnerName ?? null,
      supersetDurationSeconds: ex.supersetDurationSeconds ?? null,
      notes: ex.notes ?? null,
    }));
  });

  const insertedExercises = await db
    .insert(templateExercises)
    .values(exerciseRows)
    .onConflictDoNothing()
    .returning({
      id: templateExercises.id,
      templateId: templateExercises.templateId,
      orderIndex: templateExercises.orderIndex,
    });

  const exerciseIdBySlot = new Map(
    insertedExercises.map((e) => [`${e.templateId}:${e.orderIndex}`, e.id]),
  );

  const mediaRows = ROUTINE.flatMap((session) => {
    const templateId = templateIdByOrdinal.get(session.ordinal)!;
    return session.exercises.flatMap((ex, orderIndex) => {
      const exerciseId = exerciseIdBySlot.get(`${templateId}:${orderIndex}`);
      if (!exerciseId || !ex.media?.length) return [];
      return ex.media.map((m, position) => ({
        templateExerciseId: exerciseId,
        url: m.url,
        provider: m.provider,
        title: m.title,
        position,
      }));
    });
  });

  if (mediaRows.length) {
    await db.insert(exerciseMediaLinks).values(mediaRows).onConflictDoNothing();
  }

  await db.update(users).set({ seededAt: new Date() }).where(eq(users.id, userId));

  return true;
}
