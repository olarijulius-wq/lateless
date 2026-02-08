import { CheckIcon, ClockIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

export default function InvoiceStatus({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
        {
          'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-400/50 dark:bg-amber-500/10 dark:text-amber-300':
            status === 'pending',
          'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-400/50 dark:bg-emerald-500/10 dark:text-emerald-300':
            status === 'paid',
        },
      )}
    >
      {status === 'pending' ? (
        <>
          Pending
          <ClockIcon className="ml-1 w-4 text-amber-700 dark:text-amber-300" />
        </>
      ) : null}
      {status === 'paid' ? (
        <>
          Paid
          <CheckIcon className="ml-1 w-4 text-emerald-700 dark:text-emerald-300" />
        </>
      ) : null}
    </span>
  );
}
