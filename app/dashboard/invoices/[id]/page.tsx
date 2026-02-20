import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import PaidInvoiceRefresh from './paid-invoice-refresh';
import InvoiceStatus from '@/app/ui/invoices/status';
import DuplicateInvoiceButton from '@/app/ui/invoices/duplicate-button';
import PayInvoiceButton from '@/app/ui/invoices/pay-button';
import CopyLinkButton from '@/app/ui/invoices/copy-link-button';
import { formatCurrency, formatDateToLocal } from '@/app/lib/utils';
import {
  fetchInvoiceById,
  fetchStripeConnectStatusForUser,
  fetchUserPlanAndUsage,
  requireUserEmail,
} from '@/app/lib/data';
import { updateInvoiceStatus } from '@/app/lib/actions';
import { generatePayLink } from '@/app/lib/pay-link';
import { canPayInvoiceStatus } from '@/app/lib/invoice-status';
import { PLAN_CONFIG } from '@/app/lib/config';
import {
  PRICING_FEE_CONFIG,
  computeInvoiceFeeBreakdown,
  computeInvoiceFeeBreakdownForUser,
  isPricingFeesMigrationRequiredError,
} from '@/app/lib/pricing-fees';
import {
  estimateStripeProcessingFee,
  resolveStripeProcessingEstimatorScopeForUser,
} from '@/app/lib/stripe-processing-estimator';
import {
  primaryButtonClasses,
  secondaryButtonClasses,
  toolbarButtonClasses,
} from '@/app/ui/button';
import { DARK_INPUT } from '@/app/ui/theme/tokens';
import SendInvoiceButton from '@/app/ui/invoices/send-invoice-button';
import SendReminderNowButton from '@/app/ui/invoices/send-reminder-now-button';
import {
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
  type WorkspaceRole,
} from '@/app/lib/workspaces';
import { isSettingsRemindersAdminEmail } from '@/app/lib/admin-gates';
import { PageShell, SectionCard, TwoColumnDetail } from '@/app/ui/page-layout';

export const metadata: Metadata = {
  title: 'Invoice',
};
export const dynamic = 'force-dynamic';
const STRIPE_FEE_LOW_PCT = 0.029;
const STRIPE_FEE_LOW_FIXED = 30;
const STRIPE_FEE_HIGH_PCT = 0.039;
const STRIPE_FEE_HIGH_FIXED = 50;

function isInvoiceOverdue(dueDate: string | null, status: string) {
  if (!dueDate) return false;
  if (status === 'paid') return false;
  const due = new Date(`${dueDate}T00:00:00.000Z`);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < Date.now();
}

