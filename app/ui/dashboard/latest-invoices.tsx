import { ArrowPathIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
// import Image from 'next/image';
import { lusitana } from '@/app/ui/fonts';
import { fetchLatestInvoices } from '@/app/lib/data';
import Link from 'next/link';

function InitialAvatar({ name }: { name: string }) {
  const initial = (name?.trim()?.charAt(0) || '?').toUpperCase();
  return (
    <div className="mr-4 flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/20 text-xs font-semibold text-sky-300">
      {initial}
    </div>
  );
}

export default async function LatestInvoices() {
  const latestInvoices = await fetchLatestInvoices();
  const isEmpty = !latestInvoices || latestInvoices.length === 0;

  return (
    <div className="flex w-full flex-col md:col-span-4">
      <h2 className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>
        Latest Invoices
      </h2>

      <div className="flex grow flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
        {isEmpty ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-6">
            <p className="text-sm text-slate-200">
              No invoices yet. Create your first invoice to see activity here.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/dashboard/customers"
                className="inline-flex items-center rounded-md bg-sky-500 px-3 py-2 text-sm font-medium text-white hover:bg-sky-400"
              >
                Add customer
              </Link>
              <Link
                href="/dashboard/invoices/create"
                className="inline-flex items-center rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                Create invoice
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-6">
            {latestInvoices.map((invoice, i) => (
              <div
                key={invoice.id}
                className={clsx(
                  'flex flex-row items-center justify-between py-4 text-slate-200',
                  { 'border-t border-slate-800': i !== 0 },
                )}
              >
                <div className="flex items-center">
                  {invoice.image_url ? (
                    <div className="mr-4 flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/20 text-sm font-semibold text-sky-300">
                      {invoice.name.charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <InitialAvatar name={invoice.name} />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold md:text-base">
                      {invoice.name}
                    </p>
                    <p className="hidden text-sm text-slate-400 sm:block">
                      {invoice.email}
                    </p>
                  </div>
                </div>
                <p
                  className={`${lusitana.className} truncate text-sm font-medium text-sky-200 md:text-base`}
                >
                  {invoice.amount}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center pb-2 pt-6">
          <ArrowPathIcon className="h-5 w-5 text-slate-400" />
          <h3 className="ml-2 text-sm text-slate-400">Updated just now</h3>
        </div>
      </div>
    </div>
  );
}
