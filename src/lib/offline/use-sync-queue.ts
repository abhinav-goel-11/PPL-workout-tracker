'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { acknowledge, readQueue, type QueuedSet } from './queue';
import { syncSetLogs } from '@/server/actions/sets';

const RETRY_INTERVAL_MS = 20_000;
/** Matches the server action's per-call cap. */
const MAX_BATCH = 50;

export type SyncState = {
  pendingCount: number;
  isFlushing: boolean;
  isOffline: boolean;
  lastError: string | null;
};

/**
 * Drains the offline queue whenever there is a plausible reason to believe the
 * network is back: on `online`, when the tab is shown again, and on a slow
 * interval while anything is still pending.
 */
export function useSyncQueue(logId: string) {
  const [state, setState] = useState<SyncState>({
    pendingCount: 0,
    isFlushing: false,
    isOffline: false,
    lastError: null,
  });

  // Guards against two flushes overlapping and double-sending the same batch.
  const flushing = useRef(false);

  const refreshCount = useCallback(() => {
    setState((s) => ({ ...s, pendingCount: readQueue(logId).length }));
  }, [logId]);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    if (readQueue(logId).length === 0) {
      setState((s) => ({ ...s, pendingCount: 0, lastError: null }));
      return;
    }

    flushing.current = true;
    setState((s) => ({ ...s, isFlushing: true }));

    try {
      // Drain in batches rather than recursing, so a long backlog can't blow
      // the stack and the guard above stays meaningful.
      for (;;) {
        const entries = readQueue(logId);
        if (entries.length === 0) {
          setState({ pendingCount: 0, isFlushing: false, isOffline: false, lastError: null });
          return;
        }

        const batch: QueuedSet[] = entries.slice(0, MAX_BATCH);
        const sentAt = Date.now();

        const result = await syncSetLogs({
          logId,
          entries: batch.map((e) => ({
            clientSetId: e.clientSetId,
            templateExerciseId: e.templateExerciseId,
            setIndex: e.setIndex,
            weightKg: e.weightKg,
            reps: e.reps,
            durationSeconds: e.durationSeconds,
            rpe: e.rpe,
            isCompleted: e.isCompleted,
            isWarmup: e.isWarmup,
          })),
        });

        if (result.ok) {
          const remaining = acknowledge(logId, result.syncedClientSetIds, sentAt);
          if (remaining.length === 0) {
            setState({ pendingCount: 0, isFlushing: false, isOffline: false, lastError: null });
            return;
          }
          continue;
        }

        // Not retryable (validation error, deleted workout): drop the batch
        // rather than retrying a poisoned entry forever.
        if (!result.retryable) {
          acknowledge(
            logId,
            batch.map((e) => e.clientSetId),
            sentAt,
          );
          continue;
        }

        setState((s) => ({
          ...s,
          isFlushing: false,
          pendingCount: readQueue(logId).length,
          lastError: result.error,
        }));
        return;
      }
    } catch {
      setState((s) => ({
        ...s,
        isFlushing: false,
        isOffline: true,
        pendingCount: readQueue(logId).length,
        lastError: 'Offline — your sets are saved on this device.',
      }));
    } finally {
      flushing.current = false;
    }
  }, [logId]);

  useEffect(() => {
    // Reads the persisted queue depth after mount — not available on the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshCount();

    const onOnline = () => {
      setState((s) => ({ ...s, isOffline: false }));
      void flush();
    };
    const onOffline = () => setState((s) => ({ ...s, isOffline: true }));
    const onVisible = () => {
      if (document.visibilityState === 'visible') void flush();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);

    const interval = setInterval(() => {
      if (readQueue(logId).length > 0) void flush();
    }, RETRY_INTERVAL_MS);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setState((s) => ({ ...s, isOffline: true }));
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [flush, logId, refreshCount]);

  return { ...state, flush, refreshCount };
}
