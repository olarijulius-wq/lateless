import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
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
  primaryButtonClasses,
  secondaryButtonClasses,
  toolbarButtonClasses,
} from '@/app/ui/button';
import { DARK_INPUT, DARK_SURFACE } from '@/app/ui/theme/tokens';

export const metadata: Metadata = {
  title: 'Invoice',
};

const STRIPE_FEE_LOW_PCT = 0.029;
const STRIPE_FEE_LOW_FIXED = 30;
const STRIPE_FEE_HIGH_PCT = 0.039;
const STRIPE_FEE_HIGH_FIXED = 50;

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
  const statusAction =
    invoice.status === 'paid' ? 'pending' : 'paid';
  const statusLabel =
    invoice.status === 'paid' ? 'Mark as pending' : 'Mark as paid';
  const updateStatus = updateInvoiceStatus.bind(
    null,
    invoice.id,
    statusAction,
  );
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000');
  const payLink = generatePayLink(baseUrl, invoice.id);
  const canExportPdf = PLAN_CONFIG[plan].canExportCsv;
  let feePreview = computeInvoiceFeeBreakdown(
    invoice.amount,
    PRICING_FEE_CONFIG.processingUplift.enabledByDefault,
  );
  try {
    feePreview = await computeInvoiceFeeBreakdownForUser(
      userEmail,
      invoice.amount,
    );
  } catch (error) {
    if (!isPricingFeesMigrationRequiredError(error)) {
      throw error;
    }
  }
  const connectStatus = await fetchStripeConnectStatusForUser(userEmail);
  const hasConnect = !!connectStatus.accountId?.trim();
  const hasProcessingIncluded = feePreview.processingUpliftAmount > 0;
  const payerTotal =
    typeof invoice.payable_amount === 'number'
      ? invoice.payable_amount
      : feePreview.payableAmount;
  const platformFee =
    typeof invoice.platform_fee_amount === 'number'
      ? invoice.platform_fee_amount
      : feePreview.platformFeeAmount;
  const stripeFeeLow =
    Math.round(payerTotal * STRIPE_FEE_LOW_PCT) + STRIPE_FEE_LOW_FIXED;
  const stripeFeeHigh =
    Math.round(payerTotal * STRIPE_FEE_HIGH_PCT) + STRIPE_FEE_HIGH_FIXED;
  const stripeNetLow = payerTotal - stripeFeeHigh;
  const stripeNetHigh = payerTotal - stripeFeeLow;
  const estimatedMerchantLow = Math.max(0, stripeNetLow - platformFee);
  const estimatedMerchantHigh = Math.max(0, stripeNetHigh - platformFee);
  const stripeNetAmount = invoice.stripe_net_amount;
  const merchantNetAmount =
    typeof invoice.merchant_net_amount === 'number'
      ? invoice.merchant_net_amount
      : invoice.net_received_amount;
  const hasStripeNet =
    invoice.status === 'paid' && typeof stripeNetAmount === 'number';
  const hasMerchantNet =
    invoice.status === 'paid' && typeof merchantNetAmount === 'number';
  const actualNetCurrency = invoice.currency ?? 'EUR';
  const pdfTitle = canExportPdf
    ? 'Download PDF'
    : 'Available on Solo, Pro, and Studio plans';
  const pdfEnabledClass = `${secondaryButtonClasses} h-9 px-3`;
  const pdfDisabledClass = `${secondaryButtonClasses} h-9 cursor-not-allowed px-3 opacity-60`;

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-zinc-100">
            Invoice {displayNumber}
          </h1>
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            {invoice.customer_name} • {invoice.customer_email}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/invoices/${invoice.id}/edit`}
            className={`${toolbarButtonClasses} h-9 px-3`}
          >
            Edit
          </Link>
          <Link
            href="/dashboard/invoices"
            className={`${toolbarButtonClasses} h-9 px-3`}
          >
            Back
          </Link>
        </div>
      </div>

      <div className={`rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_12px_24px_rgba(15,23,42,0.06)] ${DARK_SURFACE} dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-600 dark:text-zinc-400">Amount</p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-zinc-100">
              {formatCurrency(invoice.amount)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-600 dark:text-zinc-400">Date</p>
            <p className="text-sm text-slate-700 dark:text-zinc-200">
              {formatDateToLocal(invoice.date)}
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">Due date</p>
            <p className="text-sm text-slate-700 dark:text-zinc-200">
              {invoice.due_date ? formatDateToLocal(invoice.due_date) : '—'}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600 dark:text-zinc-400">Status</p>
            <InvoiceStatus status={invoice.status} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="flex flex-col items-start gap-1">
            {canExportPdf ? (
              <Link
                href={`/api/invoices/${invoice.id}/pdf`}
                className={pdfEnabledClass}
                title={pdfTitle}
              >
                Download PDF
              </Link>
            ) : (
              <span
                className={pdfDisabledClass}
                title={pdfTitle}
                aria-disabled="true"
              >
                Download PDF
              </span>
            )}
            {!canExportPdf && (
              <p className="text-xs text-slate-600 dark:text-zinc-400">
                Available on Solo, Pro, and Studio plans.
              </p>
            )}
          </div>
          <form action={updateStatus}>
            <button
              type="submit"
              className={`${primaryButtonClasses} px-3 py-2`}
            >
              {statusLabel}
            </button>
          </form>
          {canPayInvoiceStatus(invoice.status) &&
            (hasConnect ? (
              <PayInvoiceButton invoiceId={invoice.id} />
            ) : (
              <Link
                href="/dashboard/settings/payouts"
                className={`${secondaryButtonClasses} h-9 px-3`}
              >
                Connect Stripe to pay
              </Link>
            ))}
          <DuplicateInvoiceButton id={invoice.id} />
        </div>
      </div>

      <div className={`rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_12px_24px_rgba(15,23,42,0.06)] ${DARK_SURFACE} dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]`}>
        <div className="mb-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Fee preview
          </p>
          <div className="mt-3 grid gap-2 text-sm text-slate-700 dark:text-zinc-200">
            <div className="flex items-center justify-between">
              <span>Base amount</span>
              <span>{formatCurrency(feePreview.baseAmount)}</span>
            </div>
            {hasProcessingIncluded ? (
              <div className="flex items-center justify-between">
                <span>{PRICING_FEE_CONFIG.processingUplift.payerLabel}</span>
                <span>{formatCurrency(feePreview.processingUpliftAmount)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span>Fees</span>
              <span>{formatCurrency(feePreview.platformFeeAmount)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-2 font-semibold text-white dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200">
              <span>Estimated range:</span>
              <span>
                {formatCurrency(estimatedMerchantLow)} –{' '}
                {formatCurrency(estimatedMerchantHigh)}
              </span>
            </div>
            {hasStripeNet ? (
              <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 font-semibold text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
                <span>Actual Stripe net (after processing)</span>
                <span>
                  {formatCurrency(stripeNetAmount, actualNetCurrency)}
                </span>
              </div>
            ) : null}
            {hasMerchantNet ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-semibold text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                <span>Actual merchant take-home (after platform fee)</span>
                <span>{formatCurrency(merchantNetAmount, actualNetCurrency)}</span>
              </div>
            ) : null}
          </div>
          {hasProcessingIncluded ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              Payment processing is included in the payer total.
            </p>
          ) : null}
          {invoice.status === 'paid' && (!hasStripeNet || !hasMerchantNet) ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
              Actual will appear after Stripe confirms fees.
            </p>
          ) : null}
          <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
            Estimated range depends on payment method and card country. Actual
            amounts appear after Stripe confirms fees.
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Stripe dashboard &apos;Net&apos; usually equals Stripe net (before platform fee).
          </p>
        </div>

        <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
          Client payment link
        </p>
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
      </div>
    </main>
  );
}
