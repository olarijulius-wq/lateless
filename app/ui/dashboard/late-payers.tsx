import { lusitana } from '@/app/ui/fonts';
import { fetchLatePayerStats, fetchUserPlanAndUsage } from '@/app/lib/data';
import { PLAN_CONFIG } from '@/app/lib/config';
import Link from 'next/link';

function formatDelay(days: number) {
  const rounded = Math.round(days);
  return `+${rounded} days late`;
}

export default async function LatePayers() {
  const { plan } = await fetchUserPlanAndUsage();
  const canView = PLAN_CONFIG[plan].hasLatePayerAnalytics;
  const latePayers = canView ? await fetchLatePayerStats(5) : [];
  const isEmpty = !latePayers || latePayers.length === 0;

  return (
    <div className="flex w-full flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        {canView ? (
          <>
            <Link
              href="/dashboard/late-payers"
              className={`${lusitana.className} text-xl text-slate-100 hover:text-white md:text-2xl`}
            >
              Late payers
            </Link>
            <Link
              href="/dashboard/late-payers"
              className="inline-flex items-center rounded-md bg-sky-500 px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-sky-900/30 transition hover:bg-sky-400"
            >
              View all late payers
            </Link>
          </>
        ) : (
          <>
            <h2 className={`${lusitana.className} text-xl text-slate-100 md:text-2xl`}>
              Late payers
            </h2>
            <div className="flex flex-col items-end gap-1">
              <span
                className="inline-flex cursor-not-allowed items-center rounded-md bg-sky-500/40 px-3 py-2 text-xs font-semibold text-white/70 opacity-60"
                aria-disabled="true"
                title="Available on Solo, Pro, and Studio plans"
              >
                View all late payers
              </span>
              <p className="text-xs text-slate-400">
                Available on Solo, Pro, and Studio plans.
              </p>
            </div>
          </>
        )}
      </div>

      <div className="flex grow flex-col rounded-md border border-slate-800 bg-slate-900/80 p-4 shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
        {!canView ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-6">
            <p className="text-sm text-slate-100">
              See which clients consistently pay late and how many days they
              delay payments.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Available on Solo, Pro, and Studio.
            </p>
            <Link
              href="/dashboard/settings"
              className="mt-4 inline-flex items-center rounded-md bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm shadow-amber-900/30 transition hover:bg-amber-300"
            >
              View plans
            </Link>
          </div>
        ) : isEmpty ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-6">
            <p className="text-sm text-slate-200">
              No late payer data yet. Late payments will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border bg-white p-4 dark:bg-neutral-900 md:hidden">
              <div className="space-y-3">
                {latePayers.map((payer) => (
                  <Link
                    key={payer.customer_id}
                    href={`/dashboard/customers/${payer.customer_id}`}
                    className="flex flex-col gap-1 text-sm"
                  >
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                      {payer.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {payer.email}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {payer.paid_invoices} invoices, avg {formatDelay(payer.avg_delay_days)}
                    </p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="hidden rounded-lg border border-slate-800 bg-slate-950/60 md:block">
              <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1fr)] gap-4 border-b border-slate-800 px-4 py-3 text-xs uppercase tracking-[0.12em] text-slate-500">
                <span>Name</span>
                <span>Email</span>
                <span className="text-right">Stats</span>
              </div>
              <div className="divide-y divide-slate-800">
                {latePayers.map((payer) => (
                  <Link
                    key={payer.customer_id}
                    href={`/dashboard/customers/${payer.customer_id}`}
                    className="flex flex-col gap-2 px-4 py-3 text-sm text-slate-200 transition hover:bg-slate-900 md:flex-row md:items-center md:justify-between"
                  >
                    <span className="min-w-0 font-medium text-slate-100 md:w-[30%] md:truncate">
                      {payer.name}
                    </span>
                    <span className="min-w-0 text-slate-400 md:w-[40%] md:truncate">
                      {payer.email}
                    </span>
                    <span className="text-xs text-slate-300 md:w-[30%] md:text-right">
                      {payer.paid_invoices} invoices, avg {formatDelay(payer.avg_delay_days)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {canView && (
          <div className="mt-4 flex justify-end">
            <Link
              href="/dashboard/late-payers"
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Open late payers
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
