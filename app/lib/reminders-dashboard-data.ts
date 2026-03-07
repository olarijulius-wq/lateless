import 'server-only';

import { sql } from '@/app/lib/db';
import { logDashboardQuery } from '@/app/lib/dashboard-debug';
import { getRequestMetricsMeta } from '@/app/lib/request-context';

export type ReminderQueryRow = {
  invoice_id: string;
  invoice_number: string | null;
  amount: number;
  due_date: string | Date;
  reminder_level: number;
  last_reminder_sent_at: string | Date | null;
  status: string;
  customer_name: string;
  customer_email: string | null;
  owner_verified: boolean;
  next_send_date: string | Date;
  cadence_reason: string;
  unsubscribe_enabled: boolean;
  is_unsubscribed: boolean;
  invoice_paused: boolean;
  customer_paused: boolean;
  pause_state: 'invoice_paused' | 'customer_paused' | null;
  skip_reason: string | null;
  will_send: boolean;
};

export async function fetchUpcomingReminders(
  workspaceId: string,
  includeUnsubscribeJoin: boolean,
  includeReminderPauseJoin: boolean,
) {
  const startedAt = Date.now();
  const complete = (rowCount: number) => {
    const { route, method } = getRequestMetricsMeta();
    logDashboardQuery({
      route,
      method,
      label: 'reminders.upcoming',
      durationMs: Date.now() - startedAt,
      details: {
        workspaceId,
        includeUnsubscribeJoin,
        includeReminderPauseJoin,
        rowCount,
      },
    });
  };

  if (includeUnsubscribeJoin && includeReminderPauseJoin) {
    const rows = await sql<ReminderQueryRow[]>`
      SELECT
        invoices.id AS invoice_id,
        invoices.invoice_number,
        invoices.amount,
        invoices.due_date,
        invoices.reminder_level,
        invoices.last_reminder_sent_at,
        invoices.status,
        customers.name AS customer_name,
        customers.email AS customer_email,
        users.is_verified AS owner_verified,
        CASE
          WHEN invoices.reminder_level = 0 THEN GREATEST(invoices.due_date + 1, ((now() at time zone 'Europe/Tallinn')::date))
          WHEN invoices.reminder_level = 1 THEN (invoices.last_reminder_sent_at + interval '7 days')::date
          WHEN invoices.reminder_level = 2 THEN (invoices.last_reminder_sent_at + interval '14 days')::date
          ELSE ((now() at time zone 'Europe/Tallinn')::date)
        END AS next_send_date,
        CASE
          WHEN invoices.reminder_level = 0 THEN 'Overdue'
          WHEN invoices.reminder_level = 1 THEN '7d since last reminder'
          WHEN invoices.reminder_level = 2 THEN '14d since last reminder'
          ELSE 'Pending'
        END AS cadence_reason,
        COALESCE(unsub_settings.enabled, true) AS unsubscribe_enabled,
        (unsub.normalized_email IS NOT NULL) AS is_unsubscribed,
        (invoice_pauses.invoice_id IS NOT NULL) AS invoice_paused,
        (customer_pauses.normalized_email IS NOT NULL) AS customer_paused,
        CASE
          WHEN invoice_pauses.invoice_id IS NOT NULL THEN 'invoice_paused'
          WHEN customer_pauses.normalized_email IS NOT NULL THEN 'customer_paused'
          ELSE null
        END AS pause_state,
        CASE
          WHEN users.is_verified <> true THEN 'Blocked: sender not verified'
          WHEN invoice_pauses.invoice_id IS NOT NULL THEN 'Blocked: reminders paused'
          WHEN customer_pauses.normalized_email IS NOT NULL THEN 'Blocked: reminders paused'
          WHEN trim(coalesce(customers.email, '')) = '' THEN 'Blocked: missing payer email'
          WHEN COALESCE(unsub_settings.enabled, true) AND unsub.normalized_email IS NOT NULL THEN 'Blocked: unsubscribed'
          ELSE null
        END AS skip_reason,
        NOT (
          users.is_verified <> true
          OR
          invoice_pauses.invoice_id IS NOT NULL
          OR customer_pauses.normalized_email IS NOT NULL
          OR trim(coalesce(customers.email, '')) = ''
          OR (COALESCE(unsub_settings.enabled, true) AND unsub.normalized_email IS NOT NULL)
        ) AS will_send
      FROM public.invoices
      JOIN public.customers
        ON customers.id = invoices.customer_id
       AND customers.workspace_id = ${workspaceId}
      JOIN public.users
        ON lower(users.email) = lower(invoices.user_email)
      JOIN public.workspace_members wm
        ON wm.user_id = users.id
       AND wm.workspace_id = ${workspaceId}
      LEFT JOIN public.workspace_unsubscribe_settings unsub_settings
        ON unsub_settings.workspace_id = wm.workspace_id
      LEFT JOIN public.workspace_unsubscribes unsub
        ON unsub.workspace_id = wm.workspace_id
       AND unsub.normalized_email = lower(trim(customers.email))
      LEFT JOIN public.invoice_reminder_pauses invoice_pauses
        ON invoice_pauses.invoice_id = invoices.id
      LEFT JOIN public.workspace_reminder_customer_pauses customer_pauses
        ON customer_pauses.workspace_id = wm.workspace_id
       AND customer_pauses.normalized_email = lower(trim(customers.email))
      WHERE
        invoices.workspace_id = ${workspaceId}
        AND lower(coalesce(invoices.status, '')) NOT IN ('paid', 'void', 'draft')
        AND invoices.due_date IS NOT NULL
        AND invoices.due_date < ((now() at time zone 'Europe/Tallinn')::date)
      ORDER BY
        next_send_date ASC,
        invoices.id ASC
      LIMIT 50
    `;
    complete(rows.length);
    return rows;
  }

  if (includeUnsubscribeJoin) {
    const rows = await sql<ReminderQueryRow[]>`
      SELECT
        invoices.id AS invoice_id,
        invoices.invoice_number,
        invoices.amount,
        invoices.due_date,
        invoices.reminder_level,
        invoices.last_reminder_sent_at,
        invoices.status,
        customers.name AS customer_name,
        customers.email AS customer_email,
        users.is_verified AS owner_verified,
        CASE
          WHEN invoices.reminder_level = 0 THEN GREATEST(invoices.due_date + 1, ((now() at time zone 'Europe/Tallinn')::date))
          WHEN invoices.reminder_level = 1 THEN (invoices.last_reminder_sent_at + interval '7 days')::date
          WHEN invoices.reminder_level = 2 THEN (invoices.last_reminder_sent_at + interval '14 days')::date
          ELSE ((now() at time zone 'Europe/Tallinn')::date)
        END AS next_send_date,
        CASE
          WHEN invoices.reminder_level = 0 THEN 'Overdue'
          WHEN invoices.reminder_level = 1 THEN '7d since last reminder'
          WHEN invoices.reminder_level = 2 THEN '14d since last reminder'
          ELSE 'Pending'
        END AS cadence_reason,
        COALESCE(unsub_settings.enabled, true) AS unsubscribe_enabled,
        (unsub.normalized_email IS NOT NULL) AS is_unsubscribed,
        false AS invoice_paused,
        false AS customer_paused,
        null AS pause_state,
        CASE
          WHEN users.is_verified <> true THEN 'Blocked: sender not verified'
          WHEN trim(coalesce(customers.email, '')) = '' THEN 'Blocked: missing payer email'
          WHEN COALESCE(unsub_settings.enabled, true) AND unsub.normalized_email IS NOT NULL THEN 'Blocked: unsubscribed'
          ELSE null
        END AS skip_reason,
        NOT (
          users.is_verified <> true
          OR
          trim(coalesce(customers.email, '')) = ''
          OR (COALESCE(unsub_settings.enabled, true) AND unsub.normalized_email IS NOT NULL)
        ) AS will_send
      FROM public.invoices
      JOIN public.customers
        ON customers.id = invoices.customer_id
       AND customers.workspace_id = ${workspaceId}
      JOIN public.users
        ON lower(users.email) = lower(invoices.user_email)
      JOIN public.workspace_members wm
        ON wm.user_id = users.id
       AND wm.workspace_id = ${workspaceId}
      LEFT JOIN public.workspace_unsubscribe_settings unsub_settings
        ON unsub_settings.workspace_id = wm.workspace_id
      LEFT JOIN public.workspace_unsubscribes unsub
        ON unsub.workspace_id = wm.workspace_id
       AND unsub.normalized_email = lower(trim(customers.email))
      WHERE
        invoices.workspace_id = ${workspaceId}
        AND lower(coalesce(invoices.status, '')) NOT IN ('paid', 'void', 'draft')
        AND invoices.due_date IS NOT NULL
        AND invoices.due_date < ((now() at time zone 'Europe/Tallinn')::date)
      ORDER BY
        next_send_date ASC,
        invoices.id ASC
      LIMIT 50
    `;
    complete(rows.length);
    return rows;
  }

  const rows = await sql<ReminderQueryRow[]>`
    SELECT
      invoices.id AS invoice_id,
      invoices.invoice_number,
      invoices.amount,
      invoices.due_date,
      invoices.reminder_level,
      invoices.last_reminder_sent_at,
      invoices.status,
      customers.name AS customer_name,
      customers.email AS customer_email,
      users.is_verified AS owner_verified,
      CASE
        WHEN invoices.reminder_level = 0 THEN GREATEST(invoices.due_date + 1, ((now() at time zone 'Europe/Tallinn')::date))
        WHEN invoices.reminder_level = 1 THEN (invoices.last_reminder_sent_at + interval '7 days')::date
        WHEN invoices.reminder_level = 2 THEN (invoices.last_reminder_sent_at + interval '14 days')::date
        ELSE ((now() at time zone 'Europe/Tallinn')::date)
      END AS next_send_date,
      CASE
        WHEN invoices.reminder_level = 0 THEN 'Overdue'
        WHEN invoices.reminder_level = 1 THEN '7d since last reminder'
        WHEN invoices.reminder_level = 2 THEN '14d since last reminder'
        ELSE 'Pending'
      END AS cadence_reason,
      false AS unsubscribe_enabled,
      false AS is_unsubscribed,
      false AS invoice_paused,
      false AS customer_paused,
      null AS pause_state,
      CASE
        WHEN users.is_verified <> true THEN 'Blocked: sender not verified'
        WHEN trim(coalesce(customers.email, '')) = '' THEN 'Blocked: missing payer email'
        ELSE null
      END AS skip_reason,
      users.is_verified = true AND trim(coalesce(customers.email, '')) <> '' AS will_send
    FROM public.invoices
    JOIN public.customers
      ON customers.id = invoices.customer_id
     AND customers.workspace_id = ${workspaceId}
    JOIN public.users
      ON lower(users.email) = lower(invoices.user_email)
    JOIN public.workspace_members wm
      ON wm.user_id = users.id
      AND wm.workspace_id = ${workspaceId}
    WHERE
      invoices.workspace_id = ${workspaceId}
      AND lower(coalesce(invoices.status, '')) NOT IN ('paid', 'void', 'draft')
      AND invoices.due_date IS NOT NULL
      AND invoices.due_date < ((now() at time zone 'Europe/Tallinn')::date)
    ORDER BY
      next_send_date ASC,
      invoices.id ASC
    LIMIT 50
  `;
  complete(rows.length);
  return rows;
}
