import { Metadata } from 'next';
import Link from 'next/link';
import { fetchLatePayerStats, fetchUserPlanAndUsage } from '@/app/lib/data';
import { PLAN_CONFIG } from '@/app/lib/config';
import { lusitana } from '@/app/ui/fonts';

export const metadata: Metadata = {
  title: 'Late payers',
};

function formatDelay(days: number) {
  const rounded = Math.round(days * 10) / 10;
  return `+${rounded} days`;
}

export default async function Page() {
  const { plan } = await fetchUserPlanAndUsage();
  const canView = PLAN_CONFIG[plan].hasLatePayerAnalytics;
  const latePayers = canView ? await fetchLatePayerStats(1000) : [];
  const isEmpty = !latePayers || latePayers.length === 0;
  const totalLatePayers = latePayers.length;
  const averageDelay = totalLatePayers
    ? latePayers.reduce((sum, payer) => sum + payer.avg_delay_days, 0) / totalLatePayers
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`${lusitana.className} mb-2 text-xl md:text-2xl`}>
          Late payers
        </h1>
        <p className="text-sm text-slate-400">
          Customers who pay invoices after the due date.
        </p>
      </div>

      {!canView ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-6 text-sm text-amber-100">
          <p className="font-semibold">Late payer analytics is a Solo+ feature.</p>
          <p className="mt-2 text-amber-100/80">
            Upgrade to see which customers consistently pay late and how many
            days they delay payments.
          </p>
          <Link
            href="/dashboard/settings"
            className="mt-4 inline-flex items-center rounded-md bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm shadow-amber-900/30 transition hover:bg-amber-300"
          >
            View plans
          </Link>
        </div>
      ) : isEmpty ? (
        <>
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
            <p className="text-sm text-slate-400">Total late payers</p>
            <p className="text-2xl font-semibold text-slate-100">0</p>
            <p className="mt-2 text-xs text-slate-500">Avg delay: 0 days</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 text-sm text-slate-200">
            No late payers yet. Once clients start paying invoices late, they’ll
            appear here.
          </div>
        </>
      ) : (
        <>
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-400">Total late payers</p>
                <p className="text-2xl font-semibold text-slate-100">
                  {totalLatePayers}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Avg delay</p>
                <p className="text-lg font-semibold text-amber-200">
                  {formatDelay(averageDelay)}
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
            {latePayers.map((payer) => (
              <Link
                key={payer.customer_id}
                href={`/dashboard/customers/${payer.customer_id}`}
                className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-200 transition hover:border-slate-600"
              >
                <p className="truncate font-semibold text-slate-100">
                  {payer.name}
                </p>
                <p className="truncate text-xs text-slate-400">{payer.email}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                  <span>{payer.paid_invoices} paid invoices</span>
                  <span className="text-amber-200">
                    Avg delay: {formatDelay(payer.avg_delay_days)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
