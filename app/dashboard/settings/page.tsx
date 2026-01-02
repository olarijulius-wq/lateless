// app/dashboard/settings/page.tsx
import UpgradeButton from './upgrade-button';

type SearchParams = {
  success?: string;
  canceled?: string;
};

export default async function SettingsPage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = await props.searchParams;
  const success = searchParams?.success === '1';
  const canceled = searchParams?.canceled === '1';

  return (
    <div className="w-full max-w-3xl">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {success && (
        <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm">
          Payment successful.
        </div>
      )}

      {canceled && (
        <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
          Payment canceled.
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-lg font-medium">Pro</h2>
            <p className="mt-1 text-sm text-white/70">
              Remove the free plan limit (e.g., max 5 invoices) and unlock Pro features (PDF export, email reminders, and more).
            </p>
          </div>

          <UpgradeButton />
        </div>
      </div>
    </div>
  );
}