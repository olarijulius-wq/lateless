import Link from 'next/link';
import { SUPPORT_EMAIL } from '@/app/legal/constants';
import type { Metadata } from 'next';
import { RevealOnScroll } from '@/app/ui/motion/reveal';
import MarketingPageShell from '@/app/ui/marketing/page-shell';
import {
  MARKETING_BODY,
  MARKETING_BODY_MUTED,
  MARKETING_CONTAINER_READING,
  MARKETING_EYEBROW,
  MARKETING_H1,
  MARKETING_H3,
  MARKETING_PAGE_PY,
  MARKETING_SUBTLE_HOVER,
} from '@/app/ui/marketing/tokens';

export const metadata: Metadata = {
  title: 'Security',
  description: 'Security controls currently implemented in Lateless.',
  alternates: {
    canonical: '/security',
  },
  openGraph: {
    title: 'Lateless Security',
    description: 'Security controls currently implemented in Lateless.',
    url: '/security',
  },
};

export default function SecurityPage() {
  return (
    <MarketingPageShell mainClassName={`${MARKETING_CONTAINER_READING} ${MARKETING_PAGE_PY}`}>
      <RevealOnScroll>
        <div className="mb-8">
          <p className={MARKETING_EYEBROW}>Trust</p>
          <h1 className={`${MARKETING_H1} mt-2`}>Security</h1>
          <p className={`${MARKETING_BODY_MUTED} mt-3`}>
            Concrete controls currently implemented in this repository.
          </p>
        </div>
      </RevealOnScroll>

      <div className={`space-y-8 ${MARKETING_BODY}`}>
        <section>
          <h2 className={MARKETING_H3}>Authentication</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Email/password accounts require email verification before login.</li>
            <li>Passwords and one-time 2FA codes are hashed with bcrypt.</li>
            <li>Optional 2FA is supported with emailed 6-digit OTP codes.</li>
            <li>Google and GitHub OAuth are available when provider env vars are configured.</li>
            <li>Login attempts are rate-limited and failed attempts are tracked.</li>
          </ul>
        </section>

        <section>
          <h2 className={MARKETING_H3}>Payments</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Public invoice payments use Stripe Checkout sessions.</li>
            <li>Payouts run through Stripe Connect connected accounts.</li>
            <li>Platform fees are applied as Stripe application fees when configured by plan.</li>
            <li>Stripe webhooks validate the signature using `STRIPE_WEBHOOK_SECRET`.</li>
            <li>Webhook events are deduplicated by unique Stripe event ID before processing.</li>
          </ul>
        </section>

        <section>
          <h2 className={MARKETING_H3}>Data handling</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Application data is stored in Postgres.</li>
            <li>Sensitive credentials are loaded from environment variables.</li>
            <li>Workspace SMTP passwords are encrypted at rest (AES-256-GCM) when saved.</li>
          </ul>
        </section>

        <section>
          <h2 className={MARKETING_H3}>Operational safety</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Webhook processing is idempotent via event-level deduplication.</li>
            <li>Refund creation uses Stripe idempotency keys to avoid duplicate refunds.</li>
            <li>Basic abuse controls include login throttling and invoice creation safety limits.</li>
          </ul>
        </section>

        <section>
          <h2 className={MARKETING_H3}>Contact</h2>
          <p className="mt-2">
            Security questions and reports:{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className={`${MARKETING_SUBTLE_HOVER} text-[var(--mk-fg-strong)] hover:underline`}
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>

      <div className={`${MARKETING_BODY_MUTED} mt-10 border-t border-[color:var(--mk-border)] pt-6`}>
        <Link href="/" className={MARKETING_SUBTLE_HOVER}>
          Back to homepage
        </Link>
      </div>
    </MarketingPageShell>
  );
}
