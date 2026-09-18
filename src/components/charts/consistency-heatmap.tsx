import { addDays, diffDays, parseDateString } from '@/lib/date';
import { cn } from '@/lib/utils';

const WEEKS = 16;

/**
 * A CSS grid, not a charting library: it's a calendar of squares, and recharts
 * would cost 100KB to draw rectangles.
 */
export function ConsistencyHeatmap({
  activeDays,
  today,
  weekStartsOn = 1,
}: {
  activeDays: string[];
  today: string;
  weekStartsOn?: number;
}) {
  const active = new Set(activeDays);

  // Walk back to the start of the week WEEKS ago so columns line up.
  const todayDow = parseDateString(today).getUTCDay();
  const intoWeek = (todayDow - weekStartsOn + 7) % 7;
  const start = addDays(today, -(intoWeek + (WEEKS - 1) * 7));

  const columns = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)),
  );

  return (
    <div className='flex gap-1 overflow-x-auto pb-1'>
      {columns.map((week) => (
        <div key={week[0]} className='flex flex-col gap-1'>
          {week.map((date) => {
            const isFuture = diffDays(date, today) < 0;
            const trained = active.has(date);

            return (
              <span
                key={date}
                title={`${date}${trained ? ' · trained' : ''}`}
                className={cn(
                  'size-3 rounded-[3px]',
                  isFuture ? 'bg-transparent' : trained ? 'bg-primary' : 'bg-muted',
                  date === today && 'ring-primary/60 ring-2',
                )}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
