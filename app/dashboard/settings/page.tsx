import { Metadata } from 'next';
import UpgradeButton from './upgrade-button';
import ManageBillingButton from './manage-billing-button';

export const metadata: Metadata = {
  title: 'Settings',
};

export default async function SettingsPage(props: {
  searchParams?: Promise<{ success?: string; canceled?: string }>;
}) {
  const searchParams = await props.searchParams;
  const success = searchParams?.success === '1';
  const canceled = searchParams?.canceled === '1';

  return (
    <div className="w-full max-w-3xl">
      <h1 className="mb-4 text-2xl font-semibold text-slate-100">Settings</h1>

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

      <div className="grid gap-3 sm:grid-cols-2">
        <UpgradeButton />
        <ManageBillingButton />
      </div>

      <p className="mt-4 text-sm text-slate-400">
        Use “Manage billing / Cancel” to cancel your subscription, update payment method, or view invoices.
      </p>
    </div>
  );
}