import 'server-only';

import { asc, eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  exerciseMediaLinks,
  sessionTemplates,
  templateExercises,
  type ExerciseMediaLink,
  type SessionTemplate,
  type TemplateExercise,
} from '@/lib/db/schema';

export type RoutineSession = SessionTemplate & {
  exercises: Array<TemplateExercise & { media: ExerciseMediaLink[] }>;
};

export async function getRoutine(userId: string): Promise<RoutineSession[]> {
  const templates = await db
    .select()
    .from(sessionTemplates)
    .where(eq(sessionTemplates.userId, userId))
    .orderBy(asc(sessionTemplates.ordinal));

  if (templates.length === 0) return [];

  const exercises = await db
    .select()
    .from(templateExercises)
    .where(
      inArray(
        templateExercises.templateId,
        templates.map((t) => t.id),
      ),
    )
    .orderBy(asc(templateExercises.orderIndex));

  const media = exercises.length
    ? await db
        .select()
        .from(exerciseMediaLinks)
        .where(
          inArray(
            exerciseMediaLinks.templateExerciseId,
            exercises.map((e) => e.id),
          ),
        )
        .orderBy(asc(exerciseMediaLinks.position))
    : [];

  const mediaByExercise = new Map<string, ExerciseMediaLink[]>();
  for (const link of media) {
    const list = mediaByExercise.get(link.templateExerciseId) ?? [];
    list.push(link);
    mediaByExercise.set(link.templateExerciseId, list);
  }

  const exercisesByTemplate = new Map<string, RoutineSession['exercises']>();
  for (const exercise of exercises) {
    const list = exercisesByTemplate.get(exercise.templateId) ?? [];
    list.push({ ...exercise, media: mediaByExercise.get(exercise.id) ?? [] });
    exercisesByTemplate.set(exercise.templateId, list);
  }

  return templates.map((template) => ({
    ...template,
    exercises: exercisesByTemplate.get(template.id) ?? [],
  }));
}
