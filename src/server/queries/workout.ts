import 'server-only';

import { and, asc, eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  getAllTimePrs,
  getLastPerformance,
  type ExercisePr,
  type ExerciseTarget,
} from '@/lib/analytics/prs';
import {
  exerciseMediaLinks,
  sessionTemplates,
  setLogs,
  templateExercises,
  type ExerciseMediaLink,
  type SessionTemplate,
  type SetLog,
  type TemplateExercise,
  type WorkoutLog,
} from '@/lib/db/schema';
import { workoutLogs } from '@/lib/db/schema';

export type RunnerExercise = TemplateExercise & {
  sets: SetLog[];
  lastPerformance: ExerciseTarget | null;
  personalRecord: ExercisePr | null;
  media: ExerciseMediaLink[];
};

/**
 * One card in the runner. A group holds several exercises only for tri-sets
 * and circuits; everything else is a group of one.
 */
export type RunnerGroup = {
  key: string;
  kind: TemplateExercise['kind'];
  rounds: number | null;
  restSeconds: number;
  exercises: RunnerExercise[];
};

export type WorkoutDetail = {
  log: WorkoutLog;
  template: SessionTemplate;
  groups: RunnerGroup[];
  totalSets: number;
  completedSets: number;
};

export async function getWorkoutDetail(
  logId: string,
  userId: string,
): Promise<WorkoutDetail | null> {
  const [log] = await db
    .select()
    .from(workoutLogs)
    .where(and(eq(workoutLogs.id, logId), eq(workoutLogs.userId, userId)))
    .limit(1);

  if (!log) return null;

  const [template] = await db
    .select()
    .from(sessionTemplates)
    .where(eq(sessionTemplates.id, log.templateId))
    .limit(1);

  if (!template) return null;

  const exercises = await db
    .select()
    .from(templateExercises)
    .where(eq(templateExercises.templateId, template.id))
    .orderBy(asc(templateExercises.orderIndex));

  const exerciseIds = exercises.map((e) => e.id);

  const [sets, media, lastPerformance, prs] = await Promise.all([
    db.select().from(setLogs).where(eq(setLogs.workoutLogId, logId)).orderBy(asc(setLogs.setIndex)),
    exerciseIds.length
      ? db
          .select()
          .from(exerciseMediaLinks)
          .where(inArray(exerciseMediaLinks.templateExerciseId, exerciseIds))
          .orderBy(asc(exerciseMediaLinks.position))
      : Promise.resolve([] as ExerciseMediaLink[]),
    getLastPerformance(userId, exerciseIds),
    getAllTimePrs(userId, exerciseIds),
  ]);

  const setsByExercise = new Map<string, SetLog[]>();
  for (const set of sets) {
    if (!set.templateExerciseId) continue;
    const list = setsByExercise.get(set.templateExerciseId) ?? [];
    list.push(set);
    setsByExercise.set(set.templateExerciseId, list);
  }

  const mediaByExercise = new Map<string, ExerciseMediaLink[]>();
  for (const link of media) {
    const list = mediaByExercise.get(link.templateExerciseId) ?? [];
    list.push(link);
    mediaByExercise.set(link.templateExerciseId, list);
  }

  // Exercises sharing a groupKey collapse into one card with one rest timer.
  const groups: RunnerGroup[] = [];
  const groupIndexByKey = new Map<string, number>();

  for (const exercise of exercises) {
    const runner: RunnerExercise = {
      ...exercise,
      sets: setsByExercise.get(exercise.id) ?? [],
      lastPerformance: lastPerformance.get(exercise.id) ?? null,
      personalRecord: prs.get(exercise.id) ?? null,
      media: mediaByExercise.get(exercise.id) ?? [],
    };

    const key = exercise.groupKey ?? exercise.id;
    const existing = groupIndexByKey.get(key);

    if (existing !== undefined) {
      groups[existing].exercises.push(runner);
      continue;
    }

    groupIndexByKey.set(key, groups.length);
    groups.push({
      key,
      kind: exercise.kind,
      rounds: exercise.groupRounds,
      restSeconds: exercise.restSeconds,
      exercises: [runner],
    });
  }

  for (const group of groups) {
    group.exercises.sort((a, b) => (a.groupPosition ?? 0) - (b.groupPosition ?? 0));
  }

  const trackedSets = sets.filter((s) => s.templateExerciseId);

  return {
    log,
    template,
    groups,
    totalSets: trackedSets.length,
    completedSets: trackedSets.filter((s) => s.isCompleted).length,
  };
}

/** The in-progress log, if any — used by the bottom-nav "Workout" tab. */
export async function getActiveWorkoutId(userId: string): Promise<string | null> {
  const [active] = await db
    .select({ id: workoutLogs.id })
    .from(workoutLogs)
    .where(and(eq(workoutLogs.userId, userId), eq(workoutLogs.status, 'in_progress')))
    .limit(1);

  return active?.id ?? null;
}
