import Link from 'next/link';
import type { Metadata } from 'next';
import { LEGAL_LAST_UPDATED } from '@/app/legal/constants';
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
  title: 'Terms',
  description: 'Lateless terms of service for use, billing, and cancellation.',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: 'Lateless Terms of Service',
    description: 'Lateless terms of service for use, billing, and cancellation.',
    url: '/terms',
  },
};

const sections = [
  {
    title: 'Service',
    body: 'Lateless provides invoicing, reminder automation, and payment workflow tooling for businesses and independent professionals.',
  },
  {
    title: 'Billing',
    body: 'Paid plans renew on a recurring basis unless canceled. Fees are billed through Stripe under the plan and pricing terms shown at purchase.',
  },
  {
    title: 'Cancellation',
    body: 'You can cancel at any time. Access to paid features continues through the current billing period unless otherwise required by law.',
  },
];

export default function TermsPage() {
  return (
    <MarketingPageShell mainClassName={`${MARKETING_CONTAINER_READING} ${MARKETING_PAGE_PY}`}>
      <RevealOnScroll>
        <p className={MARKETING_EYEBROW}>Legal</p>
        <h1 className={`${MARKETING_H1} mt-2`}>Terms of Service</h1>
        <p className={`${MARKETING_BODY_MUTED} mt-3`}>Last updated: {LEGAL_LAST_UPDATED}</p>
      </RevealOnScroll>

      <StaggeredList className="mt-8 space-y-4" stagger={0.05}>
        {sections.map((section) => (
          <section key={section.title} className={`${MARKETING_CARD_SURFACE_SOFT} p-5`}>
            <h2 className={MARKETING_H3}>{section.title}</h2>
            <p className={`${MARKETING_BODY} mt-2`}>{section.body}</p>
          </section>
        ))}
      </StaggeredList>

      <div className={`${MARKETING_BODY_MUTED} mt-10 border-t border-[color:var(--mk-border)] pt-6`}>
        <Link href="/" className={MARKETING_SUBTLE_HOVER}>
          Back to homepage
        </Link>
      </div>
    </MarketingPageShell>
  );
}
