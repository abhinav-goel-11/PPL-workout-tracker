import { describe, expect, it } from 'vitest';

import {
  CYCLE_LENGTH,
  advanceOrdinal,
  assertOrdinal,
  computeNextOrdinal,
  isOrdinal,
  upcomingOrdinals,
  type SessionOrdinal,
} from './ordinal';

describe('computeNextOrdinal', () => {
  it('starts a brand-new user at session 1', () => {
    expect(computeNextOrdinal(null)).toBe(1);
  });

  it('advances one step through the cycle', () => {
    expect(computeNextOrdinal(1)).toBe(2);
    expect(computeNextOrdinal(4)).toBe(5);
  });

  it('wraps 6 back to 1 so the cycle rolls indefinitely', () => {
    expect(computeNextOrdinal(6)).toBe(1);
  });

  it('returns to the start after a full lap', () => {
    let o: SessionOrdinal = 1;
    for (let i = 0; i < CYCLE_LENGTH; i++) o = computeNextOrdinal(o);
    expect(o).toBe(1);
  });

  it('picks up from wherever you jumped to, out of order', () => {
    // User skips ahead to Pull B (5); next must be Legs B (6), not Push A.
    expect(computeNextOrdinal(5)).toBe(6);
  });
});

describe('advanceOrdinal', () => {
  it('is identity for 0', () => {
    expect(advanceOrdinal(3, 0)).toBe(3);
  });

  it('wraps forwards past the end', () => {
    expect(advanceOrdinal(5, 3)).toBe(2);
  });

  it('wraps backwards past the start', () => {
    expect(advanceOrdinal(1, -1)).toBe(6);
    expect(advanceOrdinal(2, -5)).toBe(3);
  });

  it('is stable across whole laps', () => {
    expect(advanceOrdinal(4, CYCLE_LENGTH * 3)).toBe(4);
  });
});

describe('upcomingOrdinals', () => {
  it('lists the full cycle starting at next', () => {
    expect(upcomingOrdinals(4)).toEqual([4, 5, 6, 1, 2, 3]);
  });

  it('honours a shorter count', () => {
    expect(upcomingOrdinals(6, 3)).toEqual([6, 1, 2]);
  });
});

describe('isOrdinal / assertOrdinal', () => {
  it('accepts 1..6 only', () => {
    expect([0, 7, -1, 1.5, NaN].every((n) => !isOrdinal(n))).toBe(true);
    expect([1, 2, 3, 4, 5, 6].every(isOrdinal)).toBe(true);
  });

  it('throws on a corrupt stored ordinal rather than silently wrapping', () => {
    expect(() => assertOrdinal(0)).toThrow();
    expect(() => assertOrdinal(9)).toThrow();
  });
});
