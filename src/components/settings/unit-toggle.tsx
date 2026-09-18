'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { Unit } from '@/lib/units';
import { updateSettings } from '@/server/actions/settings';

export function UnitToggle({ unit }: { unit: Unit }) {
  const [pending, startTransition] = useTransition();

  function choose(next: Unit) {
    if (next === unit) return;
    startTransition(async () => {
      await updateSettings({ unit: next });
      toast.success(`Showing weights in ${next}.`);
    });
  }

  return (
    <div className='flex gap-2'>
      {(['kg', 'lb'] as const).map((option) => (
        <Button
          key={option}
          variant={unit === option ? 'default' : 'outline'}
          size='sm'
          className='flex-1'
          disabled={pending}
          onClick={() => choose(option)}
        >
          {option}
        </Button>
      ))}
    </div>
  );
}
