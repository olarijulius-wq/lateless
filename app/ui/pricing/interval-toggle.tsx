import Link from 'next/link';
import type { BillingInterval } from '@/app/lib/config';

export default function IntervalToggle({
  interval,
  monthlyHref,
  annualHref,
}: {
  interval: BillingInterval;
  monthlyHref: string;
  annualHref: string;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-900/70">
      <Link
        href={monthlyHref}
        className={`rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black ${
          interval === 'monthly'
            ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
            : 'border-neutral-200 bg-white text-black hover:border-neutral-300 hover:bg-neutral-50 dark:border-transparent dark:bg-transparent dark:text-neutral-300 dark:hover:text-white'
        }`}
      >
        Monthly
      </Link>
      <Link
        href={annualHref}
        className={`rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black ${
          interval === 'annual'
            ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
            : 'border-neutral-200 bg-white text-black hover:border-neutral-300 hover:bg-neutral-50 dark:border-transparent dark:bg-transparent dark:text-neutral-300 dark:hover:text-white'
        }`}
      >
        Annual
      </Link>
    </div>
  );
}
