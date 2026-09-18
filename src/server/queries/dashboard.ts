import 'server-only';

import { and, desc, eq, gte } from 'drizzle-orm';

import { db } from '@/lib/db';
import { addDays, todayIn } from '@/lib/date';
import { getStreak, type StreakSummary } from '@/lib/analytics/streak';
import { restDays, sessionTemplates, workoutLogs, type RestKind, type User } from '@/lib/db/schema';
import { getNextUp, getQueuePreview, type NextUp } from '@/lib/queue/next-session';
import type { SessionOrdinal } from '@/lib/queue/ordinal';

export type DayCell =
  | { date: string; kind: 'workout'; label: string; ordinal: number; logId: string }
  | { date: string; kind: 'rest'; restKind: RestKind }
  | { date: string; kind: 'empty' };

export type DashboardData = {
  today: string;
  nextUp: NextUp;
  preview: Array<{
    ordinal: SessionOrdinal;
    template: { id: string; name: string; splitType: 'push' | 'pull' | 'legs' };
  }>;
  streak: StreakSummary;
  days: DayCell[];
  restedToday: boolean;
};

const WINDOW_DAYS = 14;

export async function getDashboardData(user: User): Promise<DashboardData> {
  const today = todayIn(user.timeZone);
  const since = addDays(today, -(WINDOW_DAYS - 1));

  const nextUp = await getNextUp(user.id, { timeZone: user.timeZone });
  const nextOrdinal =
    nextUp.kind === 'resume' ? (nextUp.log.templateOrdinal as SessionOrdinal) : nextUp.ordinal;

  const [preview, streak, recentWorkouts, recentRest] = await Promise.all([
    getQueuePreview(user.id, nextOrdinal, 4),
    getStreak(user.id, { today }),
    db
      .select({
        id: workoutLogs.id,
        performedOn: workoutLogs.performedOn,
        ordinal: workoutLogs.templateOrdinal,
        name: sessionTemplates.name,
      })
      .from(workoutLogs)
      .innerJoin(sessionTemplates, eq(sessionTemplates.id, workoutLogs.templateId))
      .where(
        and(
          eq(workoutLogs.userId, user.id),
          eq(workoutLogs.status, 'completed'),
          gte(workoutLogs.performedOn, since),
        ),
      )
      .orderBy(desc(workoutLogs.performedOn)),
    db
      .select({ date: restDays.date, kind: restDays.kind })
      .from(restDays)
      .where(and(eq(restDays.userId, user.id), gte(restDays.date, since))),
  ]);

  const workoutByDate = new Map(recentWorkouts.map((w) => [w.performedOn, w]));
  const restByDate = new Map(recentRest.map((r) => [r.date, r]));

  const days: DayCell[] = Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const date = addDays(since, i);
    const workout = workoutByDate.get(date);
    if (workout) {
      return {
        date,
        kind: 'workout',
        label: workout.name,
        ordinal: workout.ordinal,
        logId: workout.id,
      };
    }
    const rest = restByDate.get(date);
    if (rest) return { date, kind: 'rest', restKind: rest.kind };
    return { date, kind: 'empty' };
  });

  return {
    today,
    nextUp,
    preview: preview.map((p) => ({
      ordinal: p.ordinal,
      template: {
        id: p.template.id,
        name: p.template.name,
        splitType: p.template.splitType,
      },
    })),
    streak,
    days,
    restedToday: restByDate.has(today),
  };
}
