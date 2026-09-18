import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Dumbbell, Moon } from 'lucide-react';

import { PageHeader } from '@/components/app-shell';
import { SplitBadge } from '@/components/split-badge';
import { formatRelativeDay } from '@/lib/date';
import { todayIn } from '@/lib/date';
import { formatVolume } from '@/lib/units';
import { getHistory } from '@/server/queries/history';
import { requireUser } from '@/server/queries/user';

export const metadata: Metadata = { title: 'History' };

const REST_LABEL: Record<string, string> = {
  planned: 'Rest day',
  active_recovery: 'Active recovery',
  sick: 'Sick day',
  travel: 'Travel',
};

export default async function HistoryPage() {
  const user = await requireUser();
  const entries = await getHistory(user);
  const today = todayIn(user.timeZone);

  return (
    <main>
      <PageHeader title='History' subtitle='Last 90 days of sessions and rest days.' />

      {entries.length === 0 ? (
        <p className='text-muted-foreground border-border rounded-xl border border-dashed p-8 text-center text-sm'>
          Nothing logged yet. Your first session will show up here.
        </p>
      ) : (
        <ol className='flex flex-col gap-2'>
          {entries.map((entry) =>
            entry.kind === 'workout' ? (
              <li key={entry.id}>
                <Link
                  href={`/history/${entry.id}`}
                  className='border-border bg-surface hover:border-primary/40 flex items-center gap-3 rounded-xl border p-3.5 transition-colors'
                >
                  <span className='bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg'>
                    <Dumbbell className='size-4' aria-hidden />
                  </span>

                  <span className='min-w-0 flex-1'>
                    <span className='flex items-center gap-2'>
                      <span className='truncate text-sm font-medium'>{entry.name}</span>
                      <SplitBadge split={entry.splitType} />
                    </span>
                    <span className='text-muted-foreground mt-0.5 block text-xs'>
                      {formatRelativeDay(entry.date, today)} · {entry.sets} sets ·{' '}
                      {formatVolume(entry.volumeKg, user.unit)}
                      {entry.durationMinutes ? ` · ${entry.durationMinutes} min` : ''}
                    </span>
                  </span>

                  <ChevronRight className='text-muted-foreground size-4 shrink-0' aria-hidden />
                </Link>
              </li>
            ) : (
              <li
                key={entry.id}
                className='border-border/60 flex items-center gap-3 rounded-xl border border-dashed p-3.5'
              >
                <span className='bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg'>
                  <Moon className='size-4' aria-hidden />
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block text-sm font-medium'>
                    {REST_LABEL[entry.restKind] ?? 'Rest day'}
                  </span>
                  <span className='text-muted-foreground mt-0.5 block text-xs'>
                    {formatRelativeDay(entry.date, today)}
                    {entry.note ? ` · ${entry.note}` : ''}
                  </span>
                </span>
              </li>
            ),
          )}
        </ol>
      )}
    </main>
  );
}
