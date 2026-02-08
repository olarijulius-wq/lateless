import SettingsSectionsNav from '@/app/ui/dashboard/settings-sections-nav';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-5xl space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Settings
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Workspace-level configuration for usage, billing, team, integrations,
          and documents.
        </p>
        <SettingsSectionsNav />
      </div>
      {children}
    </div>
  );
}
