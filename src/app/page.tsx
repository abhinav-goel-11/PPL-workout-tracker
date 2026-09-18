import { redirect } from 'next/navigation';
import { Dumbbell } from 'lucide-react';

import { signIn } from '@/lib/auth';
import { getCurrentUser } from '@/server/queries/user';
import { Button } from '@/components/ui/button';

const FEATURES = [
  [
    'Rolling PPL queue',
    'Rest days never break the sequence — next up is always one after your last completed session.',
  ],
  [
    'Logs in the gym, signal or not',
    'Sets are saved locally first and sync when you get bars back.',
  ],
  [
    'Volume, streaks and recomp',
    'Per-muscle volume, a streak that tolerates rest days, and a bodyweight trend.',
  ],
] as const;

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return (
    <main className='mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16'>
      <div className='bg-primary/10 text-primary mb-6 flex size-14 items-center justify-center rounded-2xl'>
        <Dumbbell className='size-7' aria-hidden />
      </div>

      <h1 className='text-3xl font-semibold tracking-tight'>PPL Tracker</h1>
      <p className='text-muted-foreground mt-3 text-base'>
        A rolling 6-session Push / Pull / Legs tracker built for body recomposition — and for taking
        a rest day whenever you need one.
      </p>

      <ul className='mt-10 space-y-5'>
        {FEATURES.map(([title, body]) => (
          <li key={title}>
            <p className='text-sm font-medium'>{title}</p>
            <p className='text-muted-foreground mt-1 text-sm'>{body}</p>
          </li>
        ))}
      </ul>

      <form
        className='mt-10'
        action={async () => {
          'use server';
          await signIn('google', { redirectTo: '/dashboard' });
        }}
      >
        <Button type='submit' size='lg' className='w-full'>
          Continue with Google
        </Button>
      </form>

      <p className='text-muted-foreground mt-4 text-center text-xs'>
        Google Calendar is connected later, from Settings — not at sign-in.
      </p>
    </main>
  );
}
