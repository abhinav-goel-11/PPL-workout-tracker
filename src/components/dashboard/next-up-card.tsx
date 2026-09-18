import Link from 'next/link';
import { ArrowRight, Clock, Flame, PlayCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SplitBadge, type SplitType } from '@/components/split-badge';
import { startWorkout } from '@/server/actions/workout';
import type { NextUp } from '@/lib/queue/next-session';

function DaysSince({ days, name }: { days: number | null; name: string | null }) {
  if (days === null || !name) {
    return <>First session — the cycle starts here.</>;
  }
  if (days === 0) return <>{name} done today.</>;
  if (days === 1) return <>{name} was yesterday.</>;
  return (
    <>
      {name} was {days} days ago.
    </>
  );
}

export function NextUpCard({ nextUp }: { nextUp: NextUp }) {
  const template = nextUp.template;

  if (nextUp.kind === 'resume') {
    const hours = Math.floor(nextUp.staleHours);

    return (
      <section className='border-primary/40 bg-primary/10 rounded-2xl border p-5'>
        <p className='text-primary text-xs font-semibold tracking-wide uppercase'>In progress</p>

        <div className='mt-2 flex items-center gap-2'>
          <h2 className='text-2xl font-semibold tracking-tight'>{template.name}</h2>
          <SplitBadge split={template.splitType as SplitType} />
        </div>

        <p className='text-muted-foreground mt-1 text-sm'>
          {hours < 1 ? 'Started less than an hour ago.' : `Started ${hours}h ago.`}
        </p>

        <Button asChild size='lg' className='mt-4 w-full'>
          <Link href={`/workout/${nextUp.log.id}`}>
            <PlayCircle className='size-5' aria-hidden />
            Resume session
          </Link>
        </Button>
      </section>
    );
  }

  const isWeekend = template.variant === 'weekend_expanded';

  return (
    <section className='border-border bg-surface rounded-2xl border p-5'>
      <p className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
        Next up · session {nextUp.ordinal} of 6
      </p>

      <div className='mt-2 flex items-center gap-2'>
        <h2 className='text-2xl font-semibold tracking-tight'>{template.name}</h2>
        <SplitBadge split={template.splitType as SplitType} />
      </div>

      <p className='text-muted-foreground mt-1 text-sm'>
        <DaysSince days={nextUp.daysSinceLast} name={nextUp.lastCompleted?.name ?? null} />
      </p>

      <div className='text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm'>
        <span className='inline-flex items-center gap-1.5'>
          <Clock className='size-4' aria-hidden />≈ {template.estimatedMinutes} min
        </span>
        {isWeekend ? (
          <span className='text-warning inline-flex items-center gap-1.5'>
            <Flame className='size-4' aria-hidden />
            Expanded session
          </span>
        ) : null}
      </div>

      <form
        action={async () => {
          'use server';
          await startWorkout({});
        }}
      >
        <Button type='submit' size='lg' className='mt-4 w-full'>
          Start {template.name}
          <ArrowRight className='size-5' aria-hidden />
        </Button>
      </form>
    </section>
  );
}
