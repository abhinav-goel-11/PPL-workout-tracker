'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/lib/db';
import {
  exerciseMediaLinks,
  sessionTemplates,
  templateExercises,
  type MediaProvider,
} from '@/lib/db/schema';
import { requireUser } from '@/server/queries/user';

/** Classifies a link so the UI can label it, without trusting the user's word. */
function detectProvider(url: string): MediaProvider {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'other';
  }

  if (host.endsWith('instagram.com')) return 'instagram_reel';
  if (host === 'youtu.be' || host.endsWith('youtube.com')) {
    return url.includes('/shorts/') ? 'youtube_short' : 'youtube';
  }
  return 'other';
}

const addSchema = z.object({
  templateExerciseId: z.string().min(1),
  // http(s) only — a javascript: or data: href here would be rendered as a link.
  url: z
    .string()
    .url()
    .max(600)
    .refine((u) => /^https?:\/\//i.test(u), {
      message: 'Only http(s) links are allowed.',
    }),
  title: z.string().max(120).optional(),
});

/** Ownership runs through the template: exercises belong to a user's own routine. */
async function assertOwnsExercise(userId: string, templateExerciseId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: templateExercises.id })
    .from(templateExercises)
    .innerJoin(sessionTemplates, eq(sessionTemplates.id, templateExercises.templateId))
    .where(and(eq(templateExercises.id, templateExerciseId), eq(sessionTemplates.userId, userId)))
    .limit(1);

  return Boolean(row);
}

export async function addMediaLink(
  input: z.infer<typeof addSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();

  const parsed = addSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'That link looks invalid.' };
  }

  const { templateExerciseId, url, title } = parsed.data;
  if (!(await assertOwnsExercise(user.id, templateExerciseId))) {
    return { ok: false, error: 'Exercise not found.' };
  }

  const [{ nextPosition }] = await db
    .select({
      nextPosition: sql<number>`coalesce(max(${exerciseMediaLinks.position}) + 1, 0)::int`,
    })
    .from(exerciseMediaLinks)
    .where(eq(exerciseMediaLinks.templateExerciseId, templateExerciseId));

  await db
    .insert(exerciseMediaLinks)
    .values({
      templateExerciseId,
      url,
      provider: detectProvider(url),
      title: title?.trim() || null,
      position: nextPosition,
    })
    .onConflictDoNothing();

  revalidatePath('/settings');
  return { ok: true };
}

export async function deleteMediaLink(id: string): Promise<{ ok: boolean }> {
  const user = await requireUser();

  const [link] = await db
    .select({ id: exerciseMediaLinks.id })
    .from(exerciseMediaLinks)
    .innerJoin(templateExercises, eq(templateExercises.id, exerciseMediaLinks.templateExerciseId))
    .innerJoin(sessionTemplates, eq(sessionTemplates.id, templateExercises.templateId))
    .where(and(eq(exerciseMediaLinks.id, id), eq(sessionTemplates.userId, user.id)))
    .limit(1);

  if (!link) return { ok: false };

  await db.delete(exerciseMediaLinks).where(eq(exerciseMediaLinks.id, id));
  revalidatePath('/settings');
  return { ok: true };
}
