'use client';

import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import Link from 'next/link';
import { generatePagination } from '@/app/lib/utils';
import { usePathname, useSearchParams } from 'next/navigation';

export default function Pagination({ totalPages }: { totalPages: number }) {
  // NOTE: Uncomment this code in Chapter 10
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPage = Number(searchParams.get('page')) || 1;
  const allPages = generatePagination(currentPage, totalPages);

  const createPageURL = (pageNumber: number | string) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };
  

  return (
    <>
      {/*  NOTE: Uncomment this code in Chapter 10 */}

      <div className="inline-flex">
        <PaginationArrow
          direction="left"
          href={createPageURL(currentPage - 1)}
          isDisabled={currentPage <= 1}
        />

        <div className="flex -space-x-px">
          {allPages.map((page, index) => {
            let position: 'first' | 'last' | 'single' | 'middle' | undefined;

            if (index === 0) position = 'first';
            if (index === allPages.length - 1) position = 'last';
            if (allPages.length === 1) position = 'single';
            if (page === '...') position = 'middle';

            return (
              <PaginationNumber
                key={`${page}-${index}`}
                href={createPageURL(page)}
                page={page}
                position={position}
                isActive={currentPage === page}
              />
            );
          })}
        </div>

        <PaginationArrow
          direction="right"
          href={createPageURL(currentPage + 1)}
          isDisabled={currentPage >= totalPages}
        />
      </div>
    </>
  );
}

function PaginationNumber({
  page,
  href,
  isActive,
  position,
}: {
  page: number | string;
  href: string;
  position?: 'first' | 'last' | 'middle' | 'single';
  isActive: boolean;
}) {
  const className = clsx(
    'flex h-10 w-10 items-center justify-center border border-neutral-300 bg-white text-sm text-neutral-900 transition duration-200 ease-out dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100',
    {
      'rounded-l-xl': position === 'first' || position === 'single',
      'rounded-r-xl': position === 'last' || position === 'single',
      'z-10 border-neutral-300 bg-neutral-100 text-neutral-900 shadow-[0_0_0_1px_rgba(15,23,42,0.08)] dark:border-slate-600/80 dark:bg-slate-900 dark:text-slate-100 dark:shadow-[0_0_0_1px_rgba(51,65,85,0.6)]':
        isActive,
      'hover:border-neutral-300 hover:bg-neutral-100 hover:scale-[1.01] dark:hover:border-slate-600 dark:hover:bg-slate-900/80': !isActive && position !== 'middle',
      'text-neutral-500 dark:text-slate-500': position === 'middle',
    },
  );

  return isActive || position === 'middle' ? (
    <div className={className}>{page}</div>
  ) : (
    <Link href={href} className={className}>
      {page}
    </Link>
  );
}

function PaginationArrow({
  href,
  direction,
  isDisabled,
}: {
  href: string;
  direction: 'left' | 'right';
  isDisabled?: boolean;
}) {
  const className = clsx(
    'flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-300 bg-white text-neutral-900 transition duration-200 ease-out dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-100',
    {
      'pointer-events-none text-neutral-400 dark:text-slate-600': isDisabled,
      'hover:border-neutral-300 hover:bg-neutral-100 hover:scale-[1.01] dark:hover:border-slate-600 dark:hover:bg-slate-900/80': !isDisabled,
      'mr-2 md:mr-4': direction === 'left',
      'ml-2 md:ml-4': direction === 'right',
    },
  );

  const icon =
    direction === 'left' ? (
      <ArrowLeftIcon className="w-4" />
    ) : (
      <ArrowRightIcon className="w-4" />
    );

  return isDisabled ? (
    <div className={className}>{icon}</div>
  ) : (
    <Link className={className} href={href}>
      {icon}
    </Link>
  );
}
