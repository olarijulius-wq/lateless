import { Metadata } from 'next';
import UpgradeButton from './upgrade-button';
import ManageBillingButton from './manage-billing-button';
import { fetchCompanyProfile, fetchUserPlanAndUsage } from '@/app/lib/data';
import CompanyProfileForm from './company-profile-form';

export const metadata: Metadata = {
  title: 'Settings',
};

export default async function SettingsPage(props: {
  searchParams?: Promise<{ success?: string; canceled?: string }>;
}) {
  const searchParams = await props.searchParams;
  const success = searchParams?.success === '1';
  const canceled = searchParams?.canceled === '1';

  function formatEtDateTime(value: Date | string | null | undefined) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;

    return new Intl.DateTimeFormat('et-EE', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Tallinn',
    }).format(d);
  }

  const {
    isPro,
    subscriptionStatus,
    cancelAtPeriodEnd,
    currentPeriodEnd,
    invoiceCount,
    freeLimit,
  } = await fetchUserPlanAndUsage();
  const companyProfile = await fetchCompanyProfile();
  const periodEndLabel = formatEtDateTime(currentPeriodEnd);
  const previewYear = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
  }).format(new Date());
  const invoiceNumberPreview = `INV-${previewYear}-0001`;

  return (
    <div className="w-full max-w-3xl">
      <h1 className="mb-4 text-2xl font-semibold text-slate-100">Settings</h1>

      {/* Checkout success / cancel teated */}
      {success && (
        <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
          Payment successful. Your plan is now Pro.
        </div>
      )}

      {canceled && (
        <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
          Payment canceled.
        </div>
      )}

      {/* Plan + limiit info */}
      <div className="mb-4 rounded-md border border-slate-800 bg-slate-900/80 p-4">
        <p className="mb-2 text-sm text-slate-300">
          Plan:{' '}
          <span
            className={
              isPro
                ? 'inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-200'
                : 'inline-flex items-center rounded-full bg-slate-700/60 px-2 py-0.5 text-xs font-semibold text-slate-100'
            }
          >
            {isPro ? 'Pro' : 'Free'}
          </span>
        </p>

        {isPro ? (
          <p className="text-sm text-slate-400">
            You are on the Pro plan. You can create unlimited invoices.
          </p>
        ) : (
          <p className="text-sm text-slate-400">
            Free plan: {invoiceCount} / {freeLimit} invoices used.
          </p>
        )}

        {subscriptionStatus && (
          <p className="mt-1 text-xs text-slate-500">
            Subscription status: {subscriptionStatus}
          </p>
        )}

        {isPro && periodEndLabel && (
          <>
            {cancelAtPeriodEnd ? (
              <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-amber-200">
                <p className="text-sm font-semibold">Cancellation scheduled</p>
                <p className="mt-1 text-sm text-amber-100/90">
                  Your Pro access stays active until{' '}
                  <span className="font-semibold">{periodEndLabel}</span>.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                Next renewal: {periodEndLabel}
              </p>
            )}
          </>
        )}
      </div>

      <div className="mb-4">
        <CompanyProfileForm
          initialProfile={companyProfile}
          invoiceNumberPreview={invoiceNumberPreview}
        />
      </div>

      {/* Nupud: Upgrade + Billing portal */}
      <div className="grid gap-3 sm:grid-cols-2">
        <UpgradeButton />
        <ManageBillingButton />
      </div>

      <p className="mt-4 text-sm text-slate-400">
        Use “Manage billing / Cancel” to cancel your subscription, update
        payment method, or view invoices.
      </p>
    </div>
  );
}
