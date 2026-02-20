import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import {
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
} from '@/app/lib/workspaces';
import {
  listReminderRunLogs,
  isReminderRunLogsMigrationRequiredError,
  type ReminderRunLogRecord,
} from '@/app/lib/reminder-run-logs';
import RemindersAdminPanel from './reminders-admin-panel';
import { isSettingsRemindersAdminEmail } from '@/app/lib/admin-gates';

export const metadata: Metadata = {
  title: 'Reminders Admin',
};

export default async function RemindersAdminPage() {
  let migrationWarning: string | null = null;
  let runs: ReminderRunLogRecord[] = [];

  try {
    const context = await ensureWorkspaceContextForCurrentUser();
    const hasWorkspaceAccess =
      context.userRole === 'owner' || context.userRole === 'admin';
    const canView =
      hasWorkspaceAccess && isSettingsRemindersAdminEmail(context.userEmail);

    if (!canView) {
      notFound();
    }

    runs = await listReminderRunLogs(20);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      redirect('/login?callbackUrl=/dashboard/settings/reminders');
    }

    if (
      isTeamMigrationRequiredError(error) ||
      isReminderRunLogsMigrationRequiredError(error)
    ) {
      migrationWarning =
        'Reminder admin logs unavailable. Run migration 027_add_reminder_runs_admin_log.sql.';
    } else {
      throw error;
    }
  }

  return (
    <div className="space-y-4">
      {migrationWarning ? (
        <p className="rounded-xl border border-amber-300 bg-amber-100 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          {migrationWarning}
        </p>
      ) : null}
      <RemindersAdminPanel runs={runs} />
    </div>
  );
}
