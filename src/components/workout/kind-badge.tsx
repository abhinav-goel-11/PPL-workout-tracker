import { Flame, Repeat, Timer, Zap } from 'lucide-react';

import type { ExerciseKind } from '@/lib/db/schema';
import { cn } from '@/lib/utils';

const KIND_META: Partial<
  Record<ExerciseKind, { label: string; icon: typeof Zap; className: string }>
> = {
  cardio_superset: {
    label: 'Cardio superset',
    icon: Zap,
    className: 'bg-cardio/15 text-cardio ring-cardio/30',
  },
  finisher_circuit: {
    label: 'Circuit',
    icon: Repeat,
    className: 'bg-cardio/15 text-cardio ring-cardio/30',
  },
  cardio_finisher: {
    label: 'Cardio finisher',
    icon: Flame,
    className: 'bg-cardio/15 text-cardio ring-cardio/30',
  },
  tri_set: {
    label: 'Tri-set',
    icon: Timer,
    className: 'bg-violet/15 text-violet ring-violet/30',
  },
};

export function KindBadge({ kind, className }: { kind: ExerciseKind; className?: string }) {
  const meta = KIND_META[kind];
  if (!meta) return null;

  const Icon = meta.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ring-1 ring-inset',
        meta.className,
        className,
      )}
    >
      <Icon className='size-3' aria-hidden />
      {meta.label}
    </span>
  );
}
