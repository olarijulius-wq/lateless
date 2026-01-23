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

  return (
    <div className="w-full">
      <h1 className={`${lusitana.className} mb-2 text-xl md:text-2xl`}>
        Late payers
      </h1>
      <p className="mb-6 text-sm text-slate-400">
        Customers who pay invoices after the due date.
      </p>

      {!canView ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-6 text-sm text-amber-100">
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
        <div className="rounded-md border border-slate-800 bg-slate-900/80 p-6 text-sm text-slate-200">
          No late payers yet. Once clients start paying invoices late, they’ll
          appear here.
        </div>
      ) : (
        <div className="rounded-md border border-slate-800 bg-slate-900/80">
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_140px_160px] gap-4 border-b border-slate-800 px-6 py-3 text-xs uppercase tracking-[0.12em] text-slate-500">
            <span>Customer</span>
            <span>Email</span>
            <span className="text-right">Paid invoices</span>
            <span className="text-right">Avg delay</span>
          </div>
          <div className="divide-y divide-slate-800">
            {latePayers.map((payer) => (
              <Link
                key={payer.customer_id}
                href={`/dashboard/customers/${payer.customer_id}`}
                className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_140px_160px] items-center gap-4 px-6 py-4 text-sm text-slate-200 transition hover:bg-slate-900"
              >
                <span className="truncate font-semibold text-slate-100">
                  {payer.name}
                </span>
                <span className="truncate text-slate-400">{payer.email}</span>
                <span className="text-right text-slate-300">
                  {payer.paid_invoices}
                </span>
                <span className="text-right text-amber-200">
                  {formatDelay(payer.avg_delay_days)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
