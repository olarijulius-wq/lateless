import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import RemindersPanel from './reminders-panel';
import {
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
} from '@/app/lib/workspaces';
import {
  fetchWorkspaceEmailSettings,
  isSmtpMigrationRequiredError,
  type WorkspaceEmailSettings,
} from '@/app/lib/smtp-settings';
import {
  fetchUnsubscribeSettings,
  isUnsubscribeMigrationRequiredError,
} from '@/app/lib/unsubscribe';
import {
  assertReminderPauseSchemaReady,
  isReminderPauseMigrationRequiredError,
} from '@/app/lib/reminder-pauses';
import { generatePayLink } from '@/app/lib/pay-link';
import type { ReminderPanelItem } from './reminders-panel';
import { fetchWorkspaceDunningState } from '@/app/lib/billing-dunning';
import DashboardPageTitle from '@/app/ui/dashboard/page-title';
import { getEffectiveMailConfig } from '@/app/lib/email';
import { startDashboardRouteTrace } from '@/app/lib/dashboard-debug';
import { fetchUpcomingReminders } from '@/app/lib/reminders-dashboard-data';

export const metadata: Metadata = {
  title: 'Reminders',
};

function formatAmount(amount: number) {
  return (amount / 100).toLocaleString('en-GB', {
    style: 'currency',
    currency: 'EUR',
  });
}

function formatDate(value: string | Date) {
  const parsed =
    value instanceof Date
      ? value
      : /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? new Date(`${value}T00:00:00Z`)
        : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return 'Invalid date';
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(parsed);
}

function resolveBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000')
  );
}

function getEmailDomain(email: string) {
  const [, domain] = email.trim().toLowerCase().split('@');
  return domain || null;
}

