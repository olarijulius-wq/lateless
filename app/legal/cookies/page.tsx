import Link from 'next/link';
import { LEGAL_LAST_UPDATED } from '@/app/legal/constants';
import type { Metadata } from 'next';
import MarketingPageShell from '@/app/ui/marketing/page-shell';
import {
  MARKETING_BODY,
  MARKETING_BODY_MUTED,
  MARKETING_EYEBROW,
  MARKETING_H1,
  MARKETING_H3,
  MARKETING_SUBTLE_HOVER,
} from '@/app/ui/marketing/tokens';

export const metadata: Metadata = {
  title: 'Cookies',
  description: 'Lateless cookie policy.',
  alternates: {
    canonical: '/legal/cookies',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function CookiesPage() {
  return (
    <MarketingPageShell>
      <div className="mb-8">
        <p className={MARKETING_EYEBROW}>Legal</p>
        <h1 className={`${MARKETING_H1} mt-2`}>Cookies Policy</h1>
        <p className={`${MARKETING_BODY_MUTED} mt-3`}>Last updated: {LEGAL_LAST_UPDATED}</p>
      </div>

      <div className={`space-y-8 ${MARKETING_BODY}`}>
        <section>
          <h2 className={MARKETING_H3}>Necessary cookies only</h2>
          <p className="mt-2">
            Lateless uses strictly necessary cookies only. These are required to
            provide secure sign-in and core account functionality.
          </p>
        </section>

        <section>
          <h2 className={MARKETING_H3}>Cookie categories</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Authentication and session continuity</li>
            <li>Security and fraud prevention</li>
            <li>Essential preferences needed for interface behavior</li>
          </ul>
        </section>

        <section>
          <h2 className={MARKETING_H3}>No analytics or marketing cookies</h2>
          <p className="mt-2">
            We do not use advertising or marketing cookies. We currently do not run
            third-party analytics in the application.
          </p>
        </section>
      </div>

      <div className={`${MARKETING_BODY_MUTED} mt-10 border-t border-neutral-900 pt-6`}>
        <Link href="/" className={MARKETING_SUBTLE_HOVER}>
          Back to homepage
        </Link>
      </div>
    </MarketingPageShell>
  );
}
