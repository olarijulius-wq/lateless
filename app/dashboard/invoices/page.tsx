import { Metadata } from 'next';
import { lusitana } from '@/app/ui/fonts';
import Search from '@/app/ui/search';
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
      <div className="mb-3">
        <h1 className={`${lusitana.className} text-xl md:text-2xl`}>
          Invoices
        </h1>
      </div>

      <div className="mb-4 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:flex-1">
          <Search placeholder="Search invoices..." />
        </div>
        <div className="flex items-center gap-3">
          <ExportInvoicesButton canExportCsv={canExportCsv} />
          {canCreate && <CreateInvoice />}
        </div>
      </div>

      {!canCreate && (
        <div className="mx-auto my-4 w-full max-w-xl rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-amber-100">
          <p className="text-sm font-semibold sm:text-base">
            {planName} plan limit reached
          </p>
          <p className="mt-1 text-xs text-amber-100/80 sm:text-sm">
            You have used all {limitLabel} invoices for this month. Upgrade to keep
            sending invoices.
          </p>
          <a
            href="/dashboard/settings"
            className="mt-3 inline-flex items-center rounded-md bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm shadow-amber-900/30 transition hover:bg-amber-300"
          >
            View plans
          </a>
        </div>
      )}

      {!hasUnlimited && (
        <p className="text-xs text-slate-400">
          {invoiceCount} / {maxPerMonth} invoices used on {planId} plan.
        </p>
      )}

      <Table invoices={invoices} />

      <div className="mt-6 flex w-full justify-center">
        <Pagination totalPages={totalPages} />
      </div>
    </main>
  );
}
