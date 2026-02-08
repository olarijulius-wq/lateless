import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documents Settings',
};

export default function DocumentsSettingsPage() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Documents
      </h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Document templates and storage settings - coming soon.
      </p>
      <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">
        This section will host invoice/PDF template controls and document
        storage preferences.
      </p>
    </div>
  );
}
