import Link from 'next/link';
import postgres from 'postgres';
import RevenueChart from '@/app/ui/dashboard/revenue-chart';
import LatestInvoices from '@/app/ui/dashboard/latest-invoices';
import LatePayers from '@/app/ui/dashboard/late-payers';
import { LatelessLiveView } from '@/app/ui/dashboard/live-view';
import { lusitana } from '@/app/ui/fonts';
import { Suspense } from 'react';
import CardWrapper from '@/app/ui/dashboard/cards';
import {
  RevenueChartSkeleton,
  LatestInvoicesSkeleton,
  CardsSkeleton,
} from '@/app/ui/skeletons';
import { Metadata } from 'next';
import { RevealOnMount } from '@/app/ui/motion/reveal';
import { requireUserEmail } from '@/app/lib/data';
import { primaryButtonClasses } from '@/app/ui/button';
import { CARD_INTERACTIVE, LIGHT_SURFACE } from '@/app/ui/theme/tokens';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export const metadata: Metadata = {
  title: 'Dashboard',
};

type SetupState = {
  companySaved: boolean;
  customerCreated: boolean;
  invoiceCreated: boolean;
  firstReminderSent: boolean;
  connectStripe: boolean;
};

function isUndefinedTableError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '42P01'
  );
}

async function fetchSetupState(): Promise<SetupState> {
  const userEmail = await requireUserEmail();
  const [user] = await sql<{
    active_workspace_id: string | null;
    stripe_connect_account_id: string | null;
  }[]>`
    select active_workspace_id, stripe_connect_account_id
    from public.users
    where lower(email) = ${userEmail}
    limit 1
  `;

  const activeWorkspaceId = user?.active_workspace_id ?? null;

  const [companyRow, customerRow, invoiceRow] = await Promise.all([
    sql<{ done: boolean }[]>`
      select exists (
        select 1
        from public.company_profiles cp
        where (
          (${activeWorkspaceId}::uuid is not null and cp.workspace_id = ${activeWorkspaceId})
          or (cp.workspace_id is null and lower(cp.user_email) = ${userEmail})
        )
          and (
            nullif(trim(coalesce(cp.company_name, '')), '') is not null
            or nullif(trim(coalesce(cp.address_line1, '')), '') is not null
            or nullif(trim(coalesce(cp.city, '')), '') is not null
            or nullif(trim(coalesce(cp.country, '')), '') is not null
            or nullif(trim(coalesce(cp.billing_email, '')), '') is not null
          )
      ) as done
    `,
    sql<{ count: string }[]>`
      select count(*)::text as count
      from public.customers
      where lower(user_email) = ${userEmail}
    `,
    sql<{ count: string }[]>`
      select count(*)::text as count
      from public.invoices
      where lower(user_email) = ${userEmail}
    `,
  ]);

  let firstReminderSentFromRuns = false;
  let firstReminderSentFallback = false;
  try {
    const [runsMeta] = await sql<{
      table_exists: boolean;
      has_workspace_id: boolean;
      has_user_email: boolean;
      has_raw_json: boolean;
    }[]>`
      select
        to_regclass('public.reminder_runs') is not null as table_exists,
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'reminder_runs'
            and column_name = 'workspace_id'
        ) as has_workspace_id,
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'reminder_runs'
            and column_name = 'user_email'
        ) as has_user_email,
        exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'reminder_runs'
            and column_name = 'raw_json'
        ) as has_raw_json
    `;

    if (!runsMeta?.table_exists) {
      throw Object.assign(new Error('reminder_runs missing'), { code: '42P01' });
    }

    if (runsMeta.has_workspace_id && activeWorkspaceId) {
      const [row] = await sql<{ done: boolean }[]>`
        select exists (
          select 1
          from public.reminder_runs
          where workspace_id = ${activeWorkspaceId}
            and sent > 0
            and ran_at >= now() - interval '7 days'
        ) as done
      `;
      firstReminderSentFromRuns = Boolean(row?.done);
    } else if (runsMeta.has_user_email) {
      const [row] = await sql<{ done: boolean }[]>`
        select exists (
          select 1
          from public.reminder_runs
          where lower(user_email) = ${userEmail}
            and sent > 0
            and ran_at >= now() - interval '7 days'
        ) as done
      `;
      firstReminderSentFromRuns = Boolean(row?.done);
    } else if (runsMeta.has_raw_json) {
      const [row] = await sql<{ done: boolean }[]>`
        select exists (
          select 1
          from public.reminder_runs rr
          join lateral jsonb_array_elements_text(
            coalesce(rr.raw_json -> 'updatedInvoiceIds', '[]'::jsonb)
          ) as updated_invoice_id on true
          join public.invoices i
            on i.id::text = updated_invoice_id
          where lower(i.user_email) = ${userEmail}
            and rr.sent > 0
            and rr.ran_at >= now() - interval '7 days'
        ) as done
      `;
      firstReminderSentFromRuns = Boolean(row?.done);
    }
  } catch (error) {
    if (isUndefinedTableError(error)) {
      // Ignore; fallback query below covers this case.
    } else {
      console.error('Failed to read first_reminder_sent setup state:', error);
    }
  }

  try {
    const [fallbackRow] = await sql<{ done: boolean }[]>`
      select exists (
        select 1
        from public.invoices
        where lower(user_email) = ${userEmail}
          and reminder_level > 0
      ) as done
    `;
    firstReminderSentFallback = Boolean(fallbackRow?.done);
  } catch (error) {
    console.error('Failed to read reminder fallback setup state:', error);
  }

  const firstReminderSent = firstReminderSentFromRuns || firstReminderSentFallback;

  return {
    companySaved: Boolean(companyRow[0]?.done),
    customerCreated: Number(customerRow[0]?.count ?? '0') > 0,
    invoiceCreated: Number(invoiceRow[0]?.count ?? '0') > 0,
    firstReminderSent,
    connectStripe: Boolean(user?.stripe_connect_account_id?.trim()),
  };
}

