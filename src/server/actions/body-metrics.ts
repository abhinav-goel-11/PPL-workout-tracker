'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { todayIn } from '@/lib/date';
import { bodyMetrics } from '@/lib/db/schema';
import { requireUser } from '@/server/queries/user';

const metricSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  weightKg: z.number().min(20).max(400).nullable().optional(),
  bodyFatPct: z.number().min(1).max(70).nullable().optional(),
  waistCm: z.number().min(30).max(250).nullable().optional(),
  chestCm: z.number().min(40).max(250).nullable().optional(),
  armCm: z.number().min(15).max(100).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

/** Body recomposition is a trend, not a single number — one row per day. */
export async function upsertBodyMetric(
  input: z.infer<typeof metricSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();

  const parsed = metricSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Those numbers look out of range.' };

  const { date, ...values } = parsed.data;
  const day = date ?? todayIn(user.timeZone);

  await db
    .insert(bodyMetrics)
    .values({ userId: user.id, date: day, ...values })
    .onConflictDoUpdate({
      target: [bodyMetrics.userId, bodyMetrics.date],
      set: {
        weightKg: sql`excluded.weight_kg`,
        bodyFatPct: sql`excluded.body_fat_pct`,
        waistCm: sql`excluded.waist_cm`,
        chestCm: sql`excluded.chest_cm`,
        armCm: sql`excluded.arm_cm`,
        note: sql`excluded.note`,
      },
    });

  revalidatePath('/stats');
  return { ok: true };
}

export async function deleteBodyMetric(date: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  await db
    .delete(bodyMetrics)
    .where(and(eq(bodyMetrics.userId, user.id), eq(bodyMetrics.date, date)));
  revalidatePath('/stats');
  return { ok: true };
}
