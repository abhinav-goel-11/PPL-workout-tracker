'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { requireUser } from '@/server/queries/user';

/** Rejects anything the platform can't actually resolve as a zone. */
function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function updateTimeZone(timeZone: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!isValidTimeZone(timeZone)) return { ok: false };

  await db.update(users).set({ timeZone }).where(eq(users.id, user.id));
  revalidatePath('/', 'layout');
  return { ok: true };
}

const settingsSchema = z.object({
  unit: z.enum(['kg', 'lb']).optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(),
});

export async function updateSettings(
  input: z.infer<typeof settingsSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid settings.' };

  await db.update(users).set(parsed.data).where(eq(users.id, user.id));
  revalidatePath('/', 'layout');
  return { ok: true };
}
