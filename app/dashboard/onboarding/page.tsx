import { Metadata } from 'next';
import postgres from 'postgres';
import { auth } from '@/auth';
import {
  fetchSetupStateForCurrentUser,
} from '@/app/lib/setup-state';
import { fetchStripeConnectStatusForUser } from '@/app/lib/data';
import {
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
} from '@/app/lib/workspaces';
import OnboardingChecklist, { type OnboardingStep } from './onboarding-checklist';
import { PageShell } from '@/app/ui/page-layout';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export const metadata: Metadata = {
  title: 'Guided Setup',
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function fetchNextSendInvoiceHref(userEmail: string) {
  let workspaceId: string | null = null;
  try {
    const context = await ensureWorkspaceContextForCurrentUser();
    workspaceId = context.workspaceId;
  } catch (error) {
    if (!isTeamMigrationRequiredError(error)) {
      console.error('Failed to resolve workspace scope for onboarding invoices:', error);
    }
  }

  const [scopeMeta] = await sql<{ has_workspace_id: boolean }[]>`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'invoices'
        and column_name = 'workspace_id'
    ) as has_workspace_id
  `;
  const scopePredicate =
    scopeMeta?.has_workspace_id && workspaceId
      ? sql`i.workspace_id = ${workspaceId}`
      : sql`lower(i.user_email) = ${userEmail}`;

  const [invoice] = await sql<{ id: string }[]>`
    select i.id
    from public.invoices i
    where ${scopePredicate}
      and i.status <> 'paid'
    order by i.date desc, i.id desc
    limit 1
  `;

  if (invoice?.id) {
    return `/dashboard/invoices/${invoice.id}?returnTo=${encodeURIComponent('/dashboard/invoices')}`;
  }

  return '/dashboard/invoices';
}

export default async function OnboardingPage() {
  const session = await auth();
  const userEmail = session?.user?.email ? normalizeEmail(session.user.email) : null;
  const setup = await fetchSetupStateForCurrentUser();
  const connectStatus = userEmail
    ? await fetchStripeConnectStatusForUser(userEmail)
    : {
        hasAccount: false,
        accountId: null,
        payoutsEnabled: false,
        detailsSubmitted: false,
        isReadyForTransfers: false,
      };
  const sendHref = userEmail
    ? await fetchNextSendInvoiceHref(userEmail)
    : '/dashboard/invoices';

  const returnToOnboarding = encodeURIComponent('/dashboard/onboarding');
  const steps: OnboardingStep[] = [
    {
      key: 'payouts',
      title: 'Connect Stripe payouts',
      description: 'Set up Stripe payouts so paid invoices can transfer to your account.',
      href: '/dashboard/settings/payouts',
      ctaLabel: connectStatus.isReadyForTransfers ? 'Open payouts' : 'Finish payouts setup',
      done: connectStatus.isReadyForTransfers,
    },
    {
      key: 'company',
      title: 'Company profile',
      description: 'Add company details shown on invoices.',
      href: '/dashboard/settings/company-profile',
      ctaLabel: 'Open company profile',
      done: setup.companyDone,
    },
    {
      key: 'customer',
      title: 'Create customer',
      description: 'Create your first customer.',
      href: `/dashboard/customers/create?returnTo=${returnToOnboarding}`,
      ctaLabel: 'Create customer',
      done: setup.customerDone,
    },
    {
      key: 'invoice',
      title: 'Create invoice',
      description: 'Create your first invoice.',
      href: `/dashboard/invoices/create?returnTo=${returnToOnboarding}`,
      ctaLabel: 'Create invoice',
      done: setup.invoiceDone,
    },
    {
      key: 'send',
      title: 'Send invoice',
      description: 'Send one invoice and confirm delivery.',
      href: sendHref,
      ctaLabel: 'Send invoice',
      done: setup.invoiceSentDone,
    },
  ];

  return (
    <PageShell
      title="Onboarding"
      subtitle="One place for setup steps, progress, and next actions."
    >
      <OnboardingChecklist steps={steps} />
    </PageShell>
  );
}
