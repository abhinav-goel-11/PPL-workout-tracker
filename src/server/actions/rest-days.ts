'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { todayIn } from '@/lib/date';
import { restDays } from '@/lib/db/schema';
import { requireUser } from '@/server/queries/user';

const logRestSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  kind: z.enum(['planned', 'active_recovery', 'sick', 'travel']).optional(),
  note: z.string().max(500).optional(),
});

/**
 * One tap, and deliberately inert for the queue: rest days live in their own
 * table which `getNextUp` never reads, so logging one cannot shift your place
 * in the cycle.
 */
export async function logRestDay(
  input: z.infer<typeof logRestSchema> = {},
): Promise<{ ok: boolean; date: string }> {
  const user = await requireUser();
  const { date, kind, note } = logRestSchema.parse(input);
  const day = date ?? todayIn(user.timeZone);

  await db
    .insert(restDays)
    .values({ userId: user.id, date: day, kind: kind ?? 'planned', note: note ?? null })
    .onConflictDoUpdate({
      target: [restDays.userId, restDays.date],
      set: { kind: sql`excluded.kind`, note: sql`excluded.note` },
    });

  revalidatePath('/dashboard');
  revalidatePath('/history');
  return { ok: true, date: day };
}

export async function deleteRestDay(date: string): Promise<{ ok: boolean }> {
  const user = await requireUser();

  await db.delete(restDays).where(and(eq(restDays.userId, user.id), eq(restDays.date, date)));

  revalidatePath('/dashboard');
  revalidatePath('/history');
  return { ok: true };
}
