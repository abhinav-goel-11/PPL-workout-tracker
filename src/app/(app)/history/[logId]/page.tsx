import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { SplitBadge } from '@/components/split-badge';
import { Button } from '@/components/ui/button';
import { formatShortDate } from '@/lib/date';
import { formatVolume, formatWeight } from '@/lib/units';
import { getWorkoutSummary } from '@/server/queries/history';
import { requireUser } from '@/server/queries/user';

export const metadata: Metadata = { title: 'Session detail' };

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ logId: string }>;
}) {
  const { logId } = await params;
  const user = await requireUser();

  const summary = await getWorkoutSummary(logId, user.id);
  if (!summary) notFound();

  return (
    <main>
      <Button asChild variant='ghost' size='sm' className='text-muted-foreground mb-3 -ml-2'>
        <Link href='/history'>
          <ArrowLeft className='size-4' aria-hidden />
          History
        </Link>
      </Button>

      <div className='flex items-center gap-2'>
        <h1 className='text-2xl font-semibold tracking-tight'>{summary.name}</h1>
        <SplitBadge split={summary.splitType} />
      </div>

      <p className='text-muted-foreground mt-1 text-sm'>
        {formatShortDate(summary.date)} · session {summary.ordinal} of 6
        {summary.durationMinutes ? ` · ${summary.durationMinutes} min` : ''} ·{' '}
        {formatVolume(summary.totalVolumeKg, user.unit)} total
      </p>

      {summary.notes ? (
        <p className='border-border bg-surface mt-4 rounded-xl border p-3 text-sm'>
          {summary.notes}
        </p>
      ) : null}

      <div className='mt-5 flex flex-col gap-3'>
        {summary.exercises.map((exercise) => (
          <section key={exercise.name} className='border-border bg-surface rounded-xl border p-4'>
            <h2 className='text-sm font-semibold'>{exercise.name}</h2>
            <ul className='mt-2 flex flex-wrap gap-1.5'>
              {exercise.sets.map((set) => (
                <li
                  key={set.setIndex}
                  className='bg-muted rounded-md px-2 py-1 text-xs tabular-nums'
                >
                  {set.durationSeconds != null
                    ? `${set.durationSeconds}s`
                    : `${formatWeight(set.weightKg, user.unit)} × ${set.reps ?? '—'}`}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
