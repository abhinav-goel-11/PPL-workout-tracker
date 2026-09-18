'use client';

import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatDuration } from '@/lib/date';
import { cn } from '@/lib/utils';

export function RestTimerBar({
  label,
  secondsLeft,
  totalSeconds,
  isElapsed,
  onExtend,
  onStop,
}: {
  label: string;
  secondsLeft: number;
  totalSeconds: number;
  isElapsed: boolean;
  onExtend: (seconds: number) => void;
  onStop: () => void;
}) {
  const progress = totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 1;

  return (
    <div
      role='status'
      aria-live='polite'
      className={cn(
        'pb-safe fixed inset-x-0 bottom-14 z-50 border-t backdrop-blur-lg transition-colors',
        isElapsed ? 'border-success/40 bg-success/15' : 'border-border bg-surface-raised/95',
      )}
    >
      <div
        aria-hidden
        className={cn(
          'h-0.5 origin-left transition-transform',
          isElapsed ? 'bg-success' : 'bg-primary',
        )}
        style={{ transform: `scaleX(${progress})` }}
      />

      <div className='mx-auto flex w-full max-w-lg items-center gap-3 px-4 py-2.5'>
        <div className='min-w-0 flex-1'>
          <p className='text-muted-foreground truncate text-[11px]'>
            {isElapsed ? 'Rest complete' : `Resting · ${label}`}
          </p>
          <p
            className={cn(
              'font-mono text-xl font-semibold tabular-nums',
              isElapsed && 'text-success',
            )}
          >
            {formatDuration(secondsLeft)}
          </p>
        </div>

        <Button type='button' variant='outline' size='sm' onClick={() => onExtend(30)}>
          <Plus className='size-4' aria-hidden />
          30s
        </Button>

        <Button
          type='button'
          variant='ghost'
          size='icon'
          onClick={onStop}
          aria-label='Dismiss rest timer'
        >
          <X className='size-4' aria-hidden />
        </Button>
      </div>
    </div>
  );
}
