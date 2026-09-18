'use client';

import { useTransition } from 'react';
import { CalendarCheck, CalendarPlus, Loader2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  connectCalendar,
  disconnectCalendar,
  scheduleNextWorkout,
} from '@/server/actions/calendar';

export function CalendarCard({
  connected,
  requiresReauth,
}: {
  connected: boolean;
  requiresReauth: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function schedule() {
    startTransition(async () => {
      const result = await scheduleNextWorkout();

      if (!result.ok) {
        toast.error(result.error, {
          description: result.needsReconnect ? 'Reconnect Google to continue.' : undefined,
        });
        return;
      }

      toast.success('Added to your calendar.', {
        description: new Date(result.scheduledFor).toLocaleString(),
      });
    });
  }

  return (
    <section className='border-border bg-surface rounded-2xl border p-4'>
      <h2 className='text-sm font-semibold'>Google Calendar</h2>

      {requiresReauth ? (
        <p className='text-warning mt-2 flex items-start gap-2 text-xs'>
          <TriangleAlert className='mt-0.5 size-3.5 shrink-0' aria-hidden />
          Access was revoked or expired. Reconnect to schedule sessions again.
        </p>
      ) : (
        <p className='text-muted-foreground mt-1 text-xs'>
          {connected
            ? 'Connected. Your next session can be placed in the first free slot.'
            : 'Connect to find a free slot and put your next session on the calendar. Requested separately from sign-in.'}
        </p>
      )}

      <div className='mt-3 flex flex-col gap-2'>
        {connected && !requiresReauth ? (
          <>
            <Button size='sm' onClick={schedule} disabled={pending}>
              {pending ? (
                <Loader2 className='size-4 animate-spin' aria-hidden />
              ) : (
                <CalendarPlus className='size-4' aria-hidden />
              )}
              Schedule next session
            </Button>
            <Button
              variant='ghost'
              size='sm'
              className='text-muted-foreground'
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await disconnectCalendar();
                  toast('Calendar disconnected.');
                })
              }
            >
              Disconnect
            </Button>
          </>
        ) : (
          <form action={connectCalendar}>
            <Button type='submit' size='sm' className='w-full'>
              <CalendarCheck className='size-4' aria-hidden />
              {requiresReauth ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
