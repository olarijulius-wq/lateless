import { lusitana } from '@/app/ui/fonts';
import { fetchLatePayerStats } from '@/app/lib/data';
import Link from 'next/link';

function formatDelay(days: number) {
  const rounded = Math.round(days);
  return `+${rounded} days late`;
}

export default async function LatePayers() {
  const latePayers = await fetchLatePayerStats(5);
  const isEmpty = !latePayers || latePayers.length === 0;

  return (
    <div className="flex w-full flex-col">
      <h2 className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>
        Late payers
      </h2>

      <div className="flex grow flex-col rounded-md border border-slate-800 bg-slate-900/80 p-4 shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
        {isEmpty ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-6">
            <p className="text-sm text-slate-200">
              No late payer data yet. Late payments will appear here.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="grid gap-3 md:grid-cols-2">
              {latePayers.map((payer) => (
                <Link
                  key={payer.customer_id}
                  href={`/dashboard/customers/${payer.customer_id}`}
                  className="group rounded-md border border-slate-800 bg-slate-950/70 p-3 transition hover:border-slate-600"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {payer.name}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {payer.email}
                      </p>
                    </div>
                    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
                      {formatDelay(payer.avg_delay_days)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1">
                      {payer.paid_invoices} paid
                    </span>
                    <span className="text-xs text-slate-500 group-hover:text-slate-300">
                      View customer
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Link
            href="/dashboard/late-payers"
            className="text-xs text-sky-300 hover:underline"
          >
            View all late payers
          </Link>
        </div>
      </div>
    </div>
  );
}
