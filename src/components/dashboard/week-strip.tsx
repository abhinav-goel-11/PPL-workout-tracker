import Link from 'next/link';
import { Dumbbell, Moon } from 'lucide-react';

import type { DayCell } from '@/server/queries/dashboard';
import { parseDateString } from '@/lib/date';
import { cn } from '@/lib/utils';

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'narrow', timeZone: 'UTC' });

export function WeekStrip({ days, today }: { days: DayCell[]; today: string }) {
  return (
    <ol className='grid grid-cols-7 gap-1.5'>
      {days.map((day) => {
        const isToday = day.date === today;
        const d = parseDateString(day.date);

        const cell = (
          <div
            className={cn(
              'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border text-[10px] transition-colors',
              day.kind === 'workout' && 'border-primary/40 bg-primary/15 text-primary',
              day.kind === 'rest' && 'border-border bg-muted/40 text-muted-foreground',
              day.kind === 'empty' && 'border-border/60 text-muted-foreground/50 border-dashed',
              isToday && 'ring-primary ring-2 ring-offset-1 ring-offset-transparent',
            )}
          >
            {day.kind === 'workout' ? (
              <Dumbbell className='size-3.5' aria-hidden />
            ) : day.kind === 'rest' ? (
              <Moon className='size-3.5' aria-hidden />
            ) : null}
            <span className='font-medium'>{d.getUTCDate()}</span>
          </div>
        );

        return (
          <li key={day.date}>
            <span className='text-muted-foreground mb-1 block text-center text-[10px]'>
              {WEEKDAY.format(d)}
            </span>
            {day.kind === 'workout' ? (
              <Link
                href={`/history/${day.logId}`}
                aria-label={`${day.label} on ${day.date}`}
                className='block'
              >
                {cell}
              </Link>
            ) : (
              <span aria-label={day.kind === 'rest' ? `Rest day ${day.date}` : day.date}>
                {cell}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
