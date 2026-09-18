'use client';

import { useEffect } from 'react';

import { updateTimeZone } from '@/server/actions/settings';

/**
 * Every "today" in this app is resolved in the user's zone, so the stored zone
 * has to be right. Reports the browser's zone once, whenever it disagrees.
 */
export function TimeZoneSync({ stored }: { stored: string }) {
  useEffect(() => {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browser || browser === stored) return;
    void updateTimeZone(browser);
  }, [stored]);

  return null;
}
