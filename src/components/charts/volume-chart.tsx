'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

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

const compact = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value);

export function VolumeChart({ data, unitLabel }: { data: WeeklyPoint[]; unitLabel: string }) {
  return (
    // ResponsiveContainer needs a sized parent or it collapses to zero height.
    <ChartContainer config={CONFIG} className='h-[240px] w-full'>
      <AreaChart data={data} margin={{ left: -12, right: 8, top: 8, bottom: 0 }}>
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
          width={44}
          tickFormatter={compact}
          className='text-muted-foreground text-[10px]'
        />

        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => `Week of ${formatShortDate(String(value))}`}
              formatter={(value, name) => [`${compact(Number(value))} ${unitLabel} · `, name]}
            />
          }
        />

        {BUCKETS.map((bucket) => (
          <Area
            key={bucket}
            dataKey={bucket}
            type='monotone'
            stackId='volume'
            fill={BUCKET_COLOR[bucket]}
            fillOpacity={0.85}
            // A 2px surface-coloured edge keeps stacked bands visually separate.
            stroke='var(--surface)'
            strokeWidth={2}
          />
        ))}

        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  );
}
