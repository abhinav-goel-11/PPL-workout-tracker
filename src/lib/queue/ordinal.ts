/**
 * The rolling PPL cycle, as pure arithmetic. No DB, no imports — every edge
 * case in `next-session.ts` reduces to these functions plus a single query.
 */

export const CYCLE_LENGTH = 6;

export type SessionOrdinal = 1 | 2 | 3 | 4 | 5 | 6;

export function isOrdinal(n: number): n is SessionOrdinal {
  return Number.isInteger(n) && n >= 1 && n <= CYCLE_LENGTH;
}

export function assertOrdinal(n: number): SessionOrdinal {
  if (!isOrdinal(n)) throw new Error(`Not a session ordinal: ${n}`);
  return n;
}

/**
 * The contract the whole app rests on: next up is one after whatever you last
 * *completed*. Rest days, abandoned sessions and the wall calendar don't enter
 * into it — which is why the sequence can never break.
 */
export function computeNextOrdinal(last: SessionOrdinal | null): SessionOrdinal {
  if (last === null) return 1;
  return ((last % CYCLE_LENGTH) + 1) as SessionOrdinal;
}

/** Walk the cycle forwards or backwards, wrapping at both ends. */
export function advanceOrdinal(ordinal: SessionOrdinal, by = 1): SessionOrdinal {
  const zeroBased = (((ordinal - 1 + by) % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH;
  return (zeroBased + 1) as SessionOrdinal;
}

/** The next `count` positions starting at `next`, for the "up next" strip. */
export function upcomingOrdinals(next: SessionOrdinal, count = CYCLE_LENGTH): SessionOrdinal[] {
  return Array.from({ length: count }, (_, i) => advanceOrdinal(next, i));
}
