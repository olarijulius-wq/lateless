import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Unsubscribe Settings',
};

export default function UnsubscribeSettingsPage() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Unsubscribe
      </h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Configure unsubscribe pages and email preferences - coming soon.
      </p>
      <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">
        You will be able to customize recipient preferences and one-click
        unsubscribe behavior for reminders.
      </p>
    </div>
  );
}
