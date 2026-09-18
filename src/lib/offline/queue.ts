/**
 * A localStorage write-ahead log for set entries.
 *
 * Every set change is written here *before* the server action is called, and
 * only removed once the server acknowledges it. A gym with no signal therefore
 * loses nothing: entries pile up and flush when the connection returns.
 *
 * Safe because the server upserts on the (log, exercise, setIndex) slot, so
 * replaying an entry twice is indistinguishable from sending it once.
 */

export type QueuedSet = {
  clientSetId: string;
  templateExerciseId: string;
  setIndex: number;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  rpe: number | null;
  isCompleted: boolean;
  isWarmup: boolean;
  /** Epoch ms — later entries for the same slot win. */
  updatedAt: number;
};

const keyFor = (logId: string) => `ppl:queue:${logId}`;
const slotOf = (e: Pick<QueuedSet, 'templateExerciseId' | 'setIndex'>) =>
  `${e.templateExerciseId}:${e.setIndex}`;

/**
 * Every read and write is guarded: localStorage throws outright in some
 * contexts (Safari private mode, blocked site data) and returns empty in
 * others. A failure here must never break the workout.
 */
function readRaw(logId: string): QueuedSet[] {
  try {
    const raw = localStorage.getItem(keyFor(logId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedSet[]) : [];
  } catch {
    return [];
  }
}

function writeRaw(logId: string, entries: QueuedSet[]): void {
  try {
    if (entries.length === 0) localStorage.removeItem(keyFor(logId));
    else localStorage.setItem(keyFor(logId), JSON.stringify(entries));
  } catch {
    // Out of quota or blocked — the in-memory optimistic state still holds,
    // and the server action is still attempted.
  }
}

export function readQueue(logId: string): QueuedSet[] {
  return readRaw(logId);
}

/** Adds or replaces the entry for a slot; latest write wins. */
export function enqueue(logId: string, entry: QueuedSet): QueuedSet[] {
  const entries = readRaw(logId).filter((e) => slotOf(e) !== slotOf(entry));
  entries.push(entry);
  writeRaw(logId, entries);
  return entries;
}

/** Drops acknowledged entries, keeping any that changed while in flight. */
export function acknowledge(logId: string, acked: string[], sentAt: number): QueuedSet[] {
  const ackedIds = new Set(acked);
  const remaining = readRaw(logId).filter(
    (e) => !ackedIds.has(e.clientSetId) || e.updatedAt > sentAt,
  );
  writeRaw(logId, remaining);
  return remaining;
}

export function clearQueue(logId: string): void {
  writeRaw(logId, []);
}

/** The subset of a set row the queue is allowed to override. */
export type MergeableSet = {
  templateExerciseId: string | null;
  setIndex: number;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  rpe: number | null;
  isCompleted: boolean;
  isWarmup: boolean;
};

/**
 * Server rows are the source of truth except where a queued entry is still
 * unacknowledged — so reloading the page mid-blackout doesn't lose work.
 * `pending` marks rows the server hasn't confirmed yet, for the dim/check UI.
 */
export function mergeQueued<T extends MergeableSet>(
  serverSets: T[],
  queued: QueuedSet[],
): Array<T & { pending: boolean }> {
  const bySlot = new Map(queued.map((q) => [slotOf(q), q]));

  return serverSets.map((set) => {
    const pending = set.templateExerciseId
      ? bySlot.get(`${set.templateExerciseId}:${set.setIndex}`)
      : undefined;

    if (!pending) return { ...set, pending: false };

    return {
      ...set,
      weightKg: pending.weightKg,
      reps: pending.reps,
      durationSeconds: pending.durationSeconds,
      rpe: pending.rpe,
      isCompleted: pending.isCompleted,
      isWarmup: pending.isWarmup,
      pending: true,
    };
  });
}
