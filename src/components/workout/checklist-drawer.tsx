'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Sparkles, StretchHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import type { ChecklistItem } from '@/lib/db/routine-data';
import { cn } from '@/lib/utils';

/**
 * Ticks are per-device convenience only — they never reach the server, so
 * localStorage is the right home for them.
 */
function useChecked(storageKey: string) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      // Hydrated after mount: localStorage can't be read during SSR.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setChecked(new Set(JSON.parse(raw) as string[]));
    } catch {
      // Blocked storage: the checklist still works, it just won't persist.
    }
  }, [storageKey]);

  const toggle = useCallback(
    (id: string) => {
      setChecked((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        try {
          localStorage.setItem(storageKey, JSON.stringify([...next]));
        } catch {
          // Non-fatal.
        }
        return next;
      });
    },
    [storageKey],
  );

  const reset = useCallback(() => {
    setChecked(new Set());
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Non-fatal.
    }
  }, [storageKey]);

  return { checked, toggle, reset };
}

export function ChecklistDrawer({
  logId,
  variant,
  title,
  minutes,
  items,
}: {
  logId: string;
  variant: 'warmup' | 'cooldown';
  title: string;
  minutes: number;
  items: ChecklistItem[];
}) {
  const { checked, toggle, reset } = useChecked(`ppl:${variant}:${logId}`);
  const Icon = variant === 'warmup' ? Sparkles : StretchHorizontal;
  const done = items.filter((i) => checked.has(i.id)).length;

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant='outline' size='sm' className='flex-1'>
          <Icon className='size-4' aria-hidden />
          {variant === 'warmup' ? 'Warmup' : 'Cooldown'}
          <span className='text-muted-foreground ml-1 text-xs tabular-nums'>
            {done}/{items.length}
          </span>
        </Button>
      </DrawerTrigger>

      <DrawerContent>
        <div className='mx-auto w-full max-w-lg'>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>About {minutes} minutes.</DrawerDescription>
          </DrawerHeader>

          <ul className='max-h-[55vh] space-y-1 overflow-y-auto px-4 pb-2'>
            {items.map((item) => {
              const isChecked = checked.has(item.id);

              return (
                <li key={item.id}>
                  <button
                    type='button'
                    onClick={() => toggle(item.id)}
                    aria-pressed={isChecked}
                    className='flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors'
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border transition-colors',
                        isChecked
                          ? 'border-success bg-success text-success-foreground'
                          : 'border-border',
                      )}
                    >
                      {isChecked ? (
                        <Check className='size-3.5' strokeWidth={3} aria-hidden />
                      ) : null}
                    </span>

                    <span className='min-w-0'>
                      <span
                        className={cn(
                          'block text-sm',
                          isChecked && 'text-muted-foreground line-through',
                        )}
                      >
                        {item.label}
                      </span>
                      {item.detail ? (
                        <span className='text-muted-foreground block text-xs'>{item.detail}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className='pb-safe px-4 pt-2 pb-4'>
            <Button variant='ghost' size='sm' className='w-full' onClick={reset}>
              Reset checklist
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
