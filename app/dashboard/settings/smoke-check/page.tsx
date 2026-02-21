import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getLatestSmokeCheckRun,
  getSmokeCheckAccessContext,
} from '@/app/lib/smoke-check';
import { PageShell, SectionCard } from '@/app/ui/page-layout';
import SmokeCheckPanel from './smoke-check-panel';

export const metadata: Metadata = {
  title: 'Production smoke checks',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SmokeCheckPage() {
  const context = await getSmokeCheckAccessContext();
  if (!context) {
    notFound();
  }

  const lastRun = await getLatestSmokeCheckRun();

  return (
    <PageShell
      title="Production smoke checks"
      subtitle="Safe launch P0 verification for payments, email, webhooks, schema, and observability."
      className="max-w-5xl"
    >
      <SectionCard>
        <SmokeCheckPanel initialLastRun={lastRun} timezone="Europe/Tallinn" />
      </SectionCard>
    </PageShell>
  );
}
