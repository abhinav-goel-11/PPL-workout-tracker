import { MUSCLE_LABEL } from '@/lib/analytics/muscle-buckets';
import { formatVolume, type Unit } from '@/lib/units';
import type { MuscleVolumeRow } from '@/server/queries/stats';

/**
 * Twelve muscle groups is well past the point where distinct hues stay
 * distinguishable, so this ranks them by magnitude in a single hue instead —
 * the right encoding for "which muscles got the most work".
 */
export function MuscleBreakdown({ rows, unit }: { rows: MuscleVolumeRow[]; unit: Unit }) {
  if (rows.length === 0) {
    return (
      <p className='text-muted-foreground py-6 text-center text-sm'>
        No completed sets in the last four weeks.
      </p>
    );
  }

  const max = Math.max(...rows.map((r) => r.volumeKg), 1);

  return (
    <ul className='flex flex-col gap-2'>
      {rows.map((row) => (
        <li key={row.muscleGroup}>
          <div className='mb-1 flex items-baseline justify-between gap-2 text-xs'>
            <span className='font-medium'>{MUSCLE_LABEL[row.muscleGroup]}</span>
            <span className='text-muted-foreground tabular-nums'>
              {formatVolume(row.volumeKg, unit)} · {row.workingSets} sets
            </span>
          </div>
          <div className='bg-muted h-2 overflow-hidden rounded-full'>
            <div
              className='h-full rounded-full'
              style={{
                width: `${Math.max(2, (row.volumeKg / max) * 100)}%`,
                backgroundColor: 'var(--chart-1)',
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
