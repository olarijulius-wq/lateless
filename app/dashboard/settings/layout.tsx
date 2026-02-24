import SettingsSectionsNav from '@/app/ui/dashboard/settings-sections-nav';
import { diagnosticsEnabled } from '@/app/lib/admin-gates';
import { ensureWorkspaceContextForCurrentUser } from '@/app/lib/workspaces';
import { isReminderManualRunAdmin } from '@/app/lib/reminder-admin';
import { isInternalAdminEmail } from '@/app/lib/internal-admin-email';
import { buildSettingsSections } from '@/app/lib/settings-sections';
import { PageShell, SectionCard } from '@/app/ui/page-layout';

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const diagnosticsEnabledFlag = diagnosticsEnabled();
  let canViewFunnel = false;
  let canViewBillingEvents = false;
  let isInternalAdmin = false;
  let canViewLaunchCheck = false;
  let canViewSmokeCheck = false;
  let canViewAllChecks = false;

  try {
    const context = await ensureWorkspaceContextForCurrentUser();
    isInternalAdmin = isInternalAdminEmail(context.userEmail);
    const hasWorkspaceAccess =
      context.userRole === 'owner' || context.userRole === 'admin';
    canViewFunnel =
      hasWorkspaceAccess && isInternalAdmin && isReminderManualRunAdmin(context.userEmail);
    canViewBillingEvents = hasWorkspaceAccess && isInternalAdmin;
    canViewLaunchCheck = hasWorkspaceAccess && isInternalAdmin;
    canViewSmokeCheck = hasWorkspaceAccess && isInternalAdmin;
    canViewAllChecks = diagnosticsEnabledFlag && canViewLaunchCheck && canViewSmokeCheck;
  } catch {
    canViewFunnel = false;
    canViewBillingEvents = false;
    isInternalAdmin = false;
    canViewLaunchCheck = false;
    canViewSmokeCheck = false;
    canViewAllChecks = false;
  }
  const sections = buildSettingsSections({
    isInternalAdmin,
    canViewBillingEvents,
    canViewLaunchCheck,
    canViewSmokeCheck,
    canViewAllChecks,
    canViewFunnel,
    diagnosticsEnabled: diagnosticsEnabledFlag,
  });

  return (
    <PageShell
      title="Settings"
      subtitle="Workspace-level configuration for usage, billing, team, integrations, and documents."
      className="max-w-5xl"
    >
      <SectionCard className="p-4">
        <SettingsSectionsNav sections={sections} />
      </SectionCard>
      {children}
    </PageShell>
  );
}
