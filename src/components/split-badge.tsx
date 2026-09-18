import { cn } from '@/lib/utils';

const SPLIT_STYLES = {
  push: 'bg-primary/15 text-primary ring-primary/25',
  pull: 'bg-violet/15 text-violet ring-violet/25',
  legs: 'bg-warning/15 text-warning ring-warning/25',
} as const;

export type SplitType = keyof typeof SPLIT_STYLES;

export function SplitBadge({ split, className }: { split: SplitType; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase ring-1 ring-inset',
        SPLIT_STYLES[split],
        className,
      )}
    >
      {split}
    </span>
  );
}