function sanitizeInvoiceReturnTo(returnTo: string | undefined) {
  if (!returnTo) return '/dashboard/invoices';
  if (
    returnTo.startsWith('/dashboard/invoices') ||
    returnTo.startsWith('/dashboard/customers')
  ) {
    return returnTo;
  }
  return '/dashboard/invoices';
}

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ paid?: string; returnTo?: string }>;
}) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const justPaid = searchParams?.paid === '1';
  const returnTo = sanitizeInvoiceReturnTo(searchParams?.returnTo);
  const id = params.id;
  const [invoice, { plan }, userEmail] = await Promise.all([
    fetchInvoiceById(id),
    fetchUserPlanAndUsage(),
    requireUserEmail(),
  ]);

  if (!invoice) {
    notFound();
  }

  const shortId = invoice.id.slice(0, 8);
  const displayNumber = invoice.invoice_number ?? `#${shortId}`;
  const statusAction = invoice.status === 'paid' ? 'pending' : 'paid';
  const statusLabel = invoice.status === 'paid' ? 'Mark as pending' : 'Mark as paid';
  const updateStatus = updateInvoiceStatus.bind(null, invoice.id, statusAction);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const payLink = generatePayLink(baseUrl, invoice.id);
  const canExportPdf = PLAN_CONFIG[plan].canExportCsv;
  let feePreview = computeInvoiceFeeBreakdown(
    invoice.amount,
    PRICING_FEE_CONFIG.processingUplift.enabledByDefault,
  );
  try {
    feePreview = await computeInvoiceFeeBreakdownForUser(userEmail, invoice.amount);
  } catch (error) {
    if (!isPricingFeesMigrationRequiredError(error)) {
      throw error;
    }
  }
  const connectStatus = await fetchStripeConnectStatusForUser(userEmail);
  let userRole: WorkspaceRole = 'member';
  try {
    const workspaceContext = await ensureWorkspaceContextForCurrentUser();
    userRole = workspaceContext.userRole;
  } catch (error) {
    if (!isTeamMigrationRequiredError(error)) {
      console.error('Failed to resolve workspace role for invoice detail:', error);
    }
  }
  const canTriggerReminders =
    (userRole === 'owner' || userRole === 'admin') &&
    PLAN_CONFIG[plan].hasReminders &&
    isSettingsRemindersAdminEmail(userEmail);
  const overdue = isInvoiceOverdue(invoice.due_date, invoice.status);
  const hasConnect = !!connectStatus.accountId?.trim();
  const payerTotal =
    invoice.status === 'paid' && typeof invoice.payable_amount === 'number'
      ? invoice.payable_amount
      : feePreview.payableAmount;
  const chargeAmountCents = payerTotal;
  const stripeProcessingEstimatorScope = await resolveStripeProcessingEstimatorScopeForUser(userEmail);
  const stripeProcessingEstimate =
    invoice.status !== 'paid' && chargeAmountCents > 0
      ? await estimateStripeProcessingFee({
          scope: stripeProcessingEstimatorScope,
          currency: invoice.currency ?? 'EUR',
          chargeAmountCents,
        })
      : null;
  const platformFeePreview = feePreview.platformFeeAmount;
  const platformFee =
    invoice.status === 'paid' && typeof invoice.platform_fee_amount === 'number'
      ? invoice.platform_fee_amount
      : platformFeePreview;
  const stripeFeeLow = Math.round(chargeAmountCents * STRIPE_FEE_LOW_PCT) + STRIPE_FEE_LOW_FIXED;
  const stripeFeeHigh = Math.round(chargeAmountCents * STRIPE_FEE_HIGH_PCT) + STRIPE_FEE_HIGH_FIXED;
  const fallbackEstimatedMerchantLow = Math.max(0, chargeAmountCents - stripeFeeHigh - platformFee);
  const fallbackEstimatedMerchantHigh = Math.max(0, chargeAmountCents - stripeFeeLow - platformFee);
  const estimatedMerchantLow =
    stripeProcessingEstimate?.ok && typeof stripeProcessingEstimate.highCents === 'number'
      ? Math.max(0, chargeAmountCents - stripeProcessingEstimate.highCents - platformFee)
      : fallbackEstimatedMerchantLow;
  const estimatedMerchantHigh =
    stripeProcessingEstimate?.ok && typeof stripeProcessingEstimate.lowCents === 'number'
      ? Math.max(0, chargeAmountCents - stripeProcessingEstimate.lowCents - platformFee)
      : fallbackEstimatedMerchantHigh;
  const usingFallbackRange = !stripeProcessingEstimate?.ok;
  const stripeNetAmount = invoice.stripe_net_amount;
  const stripeProcessingFeeAmount = invoice.stripe_processing_fee_amount;
  const merchantNetAmount =
    typeof stripeNetAmount === 'number'
      ? stripeNetAmount
      : typeof invoice.merchant_net_amount === 'number'
        ? invoice.merchant_net_amount
        : invoice.net_received_amount;
  const hasStripeNet = invoice.status === 'paid' && typeof stripeNetAmount === 'number';
  const hasMerchantNet = invoice.status === 'paid' && typeof merchantNetAmount === 'number';
  const hasActualStripeProcessingFee =
    invoice.status === 'paid' && typeof stripeProcessingFeeAmount === 'number';
  const actualNetCurrency = invoice.currency ?? 'EUR';
  const actualStripeFeeCurrency = invoice.stripe_processing_fee_currency ?? actualNetCurrency;
  const stripeFeeOnlyCents =
    hasActualStripeProcessingFee ? Math.max(0, (stripeProcessingFeeAmount ?? 0) - platformFee) : null;
  const pdfTitle = canExportPdf ? 'Download PDF' : 'Available on Solo, Pro, and Studio plans';
  const pdfEnabledClass = `${secondaryButtonClasses} h-9 px-3`;
  const pdfDisabledClass = `${secondaryButtonClasses} h-9 cursor-not-allowed px-3 opacity-60`;

  return (
    <PageShell
      title={`Invoice ${displayNumber}`}
      subtitle={`${invoice.customer_name} • ${invoice.customer_email}`}
      actions={
        <>
          <Link
            href={`/dashboard/invoices/${invoice.id}/edit?returnTo=${encodeURIComponent(returnTo)}`}
            className={`${toolbarButtonClasses} h-9 px-3`}
          >
            Edit
          </Link>
          <Link href={returnTo} className={`${toolbarButtonClasses} h-9 px-3`}>
            Back
          </Link>
        </>
      }
    >
      {justPaid ? <PaidInvoiceRefresh /> : null}
      <TwoColumnDetail
        primary={
          <>
            <SectionCard className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-zinc-400">
                    Amount
                  </p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-zinc-100">
                    {formatCurrency(invoice.amount)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <InvoiceStatus status={invoice.status} />
                  {overdue ? (
                    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                      Overdue
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.1em] text-slate-500 dark:text-zinc-400">
                    Issue date
                  </p>
                  <p className="font-medium text-slate-900 dark:text-zinc-100">
                    {formatDateToLocal(invoice.date)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.1em] text-slate-500 dark:text-zinc-400">
                    Due date
                  </p>
                  <p className="font-medium text-slate-900 dark:text-zinc-100">
                    {invoice.due_date ? formatDateToLocal(invoice.due_date) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.1em] text-slate-500 dark:text-zinc-400">
                    Paid at
                  </p>
                  <p className="font-medium text-slate-900 dark:text-zinc-100">
                    {invoice.paid_at ? formatDateToLocal(invoice.paid_at) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.1em] text-slate-500 dark:text-zinc-400">
                    Customer
                  </p>
                  <p className="truncate font-medium text-slate-900 dark:text-zinc-100">
                    {invoice.customer_name}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-col items-start gap-1">
                  {canExportPdf ? (
                    <Link href={`/api/invoices/${invoice.id}/pdf`} className={pdfEnabledClass} title={pdfTitle}>
                      Download PDF
                    </Link>
                  ) : (
                    <span className={pdfDisabledClass} title={pdfTitle} aria-disabled="true">
                      Download PDF
                    </span>
                  )}
                </div>
                <form action={updateStatus}>
                  <button type="submit" className={`${primaryButtonClasses} px-3 py-2`}>
                    {statusLabel}
                  </button>
                </form>
                <SendInvoiceButton
                  invoiceId={invoice.id}
                  returnTo={returnTo}
                  initialStatus={invoice.last_email_status}
                  initialSentAt={invoice.last_email_sent_at}
                  initialError={invoice.last_email_error}
                  redirectToReturnTo
                />
                {canPayInvoiceStatus(invoice.status) &&
                  (hasConnect ? (
                    <PayInvoiceButton invoiceId={invoice.id} />
                  ) : (
                    <Link href="/dashboard/settings/payouts" className={`${secondaryButtonClasses} h-9 px-3`}>
                      Connect Stripe to pay
                    </Link>
                  ))}
                <DuplicateInvoiceButton id={invoice.id} />
              </div>
            </SectionCard>

            <SectionCard className="space-y-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Recent activity</p>
              <ul className="space-y-2 text-sm text-slate-700 dark:text-zinc-300">
                <li className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                  <span>Last invoice email</span>
                  <span>
                    {invoice.last_email_status
                      ? `${invoice.last_email_status}${invoice.last_email_sent_at ? ` • ${formatDateToLocal(invoice.last_email_sent_at)}` : ''}`
                      : 'Not sent'}
                  </span>
                </li>
                <li className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                  <span>Last reminder</span>
                  <span>
                    {invoice.last_reminder_sent_at ? formatDateToLocal(invoice.last_reminder_sent_at) : '—'}
                  </span>
                </li>
                <li className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800">
                  <span>Payment</span>
                  <span>{invoice.paid_at ? `Paid • ${formatDateToLocal(invoice.paid_at)}` : 'Unpaid'}</span>
                </li>
              </ul>
            </SectionCard>

            <SectionCard>
              <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Fee preview</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-700 dark:text-zinc-200">
                <div className="flex items-center justify-between">
                  <span>Base amount</span>
                  <span>{formatCurrency(feePreview.baseAmount)}</span>
                </div>
                {hasActualStripeProcessingFee ? (
                  <div className="flex items-center justify-between">
                    <span>Actual Stripe processing fee</span>
                    <span>{formatCurrency(stripeFeeOnlyCents ?? 0, actualStripeFeeCurrency)}</span>
                  </div>
                ) : invoice.status !== 'paid' ? (
                  <div className="flex items-center justify-between">
                    <span>Estimated Stripe processing</span>
                    <span>
                      {stripeProcessingEstimate?.ok &&
                      typeof stripeProcessingEstimate.feeEstimateCents === 'number' &&
                      typeof stripeProcessingEstimate.lowCents === 'number' &&
                      typeof stripeProcessingEstimate.highCents === 'number'
                        ? `~${formatCurrency(stripeProcessingEstimate.feeEstimateCents, invoice.currency ?? 'EUR')} (${formatCurrency(stripeProcessingEstimate.lowCents, invoice.currency ?? 'EUR')}–${formatCurrency(stripeProcessingEstimate.highCents, invoice.currency ?? 'EUR')})`
                        : 'Depends on payment method/card country'}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span>Platform fee</span>
                  <span>{formatCurrency(platformFee)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-2 font-semibold text-white dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200">
                  <span>Estimated range</span>
                  <span>
                    {formatCurrency(estimatedMerchantLow)} – {formatCurrency(estimatedMerchantHigh)}
                  </span>
                </div>
                {hasStripeNet ? (
                  <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 font-semibold text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
                    <span>Actual Stripe net</span>
                    <span>{formatCurrency(stripeNetAmount, actualNetCurrency)}</span>
                  </div>
                ) : null}
                {hasMerchantNet ? (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-semibold text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                    <span>Actual take-home</span>
                    <span>{formatCurrency(merchantNetAmount, actualNetCurrency)}</span>
                  </div>
                ) : null}
              </div>
              {usingFallbackRange ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                  Estimate uses default Stripe fee assumptions until enough payments exist.
                </p>
              ) : null}
            </SectionCard>

            <SectionCard>
              <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Client payment link</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                Share this link with your client. They can pay without logging in.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={payLink}
                  className={`min-w-0 w-full flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 outline-none ${DARK_INPUT}`}
                />
                <CopyLinkButton text={payLink} />
              </div>
            </SectionCard>
          </>
        }
        secondary={
          <>
            <SectionCard className="space-y-2">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-zinc-400">Customer</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{invoice.customer_name}</p>
              <p className="text-sm text-slate-600 dark:text-zinc-400">{invoice.customer_email}</p>
              <Link
                href={`/dashboard/customers/${invoice.customer_id}?returnTo=${encodeURIComponent('/dashboard/customers')}`}
                className={`${toolbarButtonClasses} h-9 px-3 text-sm`}
              >
                Open customer
              </Link>
            </SectionCard>

            <SectionCard className="space-y-2">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-zinc-400">Payment</p>
              <p className="text-sm text-slate-700 dark:text-zinc-300">
                Status: <span className="font-medium">{invoice.status}</span>
              </p>
              <p className="text-sm text-slate-700 dark:text-zinc-300">
                Paid at: {invoice.paid_at ? formatDateToLocal(invoice.paid_at) : '—'}
              </p>
              <p className="text-sm text-slate-700 dark:text-zinc-300">
                Stripe connected: {hasConnect ? 'Yes' : 'No'}
              </p>
            </SectionCard>

            <SectionCard className="space-y-2">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-zinc-400">Reminders</p>
              <p className="text-sm text-slate-700 dark:text-zinc-300">Level: {invoice.reminder_level ?? 0}</p>
              <p className="text-sm text-slate-700 dark:text-zinc-300">
                Last reminder:{' '}
                {invoice.last_reminder_sent_at ? formatDateToLocal(invoice.last_reminder_sent_at) : '—'}
              </p>
              <p className="text-sm text-slate-700 dark:text-zinc-300">
                Last email: {invoice.last_email_status ?? 'Not sent'}
              </p>
              {overdue && canTriggerReminders ? <SendReminderNowButton /> : null}
            </SectionCard>
          </>
        }
      />
    </PageShell>
  );
}
