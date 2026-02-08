'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTheme } from '@/app/ui/theme/theme-provider';

type ChartDatum = {
  month: string;
  revenueCents: number;
};

const formatEuroFromCents = (value: number) =>
  (value / 100).toLocaleString('en-GB', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });

export function RevenueChartClient({ chartData }: { chartData: ChartDatum[] }) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const gridStroke = dark ? '#262626' : '#e5e5e5';
  const axisStroke = dark ? '#a3a3a3' : '#404040';
  const tooltipBg = dark ? '#000000' : '#ffffff';
  const tooltipBorder = dark ? '#404040' : '#d4d4d4';
  const tooltipText = dark ? '#f5f5f5' : '#171717';
  const lineStroke = dark ? '#fafafa' : '#171717';

  return (
    <div
      className="h-60 rounded-xl border border-neutral-200 bg-white p-3 [&_.recharts-surface:focus]:outline-none [&_.recharts-surface:focus-visible]:outline-none dark:border-neutral-800 dark:bg-black md:h-80 md:p-4"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          accessibilityLayer={false}
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis
            dataKey="month"
            stroke={axisStroke}
            tick={{ fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            stroke={axisStroke}
            tick={{ fontSize: 12 }}
            tickLine={false}
            domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.1)]}
            tickFormatter={formatEuroFromCents}
          />
          <Tooltip
            formatter={(value) => [formatEuroFromCents(Number(value)), 'Revenue']}
            contentStyle={{
              background: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: '10px',
              color: tooltipText,
            }}
            labelStyle={{ color: tooltipText }}
          />
          <Line
            type="monotone"
            dataKey="revenueCents"
            name="Revenue"
            stroke={lineStroke}
            strokeOpacity={0.95}
            strokeWidth={2}
            dot={{ r: 3, stroke: lineStroke, fill: lineStroke }}
            activeDot={{ r: 5, stroke: lineStroke, fill: lineStroke }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
