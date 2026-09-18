'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';

import { CALENDAR_SCOPE, signIn } from '@/lib/auth';
import { db } from '@/lib/db';
import { accounts, users, workoutLogs } from '@/lib/db/schema';
import {
  createWorkoutEvent,
  deleteWorkoutEvent,
  findFreeSlot,
  getBusyIntervals,
} from '@/lib/google/calendar';
import { GoogleReauthRequired } from '@/lib/google/token';
import { getNextUp } from '@/lib/queue/next-session';
import { requireUser } from '@/server/queries/user';

/**
 * Incremental auth: the calendar scope is requested here, separately from
 * sign-in, so Google's review of this sensitive scope can never block people
 * from using the rest of the app.
 */
export async function connectCalendar(): Promise<never> {
  await requireUser();

  return signIn(
    'google',
    { redirectTo: '/settings?calendar=connected' },
    {
      scope: `openid email profile ${CALENDAR_SCOPE}`,
      // Required to get a refresh token back at all, and to get one again
      // after the first consent.
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    },
  );
}

export async function disconnectCalendar(): Promise<{ ok: boolean }> {
  const user = await requireUser();

  await db.update(users).set({ calendarSyncEnabled: false }).where(eq(users.id, user.id));

  await db
    .update(accounts)
    .set({ scopeGrantedAt: null })
    .where(and(eq(accounts.userId, user.id), eq(accounts.provider, 'google')));

  revalidatePath('/settings');
  return { ok: true };
}

export async function setCalendarSync(enabled: boolean): Promise<{ ok: boolean }> {
  const user = await requireUser();
  await db.update(users).set({ calendarSyncEnabled: enabled }).where(eq(users.id, user.id));
  revalidatePath('/settings');
  return { ok: true };
}

export type ScheduleResult =
  | { ok: true; scheduledFor: string; sessionName: string }
  | { ok: false; error: string; needsReconnect?: boolean };

/**
 * Finds the next free slot in the user's calendar and puts the upcoming
 * session there.
 */
export async function scheduleNextWorkout(): Promise<ScheduleResult> {
  const user = await requireUser();

  try {
    const nextUp = await getNextUp(user.id, { timeZone: user.timeZone });
    if (nextUp.kind === 'resume') {
      return { ok: false, error: 'Finish the session in progress first.' };
    }

    const busy = await getBusyIntervals(user.id, { calendarId: user.calendarId, days: 4 });

    const slot = findFreeSlot(busy, {
      from: new Date(Date.now() + 30 * 60_000),
      durationMinutes: nextUp.template.estimatedMinutes,
      days: 4,
    });

    if (!slot) {
      return { ok: false, error: 'No free slot in the next four days.' };
    }

    const eventId = await createWorkoutEvent(user.id, {
      logId: `planned-${nextUp.ordinal}`,
      summary: `${nextUp.template.name} — PPL`,
      description: `Session ${nextUp.ordinal} of 6.`,
      start: slot,
      durationMinutes: nextUp.template.estimatedMinutes,
      timeZone: user.timeZone,
      calendarId: user.calendarId,
    });

    revalidatePath('/settings');
    revalidatePath('/dashboard');

    return {
      ok: true,
      scheduledFor: slot.toISOString(),
      sessionName: `${nextUp.template.name} (event ${eventId.slice(0, 6)}…)`,
    };
  } catch (error) {
    if (error instanceof GoogleReauthRequired) {
      return { ok: false, error: 'Google access expired.', needsReconnect: true };
    }
    return { ok: false, error: 'Could not reach Google Calendar.' };
  }
}

export async function removeWorkoutEvent(logId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();

  const [log] = await db
    .select({ calendarEventId: workoutLogs.calendarEventId })
    .from(workoutLogs)
    .where(and(eq(workoutLogs.id, logId), eq(workoutLogs.userId, user.id)))
    .limit(1);

  if (!log?.calendarEventId) return { ok: true };

  try {
    await deleteWorkoutEvent(user.id, log.calendarEventId, user.calendarId);
  } catch {
    // A calendar failure must never block the workout flow.
    return { ok: false };
  }

  await db.update(workoutLogs).set({ calendarEventId: null }).where(eq(workoutLogs.id, logId));

  return { ok: true };
}