export default async function Page(props: {
  searchParams?: Promise<{
    lpQuery?: string;
    lpPage?: string;
    lpSort?: string;
    lpDir?: string;
    lpPageSize?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const setup = await fetchSetupState();

  const setupItems: Array<{
    key: string;
    title: string;
    description: string;
    href: string;
    ctaLabel: string;
    done: boolean;
  }> = [
    {
      key: 'company',
      title: 'Add company details',
      description: 'Business identity shown on invoices and reminders.',
      href: '/dashboard/settings/company-profile',
      ctaLabel: 'Open company profile',
      done: setup.companySaved,
    },
    {
      key: 'customer',
      title: 'Add first customer',
      description: 'Create one customer to start billing.',
      href: '/dashboard/customers/create',
      ctaLabel: 'Create customer',
      done: setup.customerCreated,
    },
    {
      key: 'invoice',
      title: 'Create first invoice',
      description: 'Generate your first payable invoice.',
      href: '/dashboard/invoices/create',
      ctaLabel: 'Create invoice',
      done: setup.invoiceCreated,
    },
    {
      key: 'reminder',
      title: 'Send a test reminder',
      description: 'Run a reminder and confirm it was sent.',
      href: '/dashboard/reminders',
      ctaLabel: 'Open reminders',
      done: setup.firstReminderSent,
    },
  ];

  if (!setup.connectStripe) {
    setupItems.push({
      key: 'connect',
      title: 'Connect Stripe payouts',
      description: 'Link Stripe to receive payouts directly.',
      href: '/dashboard/settings/payouts',
      ctaLabel: 'Connect Stripe',
      done: false,
    });
  }

  const doneCount = setupItems.filter((item) => item.done).length;
  const totalCount = setupItems.length;

  return (
    <main className="space-y-6">
      <h1 className={`${lusitana.className} text-xl text-slate-900 dark:text-slate-100 md:text-2xl`}>
        Dashboard
      </h1>

      <section
        className={`rounded-2xl border p-5 ${LIGHT_SURFACE} ${CARD_INTERACTIVE} dark:border-neutral-800 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Setup
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {doneCount}/{totalCount} done
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {setupItems.map((item) => (
            <div
              key={item.key}
              className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {item.description}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                    item.done
                      ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300'
                      : 'border border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'
                  }`}
                >
                  {item.done ? 'Done' : 'Not done'}
                </span>
              </div>

              {!item.done ? (
                <Link
                  href={item.href}
                  className={`${primaryButtonClasses} mt-3 inline-flex rounded-lg px-3 py-2 text-sm`}
                >
                  {item.ctaLabel}
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid gap-6 sm:grid-cols-2">
          <Suspense fallback={<CardsSkeleton />}>
            <CardWrapper />
          </Suspense>
        </div>

        <Suspense
          fallback={
            <div className="h-full rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]" />
          }
        >
          <LatelessLiveView />
        </Suspense>
      </div>

      <div className="space-y-6">
        <RevealOnMount delay={0.08}>
          <Suspense fallback={<RevenueChartSkeleton />}>
            <RevenueChart />
          </Suspense>
        </RevealOnMount>

        <div className="grid gap-6 md:grid-cols-2">
          <RevealOnMount delay={0.14} className="h-full">
            <Suspense fallback={<LatestInvoicesSkeleton />}>
              <LatestInvoices />
            </Suspense>
          </RevealOnMount>
          <RevealOnMount delay={0.2} className="h-full">
            <Suspense fallback={<LatestInvoicesSkeleton />}>
              <LatePayers searchParams={searchParams} />
            </Suspense>
          </RevealOnMount>
        </div>
      </div>
    </main>
  );
}
