import Link from 'next/link';
import {
  MARKETING_BUTTON_PRIMARY,
  MARKETING_CONTAINER_WIDE,
  MARKETING_SUBTLE_HOVER,
} from '@/app/ui/marketing/tokens';

const navAnchorClasses = `relative text-sm text-[color:var(--mk-fg-muted)] ${MARKETING_SUBTLE_HOVER} dark:after:absolute dark:after:bottom-[-6px] dark:after:left-0 dark:after:h-px dark:after:w-full dark:after:origin-left dark:after:scale-x-0 dark:after:bg-emerald-400/70 dark:after:transition-transform dark:after:duration-200 dark:hover:after:scale-x-100`;

export default function TopNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--mk-border)] bg-[color:var(--mk-bg)]/85 backdrop-blur-xl">
      <div className={`${MARKETING_CONTAINER_WIDE} flex h-16 items-center justify-between`}>
        <Link href="/" className="text-base font-medium tracking-tight text-[var(--mk-fg-strong)]">
          Lateless
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          <Link href="/pricing" className={navAnchorClasses}>
            Pricing
          </Link>
          <Link href="/faq" className={navAnchorClasses}>
            FAQ
          </Link>
          <Link href="/help" className={navAnchorClasses}>
            Help
          </Link>
          <Link href="/privacy" className={`${navAnchorClasses} hidden lg:inline`}>
            Privacy
          </Link>
          <Link href="/terms" className={`${navAnchorClasses} hidden lg:inline`}>
            Terms
          </Link>
          <Link href="/security" className={`${navAnchorClasses} hidden lg:inline`}>
            Security
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-full px-3 text-sm text-[color:var(--mk-fg-muted)] transition-colors duration-200 hover:bg-[color:var(--mk-surface)] hover:text-[var(--mk-fg-strong)] dark:hover:shadow-[0_0_0_1px_rgba(16,185,129,0.28)]"
          >
            Log in
          </Link>
          <Link href="/login?signup=1" className={MARKETING_BUTTON_PRIMARY}>
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
