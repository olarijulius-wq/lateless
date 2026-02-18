// Uses a Recharts LineChart with real revenueCents on the Y-axis and formats ticks as EUR from cents.
import { lusitana } from '@/app/ui/fonts';
import { fetchRevenue, fetchRevenueDaily } from '@/app/lib/data';
import { RevenueChartClient } from '@/app/ui/dashboard/revenue-chart-client';

export default async function RevenueChart() {
  const [monthlyRevenue, dailyRevenue] = await Promise.all([
    fetchRevenue(),
    fetchRevenueDaily(30),
  ]);

  const monthlyChartData = monthlyRevenue.map((m) => ({
    period: m.month,
    revenueCents: Math.round(m.revenue * 100),
  }));
  const dailyChartData = dailyRevenue.map((d) => ({
    period: d.day,
    revenueCents: Math.round(d.revenue * 100),
  }));

  if (monthlyChartData.length === 0 && dailyChartData.length === 0) {
    return (
      <p className="mt-4 text-neutral-600 dark:text-neutral-400">
        No revenue yet. Create and mark invoices as paid to see revenue.
      </p>
    );
  }

  return (
    <div className="w-full">
      <h2 className={`${lusitana.className} mb-4 text-xl text-slate-900 dark:text-slate-100 md:text-2xl`}>
        Recent Revenue
      </h2>

      <div className="w-full rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
        <RevenueChartClient monthlyChartData={monthlyChartData} dailyChartData={dailyChartData} />
      </div>
    </div>
  );
}
