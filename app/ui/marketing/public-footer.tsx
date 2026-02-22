import Link from 'next/link';
import { SUPPORT_EMAIL } from '@/app/legal/constants';
import {
  MARKETING_CONTAINER_WIDE,
  MARKETING_SUBTLE_HOVER,
} from '@/app/ui/marketing/tokens';

const footerLinkClasses = `${MARKETING_SUBTLE_HOVER} text-[color:var(--mk-fg-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mk-focus)]`;

export default function PublicFooter() {
  return (
    <footer className="relative z-10 border-t border-[color:var(--mk-border)]">
      <div className={`${MARKETING_CONTAINER_WIDE} flex flex-col gap-4 py-8 text-sm text-[color:var(--mk-fg-muted)] md:flex-row md:items-center md:justify-between`}>
        <p>Lateless - payment links, reminders, and Stripe payouts.</p>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-4">
          <Link href="/pricing" className={footerLinkClasses}>
            Pricing
          </Link>
          <Link href="/faq" className={footerLinkClasses}>
            FAQ
          </Link>
          <Link href="/help" className={footerLinkClasses}>
            Help
          </Link>
          <Link href="/privacy" className={footerLinkClasses}>
            Privacy
          </Link>
          <Link href="/terms" className={footerLinkClasses}>
            Terms
          </Link>
          <Link href="/security" className={footerLinkClasses}>
            Security
          </Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className={footerLinkClasses}>
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
