import { Metadata } from 'next';
import Link from 'next/link';
import { fetchStripeConnectStatus, requireUserEmail } from '@/app/lib/data';

export const metadata: Metadata = {
  title: 'Payouts',
};

const primaryButtonClasses =
  'flex h-10 items-center justify-center rounded-lg bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-sm font-medium text-white shadow-lg shadow-sky-900/40 transition duration-150 hover:from-sky-400 hover:to-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 active:from-sky-600 active:to-cyan-500';

export default async function PayoutsPage() {
  const email = await requireUserEmail();
  const status = await fetchStripeConnectStatus(email);

  const statusPill = status
    ? status.payoutsEnabled
      ? {
          label: 'Payouts enabled',
          className:
            'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
        }
      : !status.detailsSubmitted
        ? {
            label: 'Finish onboarding in Stripe',
            className:
              'border border-amber-500/40 bg-amber-500/10 text-amber-200',
          }
        : {
            label: 'Payouts not enabled yet',
            className:
              'border border-slate-500/40 bg-slate-500/10 text-slate-200',
          }
    : null;

  return (
    <div className="w-full max-w-3xl">
      <h1 className="mb-4 text-2xl font-semibold text-slate-100">Payouts</h1>

      {!status ? (
        <div className="rounded-md border border-slate-800 bg-slate-900/80 p-4">
          <p className="mb-4 text-sm text-slate-300">
            You haven&apos;t connected Stripe yet.
          </p>
          <Link
            href="/dashboard/settings"
            className={`${primaryButtonClasses} w-full`}
          >
            Connect Stripe to receive payouts
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-3">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusPill?.className ?? ''}`}
              >
                {statusPill?.label}
              </span>
            </div>
            <p className="text-sm text-slate-300">
              Invoices paid through Lateless are sent directly to your own
              Stripe account. Lateless never holds your funds.
            </p>
          </div>

          <a
            href="/api/stripe/connect-login"
            className={`${primaryButtonClasses} w-full`}
          >
            Open Stripe payouts dashboard
          </a>
        </div>
      )}
    </div>
  );
}
