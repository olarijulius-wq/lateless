import Link from 'next/link';
import type { Metadata } from 'next';
import {
  BILLING_INTERVALS,
  getAnnualPriceDisplay,
  getAnnualSavingsLabel,
  type BillingInterval,
  PLAN_CONFIG,
  PLAN_IDS,
} from '@/app/lib/config';
import { RevealOnMount, RevealOnScroll, StaggeredList } from '@/app/ui/motion/reveal';
import HeroBackground from '@/app/ui/marketing/hero-background';
import MarketingPageShell from '@/app/ui/marketing/page-shell';
import MarketingSection from '@/app/ui/marketing/marketing-section';
import PricingCard from '@/app/ui/marketing/pricing-card';
import {
  MARKETING_BODY,
  MARKETING_BODY_MUTED,
  MARKETING_BUTTON_PRIMARY,
  MARKETING_BUTTON_SECONDARY,
  MARKETING_CARD_SURFACE,
  MARKETING_CARD_SURFACE_SOFT,
  MARKETING_CODE_SURFACE,
  MARKETING_CONTAINER_WIDE,
  MARKETING_EYEBROW,
  MARKETING_H1,
  MARKETING_H2,
  MARKETING_H3,
} from '@/app/ui/marketing/tokens';
import {
  getOrganizationJsonLd,
  getSoftwareApplicationJsonLd,
} from '@/app/lib/seo/jsonld';

export const metadata: Metadata = {
  title: 'Invoicing with Stripe Payments and Reminders',
  description:
    'Lateless helps freelancers, agencies, and consultants send invoices, collect Stripe payments, and automate reminders.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Lateless',
    description:
      'Send invoices, collect Stripe payments, and automate reminders without dashboard clutter.',
    url: '/',
  },
};

const planOrder = PLAN_IDS;

const features = [
  {
    title: 'Integrate this weekend',
    description:
      'Hosted product with Stripe Checkout support out of the box. No custom payment gateway build required.',
  },
  {
    title: 'Automated reminders',
    description:
      'Overdue invoices get follow-up emails on day 1, day 7, and day 21, each with a direct payment link.',
  },
  {
    title: 'Late payer analytics',
    description:
      'See who pays late most often and adjust terms before late cash flow becomes a monthly problem.',
  },
  {
    title: 'Security-first defaults',
    description:
      'Optional 2FA, bcrypt password hashing, and Stripe-managed payment data keep risk low by default.',
  },
];

const workflowSteps = [
  {
    title: 'Create your workspace',
    description: 'Sign up, connect Stripe, and set your brand details once.',
  },
  {
    title: 'Send invoices',
    description: 'Create customers, issue invoices, and share one-click pay links.',
  },
  {
    title: 'Run reminders automatically',
    description: 'Lateless chases payments in the background while you ship client work.',
  },
];

const useCases = ['Freelancer billing', 'Small agency invoicing', 'Consultant retainers'];

type HomePageProps = {
  searchParams?: Promise<{
    interval?: string;
  }>;
};

