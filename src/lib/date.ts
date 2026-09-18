/**
 * Date helpers for the app's one rule: a workout belongs to a *local calendar
 * day*, never to a UTC instant.
 *
 * Vercel functions run in UTC. `new Date().toISOString().slice(0, 10)` would
 * put a 9pm IST session on the previous day, which silently corrupts streaks
 * and the "newest log wins" ordering the queue depends on. Every "today" in
 * this app goes through `toLocalDateString`.
 */

/** 'YYYY-MM-DD' in the given IANA zone. */
export function toLocalDateString(d: Date, timeZone: string): string {
  // 'en-CA' formats as YYYY-MM-DD, which is exactly the shape we store.
  return new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }).format(d);
}

/** Today, in the user's zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return toLocalDateString(now, timeZone);
}

/** Parse 'YYYY-MM-DD' to a UTC-noon Date — noon avoids DST edge flips. */
export function parseDateString(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** Whole days from `a` to `b`, both 'YYYY-MM-DD'. Positive when b is later. */
export function diffDays(a: string, b: string): number {
  const ms = parseDateString(b).getTime() - parseDateString(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Shift a 'YYYY-MM-DD' by whole days. */
export function addDays(value: string, days: number): string {
  const d = parseDateString(value);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of dates from `start` to `end`. */
export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; diffDays(d, end) >= 0; d = addDays(d, 1)) out.push(d);
  return out;
}

/**
 * Start of the week containing `value`.
 * `weekStartsOn` is 0=Sunday..6=Saturday (1=Monday matches Postgres' ISO week).
 */
export function startOfWeek(value: string, weekStartsOn = 1): string {
  const d = parseDateString(value);
  const shift = (d.getUTCDay() - weekStartsOn + 7) % 7;
  return addDays(value, -shift);
}

/** Week-start dates covering [start, end] inclusive. */
export function eachWeekStart(start: string, end: string, weekStartsOn = 1): string[] {
  const out: string[] = [];
  const last = startOfWeek(end, weekStartsOn);
  for (let w = startOfWeek(start, weekStartsOn); diffDays(w, last) >= 0; w = addDays(w, 7)) {
    out.push(w);
  }
  return out;
}

const SHORT_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** '12 Sep' — for list rows and chart axes. */
export function formatShortDate(value: string): string {
  return SHORT_DATE.format(parseDateString(value));
}

/** 'Today' / 'Yesterday' / '3 days ago' / '12 Sep'. */
export function formatRelativeDay(value: string, today: string): string {
  const delta = diffDays(value, today);
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Yesterday';
  if (delta > 1 && delta < 7) return `${delta} days ago`;
  if (delta === -1) return 'Tomorrow';
  return formatShortDate(value);
}

/** Seconds as m:ss, for rest timers and durations. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