function toSafeIso(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

export default async function RemindersPage() {
  const finishRouteTrace = startDashboardRouteTrace({ route: '/dashboard/reminders' });
  try {
    let workspaceContext;
    try {
      workspaceContext = await ensureWorkspaceContextForCurrentUser();
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        redirect('/login');
        return;
      }
      throw error;
    }
    const dunningState = await fetchWorkspaceDunningState(workspaceContext.workspaceId);
    const showRecoveryWarning = Boolean(dunningState?.recoveryRequired);
    const baseUrl = resolveBaseUrl();

    let emailSettings: WorkspaceEmailSettings | null = null;
    let smtpMigrationWarning: string | null = null;
    try {
      emailSettings = await fetchWorkspaceEmailSettings(workspaceContext.workspaceId);
    } catch (error) {
      if (isSmtpMigrationRequiredError(error)) {
        smtpMigrationWarning =
          'Email provider settings unavailable. Run migrations 008_add_workspace_email_settings.sql and 021_add_workspace_smtp_password_encryption.sql.';
      } else {
        throw error;
      }
    }

    let unsubscribeEnabled = false;
    let includeUnsubscribeJoin = false;
    try {
      const unsubscribeSettings = await fetchUnsubscribeSettings(workspaceContext.workspaceId);
      unsubscribeEnabled = unsubscribeSettings.enabled;
      includeUnsubscribeJoin = true;
    } catch (error) {
      if (!isUnsubscribeMigrationRequiredError(error)) {
        throw error;
      }
    }

    let reminderPauseMigrationWarning: string | null = null;
    let includeReminderPauseJoin = false;
    try {
      await assertReminderPauseSchemaReady();
      includeReminderPauseJoin = true;
    } catch (error) {
      if (isReminderPauseMigrationRequiredError(error)) {
        reminderPauseMigrationWarning =
          'Pause controls unavailable. Run migration 015_add_reminder_pauses.sql.';
      } else {
        throw error;
      }
    }

    const rows = await fetchUpcomingReminders(
      workspaceContext.workspaceId,
      includeUnsubscribeJoin,
      includeReminderPauseJoin,
    );
    finishRouteTrace({
      workspaceId: workspaceContext.workspaceId,
      userId: workspaceContext.userId,
      reminderCount: rows.length,
    });
    const senderConfigured = getEffectiveMailConfig({
      workspaceSettings: emailSettings
        ? {
            provider: emailSettings.provider,
            fromEmail: emailSettings.fromEmail,
            smtpHost: emailSettings.smtpHost,
            smtpPort: emailSettings.smtpPort,
            smtpUsername: emailSettings.smtpUsername,
            smtpPasswordPresent: emailSettings.smtpPasswordPresent,
          }
        : null,
    }).ok;

    const items: ReminderPanelItem[] = rows.map((row) => {
      const reminderNumber = row.reminder_level + 1;
      const amountLabel = formatAmount(row.amount);
      const dueDateLabel = formatDate(row.due_date);
      const nextSendDateLabel = formatDate(row.next_send_date);
      const customerEmail = row.customer_email?.trim() ?? '';
      const skipReason = !senderConfigured
        ? 'Blocked: sender not configured'
        : row.skip_reason ?? null;
      const willSend: ReminderPanelItem['willSend'] =
        row.will_send && senderConfigured ? 'yes' : 'no';

      let payLinkPreview = `${baseUrl}/pay/${row.invoice_id}`;
      try {
        payLinkPreview = generatePayLink(baseUrl, row.invoice_id);
      } catch {
        payLinkPreview = `${baseUrl}/pay/${row.invoice_id}`;
      }

      const invoiceLabel = row.invoice_number?.trim() || row.invoice_id;
      const subject = `Invoice reminder #${reminderNumber}: ${amountLabel} due`;
      const previewBody = [
        `Invoice: ${invoiceLabel}`,
        `Customer: ${row.customer_name}`,
        `Amount: ${amountLabel}`,
        `Due date: ${dueDateLabel}`,
        `Next send date: ${nextSendDateLabel}`,
        `Reminder level: ${row.reminder_level}`,
        `Last reminder sent: ${
          row.last_reminder_sent_at ? formatDate(row.last_reminder_sent_at) : 'Never'
        }`,
        `Pause state: ${row.pause_state ? row.pause_state.replace('_', ' ') : 'Not paused'}`,
        `Unsubscribed: ${row.is_unsubscribed ? 'Yes' : 'No'}`,
        `Missing email: ${customerEmail ? 'No' : 'Yes'}`,
        `Will send: ${row.will_send ? 'Yes' : 'No'}`,
        `Pay link: ${payLinkPreview}`,
        ...(unsubscribeEnabled ? ['Unsubscribe link included when enabled for workspace.'] : []),
      ].join('\n');

      return {
        invoiceId: row.invoice_id,
        invoiceLabel,
        amountLabel,
        dueDateLabel,
        nextSendDateLabel,
        reminderNumber,
        customerName: row.customer_name,
        customerEmail,
        status: row.status === 'paid' ? 'paid' : 'pending',
        reason: row.cadence_reason,
        willSend,
        skipReason,
        pauseState: row.pause_state,
        isUnsubscribed: row.is_unsubscribed,
        unsubscribeEnabled: unsubscribeEnabled && row.unsubscribe_enabled,
        isInvoicePaused: row.invoice_paused,
        isCustomerPaused: row.customer_paused,
        dueDateIso: toSafeIso(row.due_date) ?? '',
        nextSendDateIso: toSafeIso(row.next_send_date) ?? '',
        lastReminderSentAtIso: toSafeIso(row.last_reminder_sent_at),
        reminderLevel: row.reminder_level,
        subject,
        previewBody,
      };
    });

    const canRunReminders =
      workspaceContext.userRole === 'owner' || workspaceContext.userRole === 'admin';
    const resendDomain = getEmailDomain(emailSettings?.fromEmail ?? '');

    return (
      <div className="space-y-6">
        {showRecoveryWarning ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-100 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            Billing warning: payment recovery is required. Resolve billing to keep reminders running without interruption.
          </div>
        ) : null}
        <DashboardPageTitle
          title="Reminders"
          description="Forecast upcoming reminder emails and preview content."
          meta={`Company: ${workspaceContext.workspaceName} · Role: ${workspaceContext.userRole}`}
        />
        <RemindersPanel
          items={items}
          canRunReminders={canRunReminders}
          smtpMigrationWarning={smtpMigrationWarning}
          emailProvider={emailSettings?.provider ?? null}
          smtpHost={emailSettings?.smtpHost ?? null}
          fromEmail={emailSettings?.fromEmail ?? null}
          resendDomain={resendDomain}
          canManagePauses={canRunReminders}
          pauseMigrationWarning={reminderPauseMigrationWarning}
        />
      </div>
    );
  } catch (error) {
    finishRouteTrace({
      error: error instanceof Error ? error.message : 'unknown',
    });
    if (isTeamMigrationRequiredError(error)) {
      return (
        <div className="rounded-2xl border border-amber-300 bg-amber-100 p-5 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          Reminders view requires team migration support. Run
          {' '}
          <code>007_add_workspaces_and_team.sql</code>
          {' '}
          and
          {' '}
          <code>013_add_active_workspace_and_company_profile_workspace_scope.sql</code>.
        </div>
      );
    }
    throw error;
  }
}
