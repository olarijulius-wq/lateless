import type { Metadata } from 'next';
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
  title: 'Help',
  description:
    'How Lateless handles invoices, reminders, Stripe payouts, usage resets, and invoice history.',
  alternates: {
    canonical: '/help',
  },
  openGraph: {
    title: 'Lateless Help',
    description:
      'How Lateless handles invoices, reminders, Stripe payouts, usage resets, and invoice history.',
    url: '/help',
  },
};

const helpSections = [
  {
    title: 'Invoice dates',
    body: 'The created date is when the draft invoice record was made. The issued date is when you send it to a customer. Reminder scheduling uses the issued date and due date.',
  },
  {
    title: 'Reminders',
    body: 'Lateless can send overdue reminders on day 1, day 7, and day 21 after due date based on your settings.',
  },
  {
    title: 'Stripe payouts',
    body: 'Customers pay through Stripe Checkout. Funds settle to your connected Stripe account according to your Stripe payout schedule.',
  },
  {
    title: 'Plan limits and history',
    body: 'Plan invoice limits reset monthly. Invoice history remains available even after a monthly limit reset.',
  },
];

export default function HelpPage() {
  return (
    <MarketingPageShell mainClassName={`${MARKETING_CONTAINER_READING} ${MARKETING_PAGE_PY}`}>
      <RevealOnScroll>
        <p className={MARKETING_EYEBROW}>Support</p>
        <h1 className={`${MARKETING_H1} mt-2`}>Help</h1>
      </RevealOnScroll>

      <StaggeredList className="mt-8 space-y-4" stagger={0.05}>
        {helpSections.map((section) => (
          <section key={section.title} className={`${MARKETING_CARD_SURFACE_SOFT} p-5`}>
            <h2 className={MARKETING_H3}>{section.title}</h2>
            <p className={`${MARKETING_BODY} mt-2`}>{section.body}</p>
          </section>
        ))}
      </StaggeredList>
    </MarketingPageShell>
  );
}
