import { Metadata } from 'next';
import CustomersTable from '@/app/ui/customers/table';
import { fetchFilteredCustomers, fetchUserPlanAndUsage } from '@/app/lib/data';
import Link from 'next/link';
import { Button } from '@/app/ui/button';
import Search from '@/app/ui/search';
import { lusitana } from '@/app/ui/fonts';
import ExportCustomersButton from './export-button';
import { PLAN_CONFIG } from '@/app/lib/config';

export const metadata: Metadata = {
  title: 'Customers',
};

export default async function Page(props: {
  searchParams?: Promise<{
    query?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const query = searchParams?.query || '';

  const [customers, plan] = await Promise.all([
    fetchFilteredCustomers(query),
    fetchUserPlanAndUsage(),
  ]);
  const canExportCsv = PLAN_CONFIG[plan.plan].canExportCsv;

  return (
    <div className="w-full">
      {/* Title */}
      <h1 className={`${lusitana.className} mb-3 text-xl text-slate-100 md:text-2xl`}>
        Customers
      </h1>

      {/* Search + buttons ROW (search on the LEFT, buttons on the RIGHT) */}
      <div className="mb-4 flex w-full items-center justify-between gap-3">
        <Search placeholder="Search customers..." />
        <div className="flex items-center gap-2">
          <ExportCustomersButton canExportCsv={canExportCsv} />
          <Link href="/dashboard/customers/create" className="shrink-0">
            <Button className="border border-slate-300 bg-white text-slate-900 shadow-[0_6px_14px_rgba(15,23,42,0.16)] hover:border-slate-300 hover:bg-slate-100">
              Create customer
            </Button>
          </Link>
        </div>
      </div>

      {/* Table */}
      <CustomersTable customers={customers} />
    </div>
  );
}
