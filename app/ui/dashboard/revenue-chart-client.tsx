'use client';

import { useMemo, useState } from 'react';
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
  period: string;
  revenueCents: number;
};

const formatEuroFromCents = (value: number) =>
  (value / 100).toLocaleString('en-GB', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });

type Granularity = 'daily' | 'monthly';

function formatDailyTick(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

function formatMonthlyTick(value: string) {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatDailyTooltipLabel(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

function formatMonthlyTooltipLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function RevenueChartClient({
  monthlyChartData,
  dailyChartData,
}: {
  monthlyChartData: ChartDatum[];
  dailyChartData: ChartDatum[];
}) {
  const [granularity, setGranularity] = useState<Granularity>('daily');
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const gridStroke = dark ? '#262626' : '#e5e7eb';
  const axisStroke = dark ? '#a3a3a3' : '#475569';
  const tooltipBg = dark ? '#000000' : '#ffffff';
  const tooltipBorder = dark ? '#404040' : '#cbd5e1';
  const tooltipText = dark ? '#f5f5f5' : '#0f172a';
  const lineStroke = dark ? '#fafafa' : '#171717';
  const hasDailyData = dailyChartData.length > 0;
  const hasMonthlyData = monthlyChartData.length > 0;
  const effectiveGranularity: Granularity = hasDailyData
    ? granularity
    : hasMonthlyData
      ? 'monthly'
      : 'daily';

  const chartData = useMemo(
    () => (effectiveGranularity === 'daily' ? dailyChartData : monthlyChartData),
    [dailyChartData, monthlyChartData, effectiveGranularity],
  );

  return (
    <div
      className="h-60 rounded-xl border border-neutral-200 bg-white p-3 text-slate-900 [&_.recharts-surface:focus]:outline-none [&_.recharts-surface:focus-visible]:outline-none dark:border-neutral-800 dark:bg-black dark:text-slate-100 md:h-80 md:p-4"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="mb-3 flex justify-end">
        <div className="inline-flex rounded-lg border border-neutral-300 bg-neutral-100 p-1 dark:border-neutral-700 dark:bg-neutral-900">
          <button
            type="button"
            onClick={() => setGranularity('monthly')}
            disabled={!hasMonthlyData}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              effectiveGranularity === 'monthly'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-black dark:text-white'
                : 'text-neutral-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-300 dark:hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setGranularity('daily')}
            disabled={!hasDailyData}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              effectiveGranularity === 'daily'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-black dark:text-white'
                : 'text-neutral-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-300 dark:hover:text-white'
            }`}
          >
            Daily (30d)
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          accessibilityLayer={false}
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis
            dataKey="period"
            stroke={axisStroke}
            tick={{ fontSize: 12 }}
            tickLine={false}
            minTickGap={14}
            tickFormatter={(value) =>
              effectiveGranularity === 'daily'
                ? formatDailyTick(String(value))
                : formatMonthlyTick(String(value))
            }
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
            labelFormatter={(value) =>
              effectiveGranularity === 'daily'
                ? formatDailyTooltipLabel(String(value))
                : formatMonthlyTooltipLabel(String(value))
            }
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
