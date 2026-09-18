import 'server-only';

import { sql } from 'drizzle-orm';

import { db } from '@/lib/db';

export type ExerciseTarget = {
  templateExerciseId: string;
  weightKg: number | null;
  reps: number | null;
  performedOn: string;
};

export type ExercisePr = ExerciseTarget & { estimated1rm: number | null };

/**
 * Prefill targets for a whole session in one round trip.
 *
 * Deliberately the *most recent* completed performance rather than the all-time
 * PR: an all-time best shown as today's target is unusable after a deload or a
 * layoff. The all-time PR is surfaced separately, as a badge.
 */
export async function getLastPerformance(
  userId: string,
  templateExerciseIds: string[],
): Promise<Map<string, ExerciseTarget>> {
  if (templateExerciseIds.length === 0) return new Map();

  const result = await db.execute<ExerciseTarget & { template_exercise_id: string }>(sql`
    select distinct on (template_exercise_id)
           template_exercise_id,
           weight_kg::float8 as "weightKg",
           reps,
           performed_on::text as "performedOn"
    from set_logs
    where user_id = ${userId}
      and template_exercise_id = any(${sql.param(templateExerciseIds)}::text[])
      and is_completed and not is_warmup
    order by template_exercise_id, performed_on desc, weight_kg desc nulls last, reps desc
  `);

  const rows = (result.rows ?? []) as Array<ExerciseTarget & { template_exercise_id: string }>;

  return new Map(
    rows.map((r) => [
      r.template_exercise_id,
      {
        templateExerciseId: r.template_exercise_id,
        weightKg: r.weightKg,
        reps: r.reps,
        performedOn: r.performedOn,
      },
    ]),
  );
}

/** All-time best set per exercise, ranked by estimated 1RM (Epley). */
export async function getAllTimePrs(
  userId: string,
  templateExerciseIds: string[],
): Promise<Map<string, ExercisePr>> {
  if (templateExerciseIds.length === 0) return new Map();

  const result = await db.execute<ExercisePr & { template_exercise_id: string }>(sql`
    select distinct on (template_exercise_id)
           template_exercise_id,
           weight_kg::float8 as "weightKg",
           reps,
           performed_on::text as "performedOn",
           (weight_kg * (1 + reps / 30.0))::float8 as "estimated1rm"
    from set_logs
    where user_id = ${userId}
      and template_exercise_id = any(${sql.param(templateExerciseIds)}::text[])
      and is_completed and not is_warmup
      and weight_kg is not null and reps is not null
    order by template_exercise_id, (weight_kg * (1 + reps / 30.0)) desc, performed_on desc
  `);

  const rows = (result.rows ?? []) as Array<ExercisePr & { template_exercise_id: string }>;

  return new Map(
    rows.map((r) => [
      r.template_exercise_id,
      {
        templateExerciseId: r.template_exercise_id,
        weightKg: r.weightKg,
        reps: r.reps,
        performedOn: r.performedOn,
        estimated1rm: r.estimated1rm,
      },
    ]),
  );
}
