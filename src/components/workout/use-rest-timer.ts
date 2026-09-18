'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Persisted = { endsAt: number; label: string; total: number };

const TICK_MS = 250;
const keyFor = (logId: string) => `ppl:rest:${logId}`;

function read(logId: string): Persisted | null {
  try {
    const raw = localStorage.getItem(keyFor(logId));
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}

function write(logId: string, value: Persisted | null): void {
  try {
    if (value) localStorage.setItem(keyFor(logId), JSON.stringify(value));
    else localStorage.removeItem(keyFor(logId));
  } catch {
    // Non-fatal: the timer still runs from in-memory state this session.
  }
}

/**
 * Rest timer state.
 *
 * The timer is an *absolute end time*, never a decrementing counter: mobile
 * browsers throttle background intervals to once a minute and iOS suspends
 * them entirely, so a counter would be minutes wrong on return. The interval
 * here only triggers a re-render; the remaining time is always recomputed
 * from `endsAt`.
 */
export function useRestTimer(logId: string) {
  const [session, setSession] = useState<Persisted | null>(null);
  const [remaining, setRemaining] = useState(0);
  const audioRef = useRef<AudioContext | null>(null);
  const firedRef = useRef(false);

  // Restore an in-flight rest across a reload or an app switch.
  useEffect(() => {
    const stored = read(logId);
    if (stored && stored.endsAt > Date.now()) {
      // Restored after mount: localStorage can't be read during SSR.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSession(stored);
      firedRef.current = false;
    } else if (stored) {
      write(logId, null);
    }
  }, [logId]);

  const chime = useCallback(() => {
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      // Unsupported on iOS Safari — the sound and the visual state remain.
    }

    const ctx = audioRef.current;
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // Audio blocked; vibration and the UI still signal the end of rest.
    }
  }, []);

  const recompute = useCallback(() => {
    setSession((current) => {
      if (!current) return current;
      const left = Math.max(0, current.endsAt - Date.now());
      setRemaining(left);

      if (left === 0 && !firedRef.current) {
        firedRef.current = true;
        chime();
      }
      return current;
    });
  }, [chime]);

  useEffect(() => {
    if (!session) return;

    recompute();
    const id = setInterval(recompute, TICK_MS);

    // Coming back from a backgrounded tab: recompute immediately rather than
    // waiting for the next throttled tick.
    const onWake = () => recompute();
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('pageshow', onWake);
    window.addEventListener('focus', onWake);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('pageshow', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [recompute, session]);

  /**
   * iOS only allows an AudioContext to be created or resumed inside a user
   * gesture, so it is primed on the first set tap and reused thereafter.
   */
  const primeAudio = useCallback(() => {
    try {
      audioRef.current ??= new AudioContext();
      if (audioRef.current.state === 'suspended') void audioRef.current.resume();
    } catch {
      audioRef.current = null;
    }
  }, []);

  const start = useCallback(
    (seconds: number, label: string) => {
      if (seconds <= 0) return;
      const next = { endsAt: Date.now() + seconds * 1000, label, total: seconds };
      firedRef.current = false;
      write(logId, next);
      setSession(next);
      setRemaining(seconds * 1000);
    },
    [logId],
  );

  const stop = useCallback(() => {
    write(logId, null);
    setSession(null);
    setRemaining(0);
    firedRef.current = false;
  }, [logId]);

  const extend = useCallback(
    (seconds: number) => {
      setSession((current) => {
        if (!current) return current;
        // Extend from *now* when it has already elapsed, not from a past end.
        const base = Math.max(current.endsAt, Date.now());
        const next = { ...current, endsAt: base + seconds * 1000, total: current.total + seconds };
        write(logId, next);
        firedRef.current = false;
        return next;
      });
    },
    [logId],
  );

  return {
    isActive: session !== null,
    label: session?.label ?? '',
    secondsLeft: Math.ceil(remaining / 1000),
    totalSeconds: session?.total ?? 0,
    isElapsed: session !== null && remaining === 0,
    start,
    stop,
    extend,
    primeAudio,
  };
}
