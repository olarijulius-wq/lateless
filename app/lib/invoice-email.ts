import 'server-only';

import { sql } from '@/app/lib/db';
import { generatePayLink } from '@/app/lib/pay-link';
import { sendWorkspaceEmail } from '@/app/lib/smtp-settings';
import { formatCurrency, formatDateToLocal } from '@/app/lib/utils';

export type InvoiceEmailLogStatus = 'sent' | 'failed';

export function normalizeInvoiceEmailError(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    if (/RESEND_API_KEY/i.test(error.message)) {
      return 'Email provider is not configured. Configure Resend in environment variables.';
    }
    if (/SMTP settings are incomplete/i.test(error.message)) {
      return 'SMTP settings are incomplete. Open Settings -> SMTP and save valid values.';
    }
    return error.message;
  }
  return 'Failed to send invoice email.';
}

export function buildInvoiceSendContent(input: {
  invoiceId: string;
  invoiceNumber: string | null;
  amount: number;
  dueDate: string | null;
  customerName: string;
  baseUrl: string;
}) {
  const invoiceLabel = input.invoiceNumber ?? `#${input.invoiceId.slice(0, 8)}`;
  const payLink = generatePayLink(input.baseUrl, input.invoiceId);
  const dueDateLabel = input.dueDate ? formatDateToLocal(input.dueDate) : 'No due date';
  const amountLabel = formatCurrency(input.amount);
  const subject = `Invoice ${invoiceLabel} from Lateless`;
  const bodyText = [
    `Hi ${input.customerName},`,
    '',
    `Your invoice ${invoiceLabel} is ready.`,
    `Amount: ${amountLabel}`,
    `Due date: ${dueDateLabel}`,
    `Pay now: ${payLink}`,
    '',
    'Thank you,',
    'Lateless',
  ].join('\n');
  const bodyHtml = `
    <p>Hi ${input.customerName},</p>
    <p>Your invoice <strong>${invoiceLabel}</strong> is ready.</p>
    <ul>
      <li><strong>Amount:</strong> ${amountLabel}</li>
      <li><strong>Due date:</strong> ${dueDateLabel}</li>
    </ul>
    <p><a href="${payLink}">Pay now</a></p>
    <p>Thank you,<br/>Lateless</p>
  `;
  return { subject, bodyText, bodyHtml };
}

export async function insertInvoiceEmailLog(input: {
  invoiceId: string;
  userEmail: string;
  toEmail: string;
  provider: string;
  status: InvoiceEmailLogStatus;
  sentAt?: string | null;
  error?: string | null;
}) {
  try {
    await sql`
      insert into public.invoice_email_logs (
        invoice_id,
        user_email,
        to_email,
        provider,
        status,
        sent_at,
        error
      )
      values (
        ${input.invoiceId},
        ${input.userEmail},
        ${input.toEmail},
        ${input.provider},
        ${input.status},
        ${input.sentAt ?? null},
        ${input.error ? input.error.slice(0, 400) : null}
      )
    `;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '42P01'
    ) {
      throw new Error(
        'Invoice email logging requires DB migration 033_add_job_locks_and_invoice_email_logs.sql.',
      );
    }
    throw error;
  }
}

export async function sendInvoiceEmail(input: {
  workspaceId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  amount: number;
  dueDate: string | null;
  customerName: string;
  customerEmail: string;
  userEmail: string;
  baseUrl: string;
}) {
  const content = buildInvoiceSendContent({
    invoiceId: input.invoiceId,
    invoiceNumber: input.invoiceNumber,
    amount: input.amount,
    dueDate: input.dueDate,
    customerName: input.customerName,
    baseUrl: input.baseUrl,
  });

  const sentAtIso = new Date().toISOString();
  try {
    const delivery = await sendWorkspaceEmail({
      workspaceId: input.workspaceId,
      toEmail: input.customerEmail,
      subject: content.subject,
      bodyHtml: content.bodyHtml,
      bodyText: content.bodyText,
    });

    await insertInvoiceEmailLog({
      invoiceId: input.invoiceId,
      userEmail: input.userEmail,
      toEmail: input.customerEmail,
      provider: delivery.provider,
      status: 'sent',
      sentAt: sentAtIso,
      error: null,
    });

    return { provider: delivery.provider, sentAt: sentAtIso };
  } catch (error) {
    const message = normalizeInvoiceEmailError(error);
    await insertInvoiceEmailLog({
      invoiceId: input.invoiceId,
      userEmail: input.userEmail,
      toEmail: input.customerEmail,
      provider: 'unknown',
      status: 'failed',
      sentAt: null,
      error: message,
    });
    throw new Error(message);
  }
}
