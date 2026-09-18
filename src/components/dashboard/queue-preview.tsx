import { SplitBadge, type SplitType } from '@/components/split-badge';
import type { SessionOrdinal } from '@/lib/queue/ordinal';

type Item = {
  ordinal: SessionOrdinal;
  template: { id: string; name: string; splitType: SplitType };
};

export function QueuePreview({ items }: { items: Item[] }) {
  if (items.length <= 1) return null;

  return (
    <section>
      <h2 className='text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase'>
        Then
      </h2>
      <ol className='flex gap-2 overflow-x-auto pb-1'>
        {items.slice(1).map((item) => (
          <li
            key={item.template.id}
            className='border-border bg-surface flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2'
          >
            <span className='text-muted-foreground text-xs tabular-nums'>{item.ordinal}</span>
            <span className='text-sm font-medium'>{item.template.name}</span>
            <SplitBadge split={item.template.splitType} />
          </li>
        ))}
      </ol>
    </section>
  );
}
