import RevenueChart from '@/app/ui/dashboard/revenue-chart';
import LatestInvoices from '@/app/ui/dashboard/latest-invoices';
import LatePayers from '@/app/ui/dashboard/late-payers';
import { lusitana } from '@/app/ui/fonts';
import { Suspense } from 'react';
import CardWrapper from '@/app/ui/dashboard/cards';
import {
  RevenueChartSkeleton,
  LatestInvoicesSkeleton,
  CardsSkeleton,
} from '@/app/ui/skeletons';
import { Metadata } from 'next';
import { RevealOnMount } from '@/app/ui/motion/reveal';

export const metadata: Metadata = {
  title: 'Dashboard',
};
 

export default async function Page() {
  return (
    <main className="space-y-6">
      <h1 className={`${lusitana.className} text-xl text-slate-100 md:text-2xl`}>
        Dashboard
      </h1>

      {/* Cards ALATI üleval ja oma grid’is */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Suspense fallback={<CardsSkeleton />}>
          <CardWrapper />
        </Suspense>
      </div>

      <div className="space-y-6">
        <RevealOnMount delay={0.08}>
          <Suspense fallback={<RevenueChartSkeleton />}>
            <RevenueChart />
          </Suspense>
        </RevealOnMount>

        <div className="grid gap-6 md:grid-cols-2">
          <RevealOnMount delay={0.14} className="h-full">
            <Suspense fallback={<LatestInvoicesSkeleton />}>
              <LatestInvoices />
            </Suspense>
          </RevealOnMount>
          <RevealOnMount delay={0.2} className="h-full">
            <Suspense fallback={<LatestInvoicesSkeleton />}>
              <LatePayers />
            </Suspense>
          </RevealOnMount>
        </div>
      </div>
    </main>
  );
}
