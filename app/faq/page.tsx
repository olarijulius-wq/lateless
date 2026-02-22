import type { Metadata } from 'next';
import { FAQ_ITEMS } from '@/app/lib/seo/faq';
import { getFaqPageJsonLd } from '@/app/lib/seo/jsonld';
import { RevealOnScroll, StaggeredList } from '@/app/ui/motion/reveal';
import MarketingPageShell from '@/app/ui/marketing/page-shell';
import {
  MARKETING_BODY,
  MARKETING_CARD_SURFACE_SOFT,
  MARKETING_CONTAINER_READING,
  MARKETING_EYEBROW,
  MARKETING_H1,
  MARKETING_H3,
  MARKETING_PAGE_PY,
} from '@/app/ui/marketing/tokens';

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Frequently asked questions about invoicing, reminders, Stripe payouts, and plan limits in Lateless.',
  alternates: {
    canonical: '/faq',
  },
  openGraph: {
    title: 'Lateless FAQ',
    description:
      'Frequently asked questions about invoicing, reminders, Stripe payouts, and plan limits in Lateless.',
    url: '/faq',
  },
};

export default function FaqPage() {
  const faqJsonLd = getFaqPageJsonLd(FAQ_ITEMS);

  return (
    <MarketingPageShell mainClassName={`${MARKETING_CONTAINER_READING} ${MARKETING_PAGE_PY}`}>
      <RevealOnScroll>
        <p className={MARKETING_EYEBROW}>Support</p>
        <h1 className={`${MARKETING_H1} mt-2`}>FAQ</h1>
      </RevealOnScroll>

      <StaggeredList className="mt-8 space-y-4" stagger={0.05}>
        {FAQ_ITEMS.map((item) => (
          <section key={item.question} className={`${MARKETING_CARD_SURFACE_SOFT} p-5`}>
            <h2 className={MARKETING_H3}>{item.question}</h2>
            <p className={`${MARKETING_BODY} mt-2`}>{item.answer}</p>
          </section>
        ))}
      </StaggeredList>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </MarketingPageShell>
  );
}
