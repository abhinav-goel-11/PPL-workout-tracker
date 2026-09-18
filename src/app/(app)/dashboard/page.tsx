import type { Metadata } from 'next';
import Link from 'next/link';
import { Settings } from 'lucide-react';

import { PageHeader } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { NextUpCard } from '@/components/dashboard/next-up-card';
import { QueuePreview } from '@/components/dashboard/queue-preview';
import { RestDayButton } from '@/components/dashboard/rest-day-button';
import { StreakCard } from '@/components/dashboard/streak-card';
import { WeekStrip } from '@/components/dashboard/week-strip';
import { getDashboardData } from '@/server/queries/dashboard';
import { requireUser } from '@/server/queries/user';

export const metadata: Metadata = { title: 'Today' };

const GREETING = (hour: number) =>
  hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData(user);

  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hour12: false,
      timeZone: user.timeZone,
    }).format(new Date()),
  );

  const firstName = user.name?.split(' ')[0];

  return (
    <main className='flex flex-col gap-6'>
      <PageHeader
        title={firstName ? `${GREETING(hour)}, ${firstName}` : GREETING(hour)}
        subtitle='Rest days never move your place in the cycle.'
        action={
          <Button asChild variant='ghost' size='icon' aria-label='Settings'>
            <Link href='/settings'>
              <Settings className='size-5' aria-hidden />
            </Link>
          </Button>
        }
      />

      <NextUpCard nextUp={data.nextUp} />

      <QueuePreview items={data.preview} />

      <section>
        <h2 className='text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase'>
          Last two weeks
        </h2>
        <WeekStrip days={data.days} today={data.today} />
      </section>

      <StreakCard streak={data.streak} />

      <RestDayButton restedToday={data.restedToday} today={data.today} />
    </main>
  );
}
