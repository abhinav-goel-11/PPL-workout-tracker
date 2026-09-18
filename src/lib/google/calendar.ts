import 'server-only';

import { getGoogleAccessToken } from './token';

const BASE = 'https://www.googleapis.com/calendar/v3';

export type BusyInterval = { start: string; end: string };

/**
 * Busy intervals for the next few days.
 *
 * freeBusy rather than events.list on purpose: it returns only time ranges,
 * never event titles, so scheduling a workout doesn't require reading the
 * contents of the user's calendar.
 */
export async function getBusyIntervals(
  userId: string,
  opts: { calendarId?: string; days?: number } = {},
): Promise<BusyInterval[]> {
  const token = await getGoogleAccessToken(userId);
  const calendarId = opts.calendarId ?? 'primary';
  const now = new Date();
  const end = new Date(now.getTime() + (opts.days ?? 4) * 86_400_000);

  const response = await fetch(`${BASE}/freeBusy`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      items: [{ id: calendarId }],
    }),
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(`freeBusy failed: ${response.status}`);

  const json = (await response.json()) as {
    calendars?: Record<string, { busy?: BusyInterval[] }>;
  };

  return json.calendars?.[calendarId]?.busy ?? [];
}

export type WorkoutEventInput = {
  logId: string;
  summary: string;
  description?: string;
  start: Date;
  durationMinutes: number;
  timeZone: string;
  calendarId?: string;
};

/** Creates the workout event and returns its id for `workout_logs`. */
export async function createWorkoutEvent(
  userId: string,
  input: WorkoutEventInput,
): Promise<string> {
  const token = await getGoogleAccessToken(userId);
  const calendarId = input.calendarId ?? 'primary';
  const end = new Date(input.start.getTime() + input.durationMinutes * 60_000);

  const response = await fetch(`${BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.start.toISOString(), timeZone: input.timeZone },
      end: { dateTime: end.toISOString(), timeZone: input.timeZone },
      // A recovery path if the stored calendarEventId is ever lost: the
      // event can be found again by this private property.
      extendedProperties: { private: { pplWorkoutLogId: input.logId } },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] },
    }),
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(`Calendar event create failed: ${response.status}`);

  const json = (await response.json()) as { id: string };
  return json.id;
}

export async function patchWorkoutEvent(
  userId: string,
  eventId: string,
  patch: Record<string, unknown>,
  calendarId = 'primary',
): Promise<void> {
  const token = await getGoogleAccessToken(userId);

  const response = await fetch(
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(patch),
      cache: 'no-store',
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Calendar event patch failed: ${response.status}`);
  }
}

export async function deleteWorkoutEvent(
  userId: string,
  eventId: string,
  calendarId = 'primary',
): Promise<void> {
  const token = await getGoogleAccessToken(userId);

  const response = await fetch(
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
  );

  // 404/410 mean it's already gone, which is the desired end state.
  if (!response.ok && ![404, 410].includes(response.status)) {
    throw new Error(`Calendar event delete failed: ${response.status}`);
  }
}

/**
 * First slot of at least `durationMinutes` that doesn't collide with a busy
 * interval, searched within a daily training window.
 */
export function findFreeSlot(
  busy: BusyInterval[],
  opts: {
    from: Date;
    durationMinutes: number;
    windowStartHour?: number;
    windowEndHour?: number;
    days?: number;
  },
): Date | null {
  const startHour = opts.windowStartHour ?? 6;
  const endHour = opts.windowEndHour ?? 21;
  const durationMs = opts.durationMinutes * 60_000;

  const intervals = busy
    .map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }))
    .sort((a, b) => a.start - b.start);

  for (let day = 0; day < (opts.days ?? 4); day++) {
    const dayStart = new Date(opts.from);
    dayStart.setDate(dayStart.getDate() + day);
    dayStart.setHours(startHour, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setHours(endHour, 0, 0, 0);

    let cursor = Math.max(dayStart.getTime(), opts.from.getTime());

    for (const interval of intervals) {
      if (interval.end <= cursor) continue;
      if (interval.start >= dayEnd.getTime()) break;

      if (interval.start - cursor >= durationMs) return new Date(cursor);
      cursor = Math.max(cursor, interval.end);
    }

    if (dayEnd.getTime() - cursor >= durationMs) return new Date(cursor);
  }

  return null;
}
