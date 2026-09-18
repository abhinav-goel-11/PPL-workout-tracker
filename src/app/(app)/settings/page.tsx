import type { Metadata } from 'next';
import { LogOut } from 'lucide-react';

import { PageHeader } from '@/components/app-shell';
import { CalendarCard } from '@/components/settings/calendar-card';
import { RoutineEditor } from '@/components/settings/routine-editor';
import { UnitToggle } from '@/components/settings/unit-toggle';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth';
import { getCalendarStatus } from '@/lib/google/token';
import { getRoutine } from '@/server/queries/settings';
import { requireUser } from '@/server/queries/user';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await requireUser();
  const [routine, calendar] = await Promise.all([getRoutine(user.id), getCalendarStatus(user.id)]);

  return (
    <main className='flex flex-col gap-4'>
      <PageHeader title='Settings' subtitle={user.email} />

      <section className='border-border bg-surface rounded-2xl border p-4'>
        <h2 className='text-sm font-semibold'>Units</h2>
        <p className='text-muted-foreground mt-1 mb-3 text-xs'>
          Weights are always stored in kg; this only changes what you see.
        </p>
        <UnitToggle unit={user.unit} />
      </section>

      <CalendarCard connected={calendar.connected} requiresReauth={calendar.requiresReauth} />

      <section className='border-border bg-surface rounded-2xl border p-4'>
        <h2 className='text-sm font-semibold'>Your routine</h2>
        <p className='text-muted-foreground mt-1 mb-2 text-xs'>
          These six sessions are your own copy — edit sets, reps, rest and form videos freely.
        </p>
        <RoutineEditor routine={routine} />
      </section>

      <section className='border-border bg-surface rounded-2xl border p-4'>
        <h2 className='text-sm font-semibold'>Time zone</h2>
        <p className='text-muted-foreground mt-1 text-xs'>
          {user.timeZone} — detected from this device. Every &ldquo;today&rdquo; uses it.
        </p>
      </section>

      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/' });
        }}
      >
        <Button type='submit' variant='ghost' className='text-muted-foreground w-full'>
          <LogOut className='size-4' aria-hidden />
          Sign out
        </Button>
      </form>
    </main>
  );
}
