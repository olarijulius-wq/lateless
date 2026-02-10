import { Metadata } from 'next';
import { lusitana } from '@/app/ui/fonts';
import Pagination from '@/app/ui/invoices/pagination';
import Table from '@/app/ui/invoices/table';
import { CreateInvoice } from '@/app/ui/invoices/buttons';
import {
  fetchFilteredInvoices,
  fetchInvoicesPages,
  fetchUserPlanAndUsage,
} from '@/app/lib/data';
import ExportInvoicesButton from './export-button';
import { PLAN_CONFIG } from '@/app/lib/config';
import { RevealOnMount } from '@/app/ui/motion/reveal';
import { primaryButtonClasses, secondaryButtonClasses } from '@/app/ui/button';
import MobileExpandableSearchToolbar from '@/app/ui/dashboard/mobile-expandable-search-toolbar';

export const metadata: Metadata = {
  title: 'Invoices',
};
 
export default async function Page(props: {
  searchParams?: Promise<{
    query?: string;
    page?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const query = searchParams?.query || '';
  const currentPage = Number(searchParams?.page) || 1;

  const [invoices, totalPages, plan] = await Promise.all([
    fetchFilteredInvoices(query, currentPage),
    fetchInvoicesPages(query),
    fetchUserPlanAndUsage(),
  ]);

  const { plan: planId, invoiceCount, maxPerMonth } = plan;
  const hasUnlimited = !Number.isFinite(maxPerMonth);
  const canCreate = hasUnlimited || invoiceCount < maxPerMonth;
  const canExportCsv = PLAN_CONFIG[planId].canExportCsv;
  const planName = PLAN_CONFIG[planId].name;
  const limitLabel = Number.isFinite(maxPerMonth) ? maxPerMonth : 'unlimited';

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

        <MobileExpandableSearchToolbar
          searchPlaceholder="Search invoices..."
          actions={
            <>
              <ExportInvoicesButton canExportCsv={canExportCsv} />
              {canCreate && <CreateInvoice />}
              {!canCreate && (
                <a
                  href="/dashboard/settings"
                  className={`hidden sm:inline-flex ${secondaryButtonClasses} px-3 py-2 text-xs`}
                >
                  View all plans
                </a>
              )}
            </>
          }
        />
      </RevealOnMount>

      {!canCreate && (
        <>
          <p className="hidden text-xs text-amber-800 dark:text-amber-200 sm:block">
            {planName} plan limit reached. Upgrade to keep sending invoices.
          </p>
          <div className="rounded-xl border border-amber-300 bg-amber-100 p-4 text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100 sm:hidden">
            <p className="text-sm font-semibold">
              {planName} plan limit reached
            </p>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-100/80">
              You have used all {limitLabel} invoices for this month.
            </p>
            <a
              href="/dashboard/settings"
              className={`${primaryButtonClasses} mt-3 w-full px-3 py-2 text-xs`}
            >
              View all plans
            </a>
          </div>
        </>
      )}

      {!hasUnlimited && (
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {invoiceCount} / {maxPerMonth} invoices used on {planId} plan.
        </p>
      )}

      <RevealOnMount delay={0.12}>
        <div>
          <Table invoices={invoices} />
          <div className="mt-6 flex w-full justify-center">
            <Pagination totalPages={totalPages} />
          </div>
        </div>
      </RevealOnMount>
    </main>
  );
}
