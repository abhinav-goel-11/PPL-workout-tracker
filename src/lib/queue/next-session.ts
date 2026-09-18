import 'server-only';

import { and, asc, desc, eq, lte } from 'drizzle-orm';

import { db } from '@/lib/db';
import { diffDays, todayIn } from '@/lib/date';
import {
  sessionTemplates,
  templateExercises,
  workoutLogs,
  type SessionTemplate,
  type TemplateExercise,
  type WorkoutLog,
} from '@/lib/db/schema';
import {
  assertOrdinal,
  computeNextOrdinal,
  upcomingOrdinals,
  type SessionOrdinal,
} from './ordinal';

export type LastCompleted = {
  ordinal: SessionOrdinal;
  performedOn: string;
  name: string;
};

export type NextUp =
  | {
      kind: 'resume';
      log: WorkoutLog;
      template: SessionTemplate;
      /** Drives the "still training?" prompt on a log left open overnight. */
      staleHours: number;
    }
  | {
      kind: 'start';
      ordinal: SessionOrdinal;
      template: SessionTemplate;
      lastCompleted: LastCompleted | null;
      daysSinceLast: number | null;
    };

async function getTemplateByOrdinal(
  userId: string,
  ordinal: SessionOrdinal,
): Promise<SessionTemplate> {
  const [template] = await db
    .select()
    .from(sessionTemplates)
    .where(and(eq(sessionTemplates.userId, userId), eq(sessionTemplates.ordinal, ordinal)))
    .limit(1);

  if (!template) {
    throw new Error(`No session template at ordinal ${ordinal} for user ${userId}`);
  }
  return template;
}

/**
 * What the dashboard's primary button does.
 *
 * The queue position is *derived*, never stored. A stored pointer desyncs on a
 * deleted log, a backfill, or a crash between two writes (neon-http has no
 * transactions); derivation is idempotent and self-healing, and it costs one
 * indexed read because `templateOrdinal` is denormalised onto the log.
 */
export async function getNextUp(
  userId: string,
  opts: { asOf?: Date; timeZone: string },
): Promise<NextUp> {
  const today = todayIn(opts.timeZone, opts.asOf);

  // 1. An unfinished workout wins over everything else.
  const [active] = await db
    .select()
    .from(workoutLogs)
    .where(and(eq(workoutLogs.userId, userId), eq(workoutLogs.status, 'in_progress')))
    .limit(1); // at most one — enforced by workout_logs_one_active_uq

  if (active) {
    return {
      kind: 'resume',
      log: active,
      template: await getTemplateByOrdinal(userId, assertOrdinal(active.templateOrdinal)),
      staleHours: (Date.now() - active.startedAt.getTime()) / 3_600_000,
    };
  }

  // 2. Otherwise: one after the newest *completed* log.
  //    Abandoned logs are invisible here, so they never advance the cycle.
  //    Rest days live in another table entirely, so they never do either.
  const [last] = await db
    .select({
      ordinal: workoutLogs.templateOrdinal,
      performedOn: workoutLogs.performedOn,
      name: sessionTemplates.name,
    })
    .from(workoutLogs)
    .innerJoin(sessionTemplates, eq(sessionTemplates.id, workoutLogs.templateId))
    .where(and(eq(workoutLogs.userId, userId), eq(workoutLogs.status, 'completed')))
    .orderBy(
      desc(workoutLogs.performedOn),
      desc(workoutLogs.completedAt),
      desc(workoutLogs.id), // deterministic tie-break for same-day logs
    )
    .limit(1);

  const lastCompleted: LastCompleted | null = last
    ? { ordinal: assertOrdinal(last.ordinal), performedOn: last.performedOn, name: last.name }
    : null;

  const ordinal = computeNextOrdinal(lastCompleted?.ordinal ?? null);

  return {
    kind: 'start',
    ordinal,
    template: await getTemplateByOrdinal(userId, ordinal),
    lastCompleted,
    daysSinceLast: lastCompleted ? diffDays(lastCompleted.performedOn, today) : null,
  };
}

/** The "up next" strip: this session plus what follows it. */
export async function getQueuePreview(
  userId: string,
  next: SessionOrdinal,
  count = 4,
): Promise<Array<{ ordinal: SessionOrdinal; template: SessionTemplate }>> {
  const templates = await db
    .select()
    .from(sessionTemplates)
    .where(eq(sessionTemplates.userId, userId));

  const byOrdinal = new Map(templates.map((t) => [t.ordinal, t]));

  return upcomingOrdinals(next, count).flatMap((ordinal) => {
    const template = byOrdinal.get(ordinal);
    return template ? [{ ordinal, template }] : [];
  });
}

/**
 * Suggestion for "log a workout I did on <past date>". Walks *backwards* to
 * the newest completed log on or before that date. Only a suggestion — the
 * form always lets you override, so an out-of-order log is never blocked.
 */
export async function getSuggestedOrdinalForDate(
  userId: string,
  performedOn: string,
): Promise<SessionOrdinal> {
  const [prior] = await db
    .select({ ordinal: workoutLogs.templateOrdinal })
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.userId, userId),
        eq(workoutLogs.status, 'completed'),
        lte(workoutLogs.performedOn, performedOn),
      ),
    )
    .orderBy(desc(workoutLogs.performedOn), desc(workoutLogs.completedAt), desc(workoutLogs.id))
    .limit(1);

  return computeNextOrdinal(prior ? assertOrdinal(prior.ordinal) : null);
}

/** A template plus its exercises, in order — the shape the runner needs. */
export async function getTemplateWithExercises(
  templateId: string,
): Promise<{ template: SessionTemplate; exercises: TemplateExercise[] } | null> {
  const [template] = await db
    .select()
    .from(sessionTemplates)
    .where(eq(sessionTemplates.id, templateId))
    .limit(1);

  if (!template) return null;

  const exercises = await db
    .select()
    .from(templateExercises)
    .where(eq(templateExercises.templateId, templateId))
    .orderBy(asc(templateExercises.orderIndex));

  return { template, exercises };
}
