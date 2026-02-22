import type { Metadata } from 'next';
import { PLAN_CONFIG, PLAN_IDS } from '@/app/lib/config';
import { getPricingProductJsonLd } from '@/app/lib/seo/jsonld';
import { RevealOnScroll, StaggeredList } from '@/app/ui/motion/reveal';
import HeroBackground from '@/app/ui/marketing/hero-background';
import MarketingPageShell from '@/app/ui/marketing/page-shell';
import PricingCard from '@/app/ui/marketing/pricing-card';
import {
  MARKETING_BODY,
  MARKETING_BODY_MUTED,
  MARKETING_CONTAINER_WIDE,
  MARKETING_EYEBROW,
  MARKETING_H1,
  MARKETING_H2,
  MARKETING_SECTION_PY,
} from '@/app/ui/marketing/tokens';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Transparent Lateless pricing for freelancers and teams. Monthly plans, monthly usage reset, and persistent invoice history.',
  alternates: {
    canonical: '/pricing',
  },
  openGraph: {
    title: 'Lateless Pricing',
    description:
      'Transparent Lateless pricing for freelancers and teams. Monthly plans, monthly usage reset, and persistent invoice history.',
    url: '/pricing',
  },
};

export default function PricingPage() {
  const pricingJsonLd = getPricingProductJsonLd();

  return (
    <MarketingPageShell mainClassName="p-0">
      <section className="relative isolate overflow-hidden border-b border-[color:var(--mk-border)]">
        <HeroBackground className="opacity-80" muted />

        <div className={`${MARKETING_CONTAINER_WIDE} relative z-10 ${MARKETING_SECTION_PY}`}>
          <RevealOnScroll className="max-w-3xl">
            <p className={MARKETING_EYEBROW}>Plans</p>
            <h1 className={`${MARKETING_H1} mt-3`}>Calm pricing, clear limits.</h1>
            <p className={`${MARKETING_BODY} mt-4`}>
              Choose the plan that matches your monthly invoice volume. Limits reset monthly and your invoice history remains available.
            </p>
          </RevealOnScroll>
        </div>
      </section>

      <section className="border-b border-[color:var(--mk-border)]">
        <div className={`${MARKETING_CONTAINER_WIDE} ${MARKETING_SECTION_PY}`}>
          <RevealOnScroll className="mb-8 max-w-3xl">
            <h2 className={MARKETING_H2}>All plans include Stripe checkout and reminders</h2>
            <p className={`${MARKETING_BODY_MUTED} mt-3`}>
              Platform fees are charged per paid invoice by plan. Stripe processing fees are separate.
            </p>
          </RevealOnScroll>

          <StaggeredList className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" itemClassName="h-full" stagger={0.04}>
            {PLAN_IDS.map((planId) => {
              const plan = PLAN_CONFIG[planId];
              return (
                <PricingCard
                  key={plan.id}
                  plan={plan}
                  displayPrice={plan.priceMonthlyEuro}
                  periodLabel="/ month"
                  interval="monthly"
                  isPopular={planId === 'solo'}
                />
              );
            })}
          </StaggeredList>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />
    </MarketingPageShell>
  );
}
