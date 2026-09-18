'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { sessionTemplates, templateExercises } from '@/lib/db/schema';
import { requireUser } from '@/server/queries/user';

const updateSchema = z.object({
  id: z.string().min(1),
  targetSets: z.number().int().min(1).max(20).optional(),
  repLow: z.number().int().min(1).max(100).nullable().optional(),
  repHigh: z.number().int().min(1).max(100).nullable().optional(),
  restSeconds: z.number().int().min(0).max(600).optional(),
  notes: z.string().max(500).nullable().optional(),
});

/**
 * Templates are seeded per user, so editing one is a plain update — there is
 * no global routine to fork from.
 */
export async function updateTemplateExercise(
  input: z.infer<typeof updateSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Those values look out of range.' };

  const { id, ...values } = parsed.data;

  if (values.repLow != null && values.repHigh != null && values.repLow > values.repHigh) {
    return { ok: false, error: 'Minimum reps cannot exceed maximum reps.' };
  }

  const [owned] = await db
    .select({ id: templateExercises.id })
    .from(templateExercises)
    .innerJoin(sessionTemplates, eq(sessionTemplates.id, templateExercises.templateId))
    .where(and(eq(templateExercises.id, id), eq(sessionTemplates.userId, user.id)))
    .limit(1);

  if (!owned) return { ok: false, error: 'Exercise not found.' };

  await db.update(templateExercises).set(values).where(eq(templateExercises.id, id));

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { ok: true };
}
