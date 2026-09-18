'use client';

import { useTransition } from 'react';
import { Moon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { deleteRestDay, logRestDay } from '@/server/actions/rest-days';

export function RestDayButton({ restedToday, today }: { restedToday: boolean; today: string }) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      if (restedToday) {
        await deleteRestDay(today);
        toast('Rest day removed.');
        return;
      }
      await logRestDay({});
      toast.success('Rest day logged.', {
        description: 'Your place in the cycle is unchanged.',
      });
    });
  }

  return (
    <Button
      type='button'
      variant={restedToday ? 'secondary' : 'outline'}
      className='w-full'
      onClick={toggle}
      disabled={pending}
    >
      <Moon className='size-4' aria-hidden />
      {restedToday ? 'Rest day logged — undo' : 'Log rest day today'}
    </Button>
  );
}