export default async function Page(props: HomePageProps) {
  const searchParams = await props.searchParams;
  const requestedInterval = searchParams?.interval?.trim().toLowerCase();
  const interval: BillingInterval = BILLING_INTERVALS.includes(
    requestedInterval as BillingInterval,
  )
    ? (requestedInterval as BillingInterval)
    : 'monthly';
  const organizationJsonLd = getOrganizationJsonLd();
  const softwareJsonLd = getSoftwareApplicationJsonLd();

  return (
    <MarketingPageShell mainClassName="p-0">
      <section className="relative isolate overflow-hidden border-b border-[color:var(--mk-border)]">
        <HeroBackground className="opacity-95" />

        <div className={`${MARKETING_CONTAINER_WIDE} relative z-10 py-20 sm:py-24 lg:py-28`}>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14">
            <RevealOnMount className="space-y-7" duration={0.45}>
              <p className={MARKETING_EYEBROW}>
                For freelancers, consultants, and small agencies
              </p>

              <div className="space-y-5">
                <h1 className={MARKETING_H1}>
                  Get paid faster,
                  <br />
                  without chasing invoices.
                </h1>
                <p className="max-w-2xl text-base leading-relaxed text-[color:var(--mk-fg)] sm:text-lg">
                  Send invoices, collect Stripe payments, and automate reminders in one focused workflow built for small teams.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a href="#pricing" className={MARKETING_BUTTON_PRIMARY}>
                  Start free
                </a>
                <a href="#pricing" className={MARKETING_BUTTON_SECONDARY}>
                  View pricing
                </a>
              </div>

              <p className={MARKETING_BODY_MUTED}>
                Stripe payments. Optional 2FA. Clear fee breakdown.
              </p>
            </RevealOnMount>

            <RevealOnMount delay={0.08} className="relative">
              <div className={`${MARKETING_CARD_SURFACE} relative overflow-hidden p-6 sm:p-7`}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,var(--mk-glow-soft),transparent_58%)]" />
                <div className="relative space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--mk-fg-soft)]">
                      Lateless live view
                    </p>
                    <span className="rounded-full border border-[color:var(--mk-border-strong)] bg-[color:var(--mk-surface-soft)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--mk-fg-strong)]">
                      synced
                    </span>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--mk-border)] bg-[color:var(--mk-surface-soft)] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-[color:var(--mk-fg-muted)]">Pending this week</p>
                      <p className="text-sm font-semibold text-[var(--mk-fg-strong)]">€7,480</p>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-[color:var(--mk-border)]">
                      <div className="h-2 w-2/3 rounded-full bg-[var(--mk-fg-strong)]/85" />
                    </div>
                  </div>
                  <div className="space-y-2 rounded-2xl border border-[color:var(--mk-border)] bg-[color:var(--mk-surface-soft)] p-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[color:var(--mk-fg-muted)]">Reminder queue</span>
                      <span className="text-[color:var(--mk-fg)]">Today</span>
                    </div>
                    <div className="h-9 rounded-lg border border-[color:var(--mk-border)] bg-[color:var(--mk-surface)]" />
                    <div className="h-9 rounded-lg border border-[color:var(--mk-border)] bg-[color:var(--mk-surface-soft)]" />
                    <div className="h-9 rounded-lg border border-[color:var(--mk-border)] bg-[color:var(--mk-surface-soft)]/75" />
                  </div>
                </div>
              </div>
            </RevealOnMount>
          </div>
        </div>
      </section>

      <MarketingSection>
        <h2 className={MARKETING_EYEBROW}>Use cases</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {useCases.map((item) => (
            <li key={item} className={`${MARKETING_CARD_SURFACE_SOFT} px-4 py-3 text-sm text-[color:var(--mk-fg)]`}>
              {item}
            </li>
          ))}
        </ul>
      </MarketingSection>

      <MarketingSection>
        <RevealOnScroll className="mb-10 max-w-3xl">
          <h2 className={MARKETING_H2}>Why Lateless</h2>
          <p className={`${MARKETING_BODY} mt-3`}>
            Keep invoicing disciplined while your team stays focused on product and client delivery.
          </p>
        </RevealOnScroll>

        <StaggeredList className="grid gap-4 md:grid-cols-2" itemClassName="h-full" stagger={0.05}>
          {features.map((feature) => (
            <article key={feature.title} className={`${MARKETING_CARD_SURFACE} h-full p-6`}>
              <h3 className={MARKETING_H3}>{feature.title}</h3>
              <p className={`${MARKETING_BODY} mt-2`}>{feature.description}</p>
            </article>
          ))}
        </StaggeredList>
      </MarketingSection>

      <MarketingSection>
        <RevealOnScroll className="mb-10 max-w-3xl">
          <h2 className={MARKETING_H2}>How it works</h2>
          <p className={`${MARKETING_BODY} mt-3`}>
            Three steps from manual follow-up to a dependable billing rhythm.
          </p>
        </RevealOnScroll>

        <StaggeredList className="grid gap-4 md:grid-cols-3" itemClassName="h-full" stagger={0.06}>
          {workflowSteps.map((step, index) => (
            <article key={step.title} className={`${MARKETING_CARD_SURFACE} h-full p-6`}>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--mk-fg-soft)]">
                Step {index + 1}
              </p>
              <h3 className={`${MARKETING_H3} mt-3`}>{step.title}</h3>
              <p className={`${MARKETING_BODY} mt-2`}>{step.description}</p>
            </article>
          ))}
        </StaggeredList>
      </MarketingSection>

      <MarketingSection className="relative isolate" containerClassName="relative z-10" >
        <HeroBackground className="-z-10 opacity-60" muted />

        <RevealOnScroll className="relative z-10 mb-10 max-w-3xl">
          <h2 id="pricing" className={`${MARKETING_H2} dark:text-zinc-50`}>Pricing for every stage</h2>
          <p className={`${MARKETING_BODY} mt-3 dark:text-zinc-200`}>
            Stripe processing fees are separate. Lateless adds a small platform fee per paid invoice based on your plan.
          </p>
        </RevealOnScroll>

        <div className="relative z-10 mb-8 inline-flex items-center rounded-full border border-[color:var(--mk-border-strong)] bg-[color:var(--mk-surface)] p-1 dark:border-zinc-800 dark:bg-black dark:shadow-[0_0_0_1px_rgba(16,185,129,0.2)]">
          <Link
            href="/?interval=monthly#pricing"
            className={`rounded-full px-3 py-1.5 text-sm transition-colors duration-200 ${
              interval === 'monthly'
                ? 'bg-[var(--mk-fg-strong)] text-[var(--mk-bg)] dark:bg-zinc-950 dark:text-emerald-200 dark:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.44)]'
                : 'text-[color:var(--mk-fg-muted)] hover:text-[var(--mk-fg-strong)] dark:text-zinc-300 dark:hover:text-zinc-100'
            }`}
          >
            Monthly
          </Link>
          <Link
            href="/?interval=annual#pricing"
            className={`rounded-full px-3 py-1.5 text-sm transition-colors duration-200 ${
              interval === 'annual'
                ? 'bg-[var(--mk-fg-strong)] text-[var(--mk-bg)] dark:bg-zinc-950 dark:text-emerald-200 dark:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.44)]'
                : 'text-[color:var(--mk-fg-muted)] hover:text-[var(--mk-fg-strong)] dark:text-zinc-300 dark:hover:text-zinc-100'
            }`}
          >
            Annual
          </Link>
        </div>

        <StaggeredList className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" itemClassName="h-full" stagger={0.04}>
          {planOrder.map((planId) => {
            const plan = PLAN_CONFIG[planId];
            const isPopular = planId === 'solo';
            const isAnnual = interval === 'annual' && planId !== 'free';
            const displayPrice = isAnnual ? getAnnualPriceDisplay(planId) : plan.priceMonthlyEuro;
            const callbackUrl = `/dashboard/settings/billing?plan=${plan.id}&interval=${interval}`;

            return (
              <PricingCard
                key={plan.id}
                className="h-full"
                plan={plan}
                interval={interval}
                displayPrice={displayPrice}
                periodLabel={isAnnual ? '/ year' : '/ month'}
                callbackUrl={callbackUrl}
                annualSavingsLabel={isAnnual ? getAnnualSavingsLabel(planId) : undefined}
                isPopular={isPopular}
              />
            );
          })}
        </StaggeredList>
      </MarketingSection>

      <MarketingSection>
        <RevealOnScroll className={`${MARKETING_CARD_SURFACE} p-6 sm:p-7`}>
          <h2 className={MARKETING_H3}>Built for developers</h2>
          <p className={`${MARKETING_BODY_MUTED} mt-2 max-w-2xl`}>
            Keep your billing workflow close to your product and ops tooling.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <pre className={MARKETING_CODE_SURFACE}>
{`// Fetch pending invoices
const res = await fetch('/api/invoices?status=pending')
const { invoices } = await res.json();`}
            </pre>
            <pre className={MARKETING_CODE_SURFACE}>
{`// Send public pay link
const payLink = 'https://lateless.org/pay/<token>'
await sendReminderEmail({ payLink });`}
            </pre>
          </div>
        </RevealOnScroll>
      </MarketingSection>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
    </MarketingPageShell>
  );
}
