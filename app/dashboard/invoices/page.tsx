import { Metadata } from 'next';
import { lusitana } from '@/app/ui/fonts';
import Pagination from '@/app/ui/invoices/pagination';
import Table from '@/app/ui/invoices/table';
import { CreateInvoice } from '@/app/ui/invoices/buttons';
import {
  fetchFilteredInvoices,
  fetchInvoicesPages,
  fetchUserInvoiceUsageProgress,
  fetchStripeConnectAccountId,
} from '@/app/lib/data';
import ExportInvoicesButton from './export-button';
import { PLAN_CONFIG } from '@/app/lib/config';
import { RevealOnMount } from '@/app/ui/motion/reveal';
import { toolbarButtonClasses } from '@/app/ui/button';
import MobileExpandableSearchToolbar from '@/app/ui/dashboard/mobile-expandable-search-toolbar';
import UpgradeNudge from '@/app/ui/upgrade-nudge';

export const metadata: Metadata = {
  title: 'Invoices',
};
 
export default async function Page(props: {
  searchParams?: Promise<{
    query?: string;
    page?: string;
    interval?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const query = searchParams?.query || '';
  const currentPage = Number(searchParams?.page) || 1;
  const interval = searchParams?.interval;

  const [invoices, totalPages, usage, stripeConnectAccountId] = await Promise.all([
    fetchFilteredInvoices(query, currentPage),
    fetchInvoicesPages(query),
    fetchUserInvoiceUsageProgress(),
    fetchStripeConnectAccountId(),
  ]);

  const { planId, usedThisMonth, maxPerMonth, percentUsed } = usage;
  const isBlocked = maxPerMonth !== null && percentUsed >= 1;
  const canExportCsv = PLAN_CONFIG[planId].canExportCsv;

  return (
    <main>
      <RevealOnMount>
        <div className="mb-3">
          <h1
            className={`${lusitana.className} text-xl text-slate-900 dark:text-slate-100 md:text-2xl`}
          >
            Invoices
          </h1>
        </div>

        <div className="mb-4">
          <UpgradeNudge
            planId={planId}
            usedThisMonth={usedThisMonth}
            cap={maxPerMonth}
            percentUsed={percentUsed}
            interval={interval}
          />
        </div>

        <MobileExpandableSearchToolbar
          searchPlaceholder="Search invoices..."
          actions={
            <>
              <ExportInvoicesButton canExportCsv={canExportCsv} />
              {!isBlocked && <CreateInvoice />}
              {isBlocked && (
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className={`${toolbarButtonClasses} cursor-not-allowed opacity-60`}
                >
                  <span>Create Invoice</span>
                </button>
              )}
            </>
          }
        />
      </RevealOnMount>

      {maxPerMonth !== null && (
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {usedThisMonth} / {maxPerMonth} invoices used on {planId} plan.
        </p>
      )}

      <RevealOnMount delay={0.12}>
        <div>
          <Table
            invoices={invoices}
            hasStripeConnect={!!stripeConnectAccountId}
          />
          <div className="mt-6 flex w-full justify-center">
            <Pagination totalPages={totalPages} />
          </div>
        </div>
      </RevealOnMount>
    </main>
  );
}
