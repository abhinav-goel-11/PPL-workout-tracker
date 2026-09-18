import type { Metadata } from 'next';

import { PageHeader } from '@/components/app-shell';
import { BodyMetricForm } from '@/components/charts/body-metric-form';
import { BodyweightChart } from '@/components/charts/bodyweight-chart';
import { ConsistencyHeatmap } from '@/components/charts/consistency-heatmap';
import { MuscleBreakdown } from '@/components/charts/muscle-breakdown';
import { SetsChart } from '@/components/charts/sets-chart';
import { VolumeChart } from '@/components/charts/volume-chart';
import { fromKg, formatVolume } from '@/lib/units';
import { getStatsData } from '@/server/queries/stats';
import { requireUser } from '@/server/queries/user';

export const metadata: Metadata = { title: 'Stats' };

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className='border-border bg-surface rounded-2xl border p-4'>
      <h2 className='text-sm font-semibold'>{title}</h2>
      {hint ? (
        <p className='text-muted-foreground mt-0.5 mb-3 text-xs'>{hint}</p>
      ) : (
        <div className='mb-3' />
      )}
      {children}
    </section>
  );
}

export default async function StatsPage() {
  const user = await requireUser();
  const data = await getStatsData(user);
  const hasVolume = data.totalVolumeKg > 0;

  return (
    <main className='flex flex-col gap-4'>
      <PageHeader title='Stats' subtitle='Last 12 weeks.' />

      <div className='grid grid-cols-3 gap-3'>
        <div className='border-border bg-surface rounded-xl border p-3'>
          <p className='text-muted-foreground text-[11px]'>Streak</p>
          <p className='mt-0.5 text-xl font-semibold tabular-nums'>{data.streak.current}</p>
        </div>
        <div className='border-border bg-surface rounded-xl border p-3'>
          <p className='text-muted-foreground text-[11px]'>Volume</p>
          <p className='mt-0.5 text-xl font-semibold tabular-nums'>
            {formatVolume(data.totalVolumeKg, user.unit)}
          </p>
        </div>
        <div className='border-border bg-surface rounded-xl border p-3'>
          <p className='text-muted-foreground text-[11px]'>Weight</p>
          <p className='mt-0.5 text-xl font-semibold tabular-nums'>
            {data.latestWeightKg != null ? fromKg(data.latestWeightKg, user.unit).toFixed(1) : '—'}
          </p>
        </div>
      </div>

      {hasVolume ? (
        <>
          <Section title='Weekly volume' hint={`Weight × reps, by split. In ${user.unit}.`}>
            <VolumeChart data={data.weekly} unitLabel={user.unit} />
          </Section>

          <Section title='Sets per week' hint='The input variable that actually drives growth.'>
            <SetsChart data={data.weeklySets} />
          </Section>

          <Section title='By muscle group' hint='Last 4 weeks, ranked by volume.'>
            <MuscleBreakdown rows={data.byMuscle} unit={user.unit} />
          </Section>
        </>
      ) : (
        <p className='text-muted-foreground border-border rounded-xl border border-dashed p-8 text-center text-sm'>
          Log a session and your volume charts will appear here.
        </p>
      )}

      <Section title='Consistency' hint='Last 16 weeks.'>
        <ConsistencyHeatmap
          activeDays={data.activeDays}
          today={data.today}
          weekStartsOn={user.weekStartsOn}
        />
      </Section>

      <Section
        title='Bodyweight'
        hint={
          data.weightChangeKg != null
            ? `${data.weightChangeKg > 0 ? '+' : ''}${data.weightChangeKg} kg over the logged period.`
            : 'Recomp is a trend — log your weight regularly.'
        }
      >
        {data.body.length > 1 ? (
          <BodyweightChart data={data.body} unitLabel={user.unit} />
        ) : (
          <p className='text-muted-foreground py-4 text-center text-sm'>
            Two or more entries are needed to draw a trend.
          </p>
        )}
        <div className='mt-3'>
          <BodyMetricForm unit={user.unit} today={data.today} />
        </div>
      </Section>
    </main>
  );
}
