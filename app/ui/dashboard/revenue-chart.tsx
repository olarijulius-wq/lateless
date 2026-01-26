import { generateYAxis } from '@/app/lib/utils';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { lusitana } from '@/app/ui/fonts';
import { fetchRevenue } from '@/app/lib/data';

export default async function RevenueChart() {
  const revenue = await fetchRevenue();
  const chartHeight = 240;

  if (!revenue || revenue.length === 0) {
    return (
      <p className="mt-4 text-slate-500">
        No revenue yet. Create and mark invoices as paid to see revenue.
      </p>
    );
  }

  const { yAxisLabels, topLabel } = generateYAxis(revenue);

  return (
    <div className="w-full">
      <h2 className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>
        Recent Revenue
      </h2>

      <div className="w-full rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
        <div className="h-60 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60 p-4">
          <div className="sm:grid-cols-13 grid h-full grid-cols-12 items-end gap-2 md:gap-4">
            {/* Y-axis */}
            <div
              className="hidden flex-col justify-between text-sm text-slate-400 sm:flex"
              style={{ height: `${chartHeight}px` }}
            >
              {yAxisLabels.map((label) => (
                <p key={label}>{label}</p>
              ))}
            </div>

            {/* Bars */}
            {revenue.map((month) => (
              <div key={month.month} className="flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-md bg-gradient-to-t from-sky-600 to-cyan-300 shadow-lg shadow-sky-900/40"
                  style={{
                    height: `${Math.max(
                      2,
                      (chartHeight / topLabel) * month.revenue
                    )}px`,
                  }}
                />
                <p className="-rotate-90 text-xs text-slate-400 sm:rotate-0 sm:text-sm">
                  {month.month}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 pt-4 md:flex-row md:items-center">
          <div className="flex items-center">
            <CalendarIcon className="h-5 w-5 text-slate-400" />
            <h3 className="ml-2 text-sm text-slate-400">Last 12 months</h3>
          </div>
        </div>
      </div>
    </div>
  );
}
