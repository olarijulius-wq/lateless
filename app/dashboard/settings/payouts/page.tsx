import { Metadata } from 'next';
import {
  fetchStripeConnectStatusForUser,
  requireUserEmail,
} from '@/app/lib/data';
import { ensureWorkspaceContextForCurrentUser } from '@/app/lib/workspaces';
import ConnectStripeButton from '../connect-stripe-button';
import ResyncConnectStatusButton from './resync-connect-status-button';
import { checkConnectedAccountAccess } from '@/app/lib/stripe-connect';
import PricingPanel from '@/app/ui/pricing/panel';
import { primaryButtonClasses } from '@/app/ui/button';

export const metadata: Metadata = {
  title: 'Payouts',
};

export default async function PayoutsPage() {
  const email = await requireUserEmail();
  const context = await ensureWorkspaceContextForCurrentUser();
  const userRole = context.userRole;
  const status = await fetchStripeConnectStatusForUser(email);
  const isTest = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ?? false;
  const modeLabel = isTest ? 'Test' : 'Live';
  const showStripeDebug =
    process.env.NODE_ENV !== 'production' &&
    process.env.DEBUG_STRIPE_UI === 'true' &&
    userRole === 'owner';
  let retrieveStatus: string | null = null;

  if (showStripeDebug && status.accountId) {
    const accessCheck = await checkConnectedAccountAccess(status.accountId);
    retrieveStatus = accessCheck.ok
      ? 'ok'
      : `failed (${accessCheck.isModeMismatch ? 'mode/account mismatch' : accessCheck.message})`;
  }

  const statusPill =
    status.isReadyForTransfers
      ? {
          label: 'Ready',
          className:
            'border border-emerald-500/35 bg-emerald-500/10 text-emerald-300',
        }
      : status.hasAccount
        ? {
            label: 'Setup incomplete',
            className:
              'border border-amber-500/35 bg-amber-500/10 text-amber-200',
          }
        : {
            label: 'Not connected',
            className:
              'border border-neutral-700 bg-neutral-900 text-neutral-300',
          };

  const setupSteps = [
    { label: 'Create account', done: status.hasAccount },
    { label: 'Submit details', done: status.detailsSubmitted },
    { label: 'Enable payouts', done: status.payoutsEnabled },
  ];

  const primaryConnectButtonClass = `${primaryButtonClasses} w-full rounded-full`;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Payouts</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-neutral-300">
          Connect Stripe Express to receive payouts from paid invoices.
        </p>
      </header>

      {showStripeDebug && (
        <div className="rounded-xl border border-dashed border-neutral-700 bg-neutral-950 p-3 text-xs text-neutral-300">
          <p>
            <strong>Debug</strong> Key mode: {modeLabel.toLowerCase()}
          </p>
          <p>Connected account: {status.accountId ?? 'none'}</p>
          <p>accounts.retrieve: {retrieveStatus ?? 'not checked'}</p>
        </div>
      )}

      <PricingPanel className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-neutral-400">
              Stripe Connect
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
              {status.isReadyForTransfers ? 'Payouts are ready' : 'Finish payouts setup'}
            </h2>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusPill.className}`}
          >
            {statusPill.label}
          </span>
        </div>

        <p className="text-sm text-slate-600 dark:text-neutral-300">
          {status.isReadyForTransfers
            ? 'Payouts are enabled. You can receive transfers to your connected Stripe account.'
            : !status.hasAccount
              ? 'No Connect account yet. Create one to receive payouts.'
              : 'Your account is connected, but onboarding details are still required.'}
        </p>

        {!status.isReadyForTransfers ? (
          <ul className="space-y-2 text-sm text-slate-600 dark:text-neutral-300">
            {setupSteps.map((step) => (
              <li key={step.label} className="flex items-center gap-2">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${step.done ? 'bg-emerald-500 dark:bg-emerald-300' : 'bg-neutral-400 dark:bg-neutral-600'}`}
                />
                <span className={step.done ? 'text-slate-800 dark:text-neutral-200' : 'text-slate-500 dark:text-neutral-400'}>
                  {step.label}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="space-y-3">
          {!status.hasAccount ? (
            <ConnectStripeButton
              label="Connect Stripe"
              className={primaryConnectButtonClass}
            />
          ) : status.isReadyForTransfers ? (
            <a
              href="/api/stripe/connect-login"
              className={`${primaryButtonClasses} w-full rounded-full`}
            >
              Open Stripe Express
            </a>
          ) : (
            <ConnectStripeButton
              label="Continue setup"
              className={primaryConnectButtonClass}
            />
          )}

          {status.hasAccount ? (
            <ConnectStripeButton
              label="Reconnect Stripe"
              path="/api/stripe/connect/onboard?reconnect=1"
              className={primaryConnectButtonClass}
            />
          ) : null}

          <ResyncConnectStatusButton className={primaryConnectButtonClass} />
        </div>
      </PricingPanel>
    </div>
  );
}
