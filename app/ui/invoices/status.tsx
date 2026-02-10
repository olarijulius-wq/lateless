import { CheckIcon, ClockIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { DARK_PILL } from '@/app/ui/theme/tokens';

export default function InvoiceStatus({ status }: { status: string }) {
  const isKnownStatus = status === 'pending' || status === 'paid';

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
        {
          [DARK_PILL]: !isKnownStatus,
          'border-amber-500 bg-amber-500 text-black dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200':
            status === 'pending',
          'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200':
            status === 'paid',
        },
      )}
    >
      {status === 'pending' ? (
        <>
          Pending
          <ClockIcon className="ml-1 w-4 text-amber-700 dark:text-amber-400" />
        </>
      ) : null}
      {status === 'paid' ? (
        <>
          Paid
          <CheckIcon className="ml-1 w-4 text-emerald-100 dark:text-emerald-400" />
        </>
      ) : null}
    </span>
  );
}
