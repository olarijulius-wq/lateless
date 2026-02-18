import { Metadata } from 'next';
import CompanyProfileSettingsPanel from './company-profile-settings-panel';
import { fetchCompanyProfileForWorkspace } from '@/app/lib/company-profile';
import {
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
} from '@/app/lib/workspaces';

export const metadata: Metadata = {
  title: 'Company Profile',
};

export default async function CompanyProfileSettingsPage() {
  let panelData:
    | {
        profile: Awaited<ReturnType<typeof fetchCompanyProfileForWorkspace>>;
        userRole: 'owner' | 'admin' | 'member';
      }
    | null = null;

  try {
    const context = await ensureWorkspaceContextForCurrentUser();
    const profile = await fetchCompanyProfileForWorkspace(context.workspaceId);
    panelData = {
      profile,
      userRole: context.userRole,
    };
  } catch (error) {
    if (isTeamMigrationRequiredError(error)) {
      return (
        <div className="mx-auto w-full max-w-5xl">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-amber-500/35 dark:bg-amber-500/10 dark:shadow-[0_16px_34px_rgba(0,0,0,0.42)]">
            <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-200">
              Team requires a database migration
            </h2>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-100">
              Run migrations <code>007_add_workspaces_and_team.sql</code> and{' '}
              <code>013_add_active_workspace_and_company_profile_workspace_scope.sql</code>{' '}
              and retry.
            </p>
          </div>
        </div>
      );
    }

    throw error;
  }

  if (!panelData) {
    throw new Error('Failed to load company profile settings.');
  }

  return (
    <CompanyProfileSettingsPanel
      initialProfile={panelData.profile}
      canEdit={panelData.userRole === 'owner' || panelData.userRole === 'admin'}
      userRole={panelData.userRole}
    />
  );
}
