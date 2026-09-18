'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { BUCKETS, BUCKET_COLOR } from '@/lib/analytics/muscle-buckets';
import { formatShortDate } from '@/lib/date';
import type { WeeklyPoint } from '@/server/queries/stats';

const CONFIG: ChartConfig = Object.fromEntries(
  BUCKETS.map((bucket) => [bucket, { label: bucket, color: BUCKET_COLOR[bucket] }]),
);

export function SetsChart({ data }: { data: WeeklyPoint[] }) {
  return (
    <ChartContainer config={CONFIG} className='h-[220px] w-full'>
      <BarChart data={data} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray='3 3' className='stroke-border' />

        <XAxis
          dataKey='week'
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={formatShortDate}
          className='text-muted-foreground text-[10px]'
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={36}
          className='text-muted-foreground text-[10px]'
        />

        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => `Week of ${formatShortDate(String(value))}`}
            />
          }
        />

        {BUCKETS.map((bucket, index) => (
          <Bar
            key={bucket}
            dataKey={bucket}
            stackId='sets'
            fill={BUCKET_COLOR[bucket]}
            // Round only the topmost segment of each stack.
            radius={index === BUCKETS.length - 1 ? [4, 4, 0, 0] : 0}
          />
        ))}

        <ChartLegend content={<ChartLegendContent />} />
      </BarChart>
    </ChartContainer>
  );
}
