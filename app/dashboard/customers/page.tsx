import { Metadata } from 'next';
import CustomersTable from '@/app/ui/customers/table';
import { fetchFilteredCustomers } from '@/app/lib/data';
import Link from 'next/link';
import { Button } from '@/app/ui/button';
import Search from '@/app/ui/search';
import { lusitana } from '@/app/ui/fonts';
import ExportCustomersButton from './export-button';

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

  const customers = await fetchFilteredCustomers(query);

  return (
    <div className="w-full">
      {/* Title */}
      <h1 className={`${lusitana.className} mb-3 text-xl md:text-2xl`}>
        Customers
      </h1>

      {/* Search + buttons ROW (search on the LEFT, buttons on the RIGHT) */}
      <div className="mb-4 flex w-full items-center justify-between gap-3">
        <Search placeholder="Search customers..." />
        <div className="flex items-center gap-2">
          <ExportCustomersButton />
          <Link href="/dashboard/customers/create" className="shrink-0">
            <Button>Create customer</Button>
          </Link>
        </div>
      </div>

      {/* Table */}
      <CustomersTable customers={customers} />
    </div>
  );
}
