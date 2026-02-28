import clsx from 'clsx';
import Link from 'next/link';
import { toolbarButtonClasses } from '@/app/ui/button';

type PayInvoiceButtonProps = {
  invoiceId: string;
  disabled?: boolean;
  className?: string;
};

export default function PayInvoiceButton({
  invoiceId,
  disabled = false,
  className,
}: PayInvoiceButtonProps) {
  const payNowButtonClasses = clsx(
    toolbarButtonClasses,
    'pointer-events-auto relative z-10 whitespace-nowrap',
  );

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className={clsx(payNowButtonClasses, className)}
        data-row-nav-stop
      >
        Pay now
      </button>
    );
  }

  return (
    <Link
      href={`/api/invoices/${invoiceId}/pay-link`}
      prefetch={false}
      className={clsx(payNowButtonClasses, className)}
      data-row-nav-stop
    >
      Pay now
    </Link>
  );
}
