'use client';

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatShortDate } from '@/lib/date';
import type { BodyPoint } from '@/server/queries/stats';

const CONFIG: ChartConfig = {
  weightKg: { label: 'Logged', color: 'var(--muted-foreground)' },
  trendKg: { label: '7-day trend', color: 'var(--chart-1)' },
};

export function BodyweightChart({ data, unitLabel }: { data: BodyPoint[]; unitLabel: string }) {
  return (
    <ChartContainer config={CONFIG} className='h-[200px] w-full'>
      <LineChart data={data} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray='3 3' className='stroke-border' />

        <XAxis
          dataKey='date'
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tickFormatter={formatShortDate}
          className='text-muted-foreground text-[10px]'
        />
        <YAxis
          domain={['dataMin - 1', 'dataMax + 1']}
          tickLine={false}
          axisLine={false}
          width={40}
          className='text-muted-foreground text-[10px]'
        />

        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formatShortDate(String(value))}
              formatter={(value, name) => [`${Number(value).toFixed(1)} ${unitLabel} · `, name]}
            />
          }
        />

        {/* Raw readings sit behind as light dots; the trend line is the signal. */}
        <Line
          dataKey='weightKg'
          type='monotone'
          stroke='var(--muted-foreground)'
          strokeWidth={0}
          dot={{ r: 2, fill: 'var(--muted-foreground)' }}
          connectNulls
          isAnimationActive={false}
        />
        <Line
          dataKey='trendKg'
          type='monotone'
          stroke='var(--chart-1)'
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  );
}
