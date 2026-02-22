import Link from 'next/link';
import type { Metadata } from 'next';
import {
  LEGAL_LAST_UPDATED,
  PRIVACY_EMAIL,
  SUPPORT_EMAIL,
} from '@/app/legal/constants';
import { RevealOnScroll, StaggeredList } from '@/app/ui/motion/reveal';
import MarketingPageShell from '@/app/ui/marketing/page-shell';
import {
  MARKETING_BODY,
  MARKETING_BODY_MUTED,
  MARKETING_CARD_SURFACE_SOFT,
  MARKETING_CONTAINER_READING,
  MARKETING_EYEBROW,
  MARKETING_H1,
  MARKETING_H3,
  MARKETING_PAGE_PY,
  MARKETING_SUBTLE_HOVER,
} from '@/app/ui/marketing/tokens';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'Lateless privacy policy and data handling overview.',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: 'Lateless Privacy Policy',
    description: 'Lateless privacy policy and data handling overview.',
    url: '/privacy',
  },
};

const sections = [
  {
    title: 'What we process',
    body: 'We process account details, workspace and invoicing data, payment and billing metadata, and operational logs needed to run Lateless.',
  },
  {
    title: 'Why we process it',
    body: 'We use data to provide the service, secure accounts, process invoices and payouts, prevent abuse, and meet legal duties.',
  },
  {
    title: 'Processors',
    body: 'We use third-party processors including Stripe for payments and Resend for transactional email delivery.',
  },
];

export default function PrivacyPage() {
  return (
    <MarketingPageShell mainClassName={`${MARKETING_CONTAINER_READING} ${MARKETING_PAGE_PY}`}>
      <RevealOnScroll>
        <p className={MARKETING_EYEBROW}>Legal</p>
        <h1 className={`${MARKETING_H1} mt-2`}>Privacy Policy</h1>
        <p className={`${MARKETING_BODY_MUTED} mt-3`}>Last updated: {LEGAL_LAST_UPDATED}</p>
      </RevealOnScroll>

      <StaggeredList className="mt-8 space-y-4" stagger={0.05}>
        {sections.map((section) => (
          <section key={section.title} className={`${MARKETING_CARD_SURFACE_SOFT} p-5`}>
            <h2 className={MARKETING_H3}>{section.title}</h2>
            <p className={`${MARKETING_BODY} mt-2`}>{section.body}</p>
          </section>
        ))}

        <section className={`${MARKETING_CARD_SURFACE_SOFT} p-5`}>
          <h2 className={MARKETING_H3}>Contact</h2>
          <p className={`${MARKETING_BODY} mt-2`}>
            Privacy requests:{' '}
            <a
              href={`mailto:${PRIVACY_EMAIL}`}
              className={`${MARKETING_SUBTLE_HOVER} text-[var(--mk-fg-strong)] hover:underline`}
            >
              {PRIVACY_EMAIL}
            </a>
          </p>
          <p className={`${MARKETING_BODY} mt-2`}>
            Account support:{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className={`${MARKETING_SUBTLE_HOVER} text-[var(--mk-fg-strong)] hover:underline`}
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </section>
      </StaggeredList>

      <div className={`${MARKETING_BODY_MUTED} mt-10 border-t border-[color:var(--mk-border)] pt-6`}>
        <Link href="/" className={MARKETING_SUBTLE_HOVER}>
          Back to homepage
        </Link>
      </div>
    </MarketingPageShell>
  );
}
