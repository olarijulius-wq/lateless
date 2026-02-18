import { Metadata } from 'next';
import CustomersTable from '@/app/ui/customers/table';
import { fetchFilteredCustomers, fetchUserPlanAndUsage } from '@/app/lib/data';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/app/ui/button';
import { lusitana } from '@/app/ui/fonts';
import ExportCustomersButton from './export-button';
import { PLAN_CONFIG } from '@/app/lib/config';
import { RevealOnMount } from '@/app/ui/motion/reveal';
import MobileExpandableSearchToolbar from '@/app/ui/dashboard/mobile-expandable-search-toolbar';
import { auth } from '@/auth';

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
  const session = await auth();
  if (!session?.user?.email) {
    const callbackUrl = query
      ? `/dashboard/customers?query=${encodeURIComponent(query)}`
      : '/dashboard/customers';
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const [customers, plan] = await Promise.all([
    fetchFilteredCustomers(query),
    fetchUserPlanAndUsage(),
  ]);
  const canExportCsv = PLAN_CONFIG[plan.plan].canExportCsv;

  return (
    <div className="w-full">
      <RevealOnMount>
        {/* Title */}
        <h1
          className={`${lusitana.className} mb-3 text-xl text-slate-900 dark:text-slate-100 md:text-2xl`}
        >
          Customers
        </h1>

        <MobileExpandableSearchToolbar
          searchPlaceholder="Search customers..."
          actions={
            <>
              <ExportCustomersButton canExportCsv={canExportCsv} />
              <Link href="/dashboard/customers/create" className="shrink-0">
                <Button variant="toolbar">
                  Create customer
                </Button>
              </Link>
            </>
          }
        />
      </RevealOnMount>

      {/* Table */}
      <RevealOnMount delay={0.12}>
        <CustomersTable customers={customers} />
      </RevealOnMount>
    </div>
  );
}
