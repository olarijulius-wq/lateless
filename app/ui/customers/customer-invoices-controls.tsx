'use client';

import clsx from 'clsx';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  secondaryButtonClasses,
  toolbarButtonClasses,
} from '@/app/ui/button';
import SelectTrigger from '@/app/ui/list-controls/select-trigger';
import {
  listControlsLabelClasses,
  listControlsPanelClasses,
  listControlsRowClasses,
} from '@/app/ui/list-controls/styles';
import Search from '@/app/ui/search';
import type {
  CustomerInvoiceSortDir,
  CustomerInvoiceSortKey,
  InvoiceStatusFilter,
} from '@/app/lib/data';

type CustomerInvoicesControlsProps = {
  statusFilter: InvoiceStatusFilter;
  sortKey: CustomerInvoiceSortKey;
  sortDir: CustomerInvoiceSortDir;
  pageSize: number;
};

export default function CustomerInvoicesControls({
  statusFilter,
  sortKey,
  sortDir,
  pageSize,
}: CustomerInvoicesControlsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const replaceWithParams = (updater: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams);
    updater(params);
    params.set('ciPage', '1');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className={clsx(listControlsPanelClasses, 'gap-2')}>
      <div className="flex flex-wrap items-center gap-2">
        {([
          ['all', 'All'],
          ['unpaid', 'Unpaid'],
          ['overdue', 'Overdue'],
          ['paid', 'Paid'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              replaceWithParams((params) => {
                if (value === 'all') {
                  params.delete('ciStatus');
                } else {
                  params.set('ciStatus', value);
                }
              });
            }}
            className={clsx(
              statusFilter === value ? toolbarButtonClasses : secondaryButtonClasses,
              'h-9 px-3 text-xs md:text-sm',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <Search
          placeholder="Search this customer's invoices..."
          queryParam="ciQuery"
          pageParam="ciPage"
          className="min-w-0 md:max-w-lg"
        />
        <div className={listControlsRowClasses}>
          <label className={listControlsLabelClasses} htmlFor="customer-invoice-sort">
            Sort
          </label>
          <SelectTrigger
            id="customer-invoice-sort"
            value={sortKey}
            onChange={(event) => {
              replaceWithParams((params) => {
                params.set('ciSort', event.target.value);
              });
            }}
            className="min-w-32"
          >
            <option value="due_date">Due date</option>
            <option value="amount">Amount</option>
            <option value="created_at">Created date</option>
          </SelectTrigger>
          <SelectTrigger
            aria-label="Sort direction"
            value={sortDir}
            onChange={(event) => {
              replaceWithParams((params) => {
                params.set('ciDir', event.target.value);
              });
            }}
            className="min-w-24"
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </SelectTrigger>
          <label className={listControlsLabelClasses} htmlFor="customer-invoice-page-size">
            Rows
          </label>
          <SelectTrigger
            id="customer-invoice-page-size"
            value={String(pageSize)}
            onChange={(event) => {
              replaceWithParams((params) => {
                params.set('ciPageSize', event.target.value);
              });
            }}
            className="min-w-24"
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </SelectTrigger>
        </div>
      </div>
    </div>
  );
}
