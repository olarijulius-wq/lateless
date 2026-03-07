import {
  CustomerField,
  CustomerForm,
  CustomerInvoice,
  CustomerInvoiceScoped,
  CustomersTableType,
  CompanyProfile,
  InvoiceDetail,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  LatePayerStat,
  OverdueCustomerSummary,
  Revenue,
  RevenueDay,
} from './definitions';
import { formatCurrency, formatCurrencySuffix } from './utils';
import { auth } from '@/auth';
import { resolveBillingContext } from '@/app/lib/workspace-billing';
import { PLAN_CONFIG, resolveEffectivePlan, type PlanId } from './config';
import { fetchCurrentMonthInvoiceMetricCount } from '@/app/lib/usage';
import {
  getRequestCachedValue,
  hasRequestScope,
  getRequestMetricsMeta,
  recordRequestQueryLog,
} from '@/app/lib/request-context';
import { logDashboardQuery } from '@/app/lib/dashboard-debug';
import { requireWorkspaceContext } from '@/app/lib/workspace-context';
import { resolveDbConnectionConfig, sql, sqlFragment } from './db';

const TEST_HOOKS_ENABLED =
  process.env.NODE_ENV === 'test' && process.env.LATELLESS_TEST_MODE === '1';
export const __testHooksEnabled = TEST_HOOKS_ENABLED;

export const __testHooks = {
  requireWorkspaceContextOverride: null as
    | (() => Promise<{ userEmail: string; workspaceId: string }>)
    | null,
  strictUserPlanUsageRuntimeOverride: null as boolean | null,
  renderInvoiceScopeWhereClause: (input: {
    userEmail: string;
    workspaceId: string;
    hasInvoicesWorkspaceId: boolean;
    qualified?: boolean;
  }) => {
    const filter = getInvoicesWorkspaceFilter(
      {
        userEmail: normalizeEmail(input.userEmail),
        workspaceId: input.workspaceId,
        hasInvoicesWorkspaceId: input.hasInvoicesWorkspaceId,
        hasCustomersWorkspaceId: true,
        hasCustomersCreatedAt: true,
      },
      input.qualified ?? true,
    );
    return `WHERE 1=1 AND ${filter.column} = $1`;
  },
};

function redactConnectionString(connectionString: string) {
  try {
    const parsed = new URL(connectionString);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return connectionString;
  }
}

if (process.env.NODE_ENV === 'test') {
  const dbConfig = resolveDbConnectionConfig();
  console.info(
    `[db][test] resolved url = ${dbConfig.sourceEnvVar}:${redactConnectionString(dbConfig.connectionString)}`,
  );
  console.info(`[db][test] ssl = ${dbConfig.ssl}`);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

type InvoiceCustomerScope = {
  userEmail: string;
  workspaceId: string;
  hasInvoicesWorkspaceId: boolean;
  hasCustomersWorkspaceId: boolean;
  hasCustomersCreatedAt: boolean;
};

type ScopeFilterCondition = {
  column: ScopeFilterColumn;
  value: string;
};

const INVALID_QUERY_BUILDER_FRAGMENT_MESSAGE = 'Invalid query builder fragment';

const ALLOWED_SCOPE_FILTER_COLUMNS = [
  'workspace_id',
  'lower(user_email)',
  'invoices.workspace_id',
  'lower(invoices.user_email)',
  'customers.workspace_id',
  'lower(customers.user_email)',
] as const;

type ScopeFilterColumn = (typeof ALLOWED_SCOPE_FILTER_COLUMNS)[number];

const ALLOWED_SCOPE_FILTER_COLUMN_SET = new Set<string>(ALLOWED_SCOPE_FILTER_COLUMNS);

export function validateScopeFilterColumn(column: string): ScopeFilterColumn {
  const trimmed = column.trim();
  if (ALLOWED_SCOPE_FILTER_COLUMN_SET.has(trimmed)) {
    return trimmed as ScopeFilterColumn;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(INVALID_QUERY_BUILDER_FRAGMENT_MESSAGE);
  }

  throw new Error(
    `Invalid scope filter column fragment "${column}". Expected a bare column/expression with no operators/placeholders.`,
  );
}

function renderScopeFilterColumn(column: ScopeFilterColumn) {
  switch (column) {
    case 'workspace_id':
      return sqlFragment`workspace_id`;
    case 'lower(user_email)':
      return sqlFragment`lower(user_email)`;
    case 'invoices.workspace_id':
      return sqlFragment`invoices.workspace_id`;
    case 'lower(invoices.user_email)':
      return sqlFragment`lower(invoices.user_email)`;
    case 'customers.workspace_id':
      return sqlFragment`customers.workspace_id`;
    case 'lower(customers.user_email)':
      return sqlFragment`lower(customers.user_email)`;
    default:
      throw new Error(INVALID_QUERY_BUILDER_FRAGMENT_MESSAGE);
  }
}

function renderScopeFilterEq(filter: ScopeFilterCondition) {
  return sqlFragment`${renderScopeFilterColumn(filter.column)} = ${filter.value}`;
}

async function getInvoiceCustomerScopeMeta() {
  return getRequestCachedValue('data:invoice-customer-scope-meta', async () => {
      const [row] = await sql<{
        has_invoices_workspace_id: boolean;
        has_customers_workspace_id: boolean;
        has_customers_created_at: boolean;
      }[]>`
        select
          exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'invoices'
              and column_name = 'workspace_id'
          ) as has_invoices_workspace_id,
          exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'customers'
              and column_name = 'workspace_id'
          ) as has_customers_workspace_id,
          exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'customers'
              and column_name = 'created_at'
          ) as has_customers_created_at
      `;

      return {
        hasInvoicesWorkspaceId: Boolean(row?.has_invoices_workspace_id),
        hasCustomersWorkspaceId: Boolean(row?.has_customers_workspace_id),
        hasCustomersCreatedAt: Boolean(row?.has_customers_created_at),
      };
  });
}

async function requireInvoiceCustomerScope(): Promise<InvoiceCustomerScope> {
  const context = await resolveScopedDataWorkspaceContext();
  const cacheKey =
    TEST_HOOKS_ENABLED && __testHooks.requireWorkspaceContextOverride
      ? `data:invoice-customer-scope:${context.workspaceId}:${context.userEmail}`
      : 'data:invoice-customer-scope';

  return getRequestCachedValue(cacheKey, async () => {
    const meta = await getInvoiceCustomerScopeMeta();
    return {
      userEmail: context.userEmail,
      workspaceId: context.workspaceId,
      hasInvoicesWorkspaceId: meta.hasInvoicesWorkspaceId,
      hasCustomersWorkspaceId: meta.hasCustomersWorkspaceId,
      hasCustomersCreatedAt: meta.hasCustomersCreatedAt,
    };
  });
}

async function resolveScopedDataWorkspaceContext() {
  const context = TEST_HOOKS_ENABLED
    ? (__testHooks.requireWorkspaceContextOverride
      ? await __testHooks.requireWorkspaceContextOverride()
      : await requireWorkspaceContext())
    : await requireWorkspaceContext();

  return {
    userEmail: normalizeEmail(context.userEmail),
    workspaceId: context.workspaceId.trim(),
  };
}

async function requireDataWorkspaceContext() {
  const context = await resolveScopedDataWorkspaceContext();
  const cacheKey =
    TEST_HOOKS_ENABLED && __testHooks.requireWorkspaceContextOverride
      ? `data:workspace-context-normalized:${context.workspaceId}:${context.userEmail}`
      : 'data:workspace-context-normalized';

  return getRequestCachedValue(cacheKey, async () => context);
}

async function requireInvoicePayActionWorkspaceContext(): Promise<{
  workspaceId: string;
  role: 'owner' | 'admin' | 'member';
}> {
  if (!(TEST_HOOKS_ENABLED && __testHooks.requireWorkspaceContextOverride)) {
    const context = await requireWorkspaceContext();
    return {
      workspaceId: context.workspaceId,
      role: context.role,
    };
  }

  const context = await resolveScopedDataWorkspaceContext();
  return getRequestCachedValue(
    `data:invoice-pay-action-workspace-context:${context.workspaceId}:${context.userEmail}`,
    async () => {
      const [membership] = await sql<{ role: 'owner' | 'admin' | 'member' }[]>`
        select wm.role
        from public.workspace_members wm
        join public.users u on u.id = wm.user_id
        where wm.workspace_id = ${context.workspaceId}
          and lower(u.email) = ${context.userEmail}
        limit 1
      `;

      return {
        workspaceId: context.workspaceId,
        role: membership?.role ?? 'member',
      };
    },
  );
}

function getInvoicesWorkspaceFilter(scope: InvoiceCustomerScope, qualified = false) {
  const workspaceId = scope.workspaceId?.trim();
  if (scope.hasInvoicesWorkspaceId && workspaceId) {
    return {
      column: validateScopeFilterColumn(
        qualified ? 'invoices.workspace_id' : 'workspace_id',
      ),
      value: workspaceId,
    } as ScopeFilterCondition;
  }

  return {
    column: validateScopeFilterColumn(
      qualified ? 'lower(invoices.user_email)' : 'lower(user_email)',
    ),
    value: scope.userEmail,
  } as ScopeFilterCondition;
}

function getCustomersWorkspaceFilter(scope: InvoiceCustomerScope, qualified = false) {
  const workspaceId = scope.workspaceId?.trim();
  if (scope.hasCustomersWorkspaceId && workspaceId) {
    return {
      column: validateScopeFilterColumn(
        qualified ? 'customers.workspace_id' : 'workspace_id',
      ),
      value: workspaceId,
    } as ScopeFilterCondition;
  }

  return {
    column: validateScopeFilterColumn(
      qualified ? 'lower(customers.user_email)' : 'lower(user_email)',
    ),
    value: scope.userEmail,
  } as ScopeFilterCondition;
}

function isUndefinedColumnError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '42703'
  );
}

function isUndefinedTableError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '42P01'
  );
}

export async function requireUserEmail() {
  const session = await auth();
  const sessionEmail = session?.user?.email;

  if (typeof sessionEmail === 'string' && sessionEmail.trim() !== '') {
    return normalizeEmail(sessionEmail);
  }

  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (typeof userId === 'string' && userId.trim() !== '') {
    const [row] = await sql<{ email: string }[]>`
      SELECT email
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;

    const emailFromDb = row?.email;
    if (typeof emailFromDb === 'string' && emailFromDb.trim() !== '') {
      return normalizeEmail(emailFromDb);
    }
  }

  throw new Error('Unauthorized');
}

function getTallinnYear(date: Date = new Date()) {
  const year = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
  }).format(date);
  return Number(year);
}

export async function fetchCompanyProfile(): Promise<CompanyProfile | null> {
  const { workspaceId } = await requireDataWorkspaceContext();

  try {
    const data = await sql<CompanyProfile[]>`
      SELECT
        id,
        user_email,
        company_name,
        reg_code,
        vat_number,
        address_line1,
        address_line2,
        city,
        country,
        phone,
        billing_email,
        logo_url,
        created_at,
        updated_at
      FROM company_profiles
      WHERE workspace_id = ${workspaceId}
      LIMIT 1
    `;

    return data[0] ?? null;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch company profile.');
  }
}

export async function fetchStripeConnectAccountId(): Promise<string | null> {
  const userEmail = await requireUserEmail();
  const status = await fetchStripeConnectStatusForUser(userEmail);
  return status.accountId;
}

export type InvoicePayActionContext = {
  userRole: 'owner' | 'admin' | 'member';
  workspaceBillingMissing: boolean;
  hasConnectedPayoutAccount: boolean;
};

export async function fetchInvoicePayActionContext(): Promise<InvoicePayActionContext> {
  const workspaceContext = await requireInvoicePayActionWorkspaceContext();
  const [row] = await sql<{
    workspace_billing_workspace_id: string | null;
    owner_stripe_connect_account_id: string | null;
  }[]>`
    select
      wb.workspace_id as workspace_billing_workspace_id,
      owner_user.stripe_connect_account_id as owner_stripe_connect_account_id
    from public.workspaces w
    left join public.users owner_user
      on owner_user.id = w.owner_user_id
    left join public.workspace_billing wb
      on wb.workspace_id = w.id
    where w.id = ${workspaceContext.workspaceId}
    limit 1
  `;

  return {
    userRole: workspaceContext.role,
    workspaceBillingMissing: !(row?.workspace_billing_workspace_id?.trim()),
    hasConnectedPayoutAccount: !!row?.owner_stripe_connect_account_id?.trim(),
  };
}

export type StripeConnectStatus = {
  hasAccount: boolean;
  accountId: string | null;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  isReadyForTransfers: boolean;
};

export async function fetchStripeConnectStatusForUser(
  userEmail: string,
): Promise<StripeConnectStatus> {
  const normalizedEmail = normalizeEmail(userEmail);

  try {
    const data = await sql<{
      stripe_connect_account_id: string | null;
      stripe_connect_details_submitted: boolean | null;
      stripe_connect_payouts_enabled: boolean | null;
    }[]>`
      SELECT
        stripe_connect_account_id,
        stripe_connect_details_submitted,
        stripe_connect_payouts_enabled
      FROM public.users
      WHERE lower(email) = ${normalizedEmail}
      LIMIT 1
    `;

    const row = data[0];
    const accountId = row?.stripe_connect_account_id?.trim() || null;
    const hasAccount = !!accountId;
    const detailsSubmitted = !!row?.stripe_connect_details_submitted;
    const payoutsEnabled = !!row?.stripe_connect_payouts_enabled;
    const isReadyForTransfers = hasAccount && payoutsEnabled && detailsSubmitted;

    return {
      hasAccount,
      accountId,
      detailsSubmitted,
      payoutsEnabled,
      isReadyForTransfers,
    };
  } catch (error) {
    console.error('Database Error:', error);
    return {
      hasAccount: false,
      accountId: null,
      detailsSubmitted: false,
      payoutsEnabled: false,
      isReadyForTransfers: false,
    };
  }
}

export async function upsertCompanyProfile(
  profile: Omit<CompanyProfile, 'id' | 'user_email' | 'created_at' | 'updated_at'>,
): Promise<CompanyProfile> {
  const { userEmail, workspaceId } = await requireDataWorkspaceContext();

  try {
    const data = await sql<CompanyProfile[]>`
      INSERT INTO company_profiles (
        workspace_id,
        user_email,
        company_name,
        reg_code,
        vat_number,
        address_line1,
        address_line2,
        city,
        country,
        phone,
        billing_email,
        logo_url
      )
      VALUES (
        ${workspaceId},
        ${userEmail},
        ${profile.company_name},
        ${profile.reg_code},
        ${profile.vat_number},
        ${profile.address_line1},
        ${profile.address_line2},
        ${profile.city},
        ${profile.country},
        ${profile.phone},
        ${profile.billing_email},
        ${profile.logo_url}
      )
      ON CONFLICT (workspace_id)
      DO UPDATE SET
        user_email = EXCLUDED.user_email,
        company_name = EXCLUDED.company_name,
        reg_code = EXCLUDED.reg_code,
        vat_number = EXCLUDED.vat_number,
        address_line1 = EXCLUDED.address_line1,
        address_line2 = EXCLUDED.address_line2,
        city = EXCLUDED.city,
        country = EXCLUDED.country,
        phone = EXCLUDED.phone,
        billing_email = EXCLUDED.billing_email,
        logo_url = EXCLUDED.logo_url,
        updated_at = now()
      RETURNING
        id,
        user_email,
        company_name,
        reg_code,
        vat_number,
        address_line1,
        address_line2,
        city,
        country,
        phone,
        billing_email,
        logo_url,
        created_at,
        updated_at
    `;

    const saved = data[0];
    if (!saved) {
      throw new Error('Failed to upsert company profile.');
    }

    return saved;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to save company profile.');
  }
}

export async function getNextInvoiceNumber() {
  const { userEmail, workspaceId } = await requireDataWorkspaceContext();
  const year = getTallinnYear();

  try {
    const [counter] = await sql<{ current_year: number; last_seq: number }[]>`
      INSERT INTO invoice_counters (workspace_id, user_email, current_year, last_seq)
      VALUES (${workspaceId}, ${userEmail}, ${year}, 1)
      ON CONFLICT (workspace_id)
      DO UPDATE SET
        current_year = CASE
          WHEN invoice_counters.current_year = ${year}
          THEN invoice_counters.current_year
          ELSE ${year}
        END,
        last_seq = CASE
          WHEN invoice_counters.current_year = ${year}
          THEN invoice_counters.last_seq + 1
          ELSE 1
        END,
        updated_at = now()
      RETURNING current_year, last_seq
    `;

    if (!counter) {
      throw new Error('Failed to allocate invoice number.');
    }

    const padded = String(counter.last_seq).padStart(4, '0');
    return `INV-${counter.current_year}-${padded}`;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to allocate invoice number.');
  }
}

export async function fetchRevenue() {
  const scope = await requireInvoiceCustomerScope();
  const invoiceFilter = getInvoicesWorkspaceFilter(scope);

  const data = await sql<{ month: string; revenue: number }[]>`
    SELECT
      to_char(date_trunc('month', date::date), 'YYYY-MM') as month,
      SUM(amount) / 100 as revenue
    FROM invoices
    WHERE
      status = 'paid'
      AND ${renderScopeFilterEq(invoiceFilter)}
    GROUP BY date_trunc('month', date::date)
    ORDER BY date_trunc('month', date::date)
  `;

  return data;
}

export async function fetchRevenueDaily(days: number = 30): Promise<RevenueDay[]> {
  const scope = await requireInvoiceCustomerScope();
  const invoiceFilter = getInvoicesWorkspaceFilter(scope);

  const safeDays = Math.max(1, Math.floor(days || 30));

  const data = await sql<RevenueDay[]>`
    WITH local_bounds AS (
      SELECT
        date_trunc('day', now() at time zone 'Europe/Tallinn') - (${safeDays}::int - 1) * interval '1 day' as start_day
    )
    SELECT
      to_char(date_trunc('day', paid_at at time zone 'Europe/Tallinn'), 'YYYY-MM-DD') as day,
      SUM(amount) / 100 as revenue
    FROM invoices
    WHERE
      status = 'paid'
      AND paid_at IS NOT NULL
      AND (paid_at at time zone 'Europe/Tallinn') >= (SELECT start_day FROM local_bounds)
      AND ${renderScopeFilterEq(invoiceFilter)}
    GROUP BY date_trunc('day', paid_at at time zone 'Europe/Tallinn')
    ORDER BY date_trunc('day', paid_at at time zone 'Europe/Tallinn') ASC
  `;

  return data;
}

export async function fetchLatestInvoices() {
  const scope = await requireInvoiceCustomerScope();
  const invoiceFilter = getInvoicesWorkspaceFilter(scope, true);
  const customerFilter = getCustomersWorkspaceFilter(scope, true);

  try {
    const data = await sql<LatestInvoiceRaw[]>`
      SELECT
        invoices.amount,
        customers.id as customer_id,
        customers.name,
        customers.image_url,
        customers.email,
        invoices.id,
        invoices.invoice_number,
        invoices.status,
        invoices.due_date
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE 1=1
        AND ${renderScopeFilterEq(invoiceFilter)}
        AND ${renderScopeFilterEq(customerFilter)}
      ORDER BY invoices.date DESC
      LIMIT 5
    `;

    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrencySuffix(invoice.amount),
    }));

    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchDashboardOverdueCustomers(limit: number = 5) {
  const scope = await requireInvoiceCustomerScope();
  const invoiceFilter = getInvoicesWorkspaceFilter(scope, true);
  const customerFilter = getCustomersWorkspaceFilter(scope, true);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 10) : 5;

  try {
    const data = await sql<OverdueCustomerSummary[]>`
      SELECT
        customers.id AS customer_id,
        customers.name,
        customers.email,
        COUNT(invoices.id)::int AS overdue_invoices,
        COALESCE(SUM(invoices.amount), 0)::int AS total_overdue_amount,
        MAX((current_date - invoices.due_date))::int AS max_days_overdue
      FROM invoices
      JOIN customers
        ON customers.id = invoices.customer_id
        AND ${renderScopeFilterEq(customerFilter)}
      WHERE
        ${renderScopeFilterEq(invoiceFilter)}
        AND invoices.status <> 'paid'
        AND invoices.due_date IS NOT NULL
        AND invoices.due_date < current_date
      GROUP BY customers.id, customers.name, customers.email
      ORDER BY
        MAX((current_date - invoices.due_date)) DESC,
        MIN(invoices.due_date) ASC,
        customers.name ASC
      LIMIT ${safeLimit}
    `;

    return data.map((row) => ({
      ...row,
      total_overdue_amount: Number(row.total_overdue_amount ?? 0),
      overdue_invoices: Number(row.overdue_invoices ?? 0),
      max_days_overdue: Number(row.max_days_overdue ?? 0),
    }));
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch dashboard overdue customers.');
  }
}

export async function fetchCardData() {
  const scope = await requireInvoiceCustomerScope();
  const invoiceFilter = getInvoicesWorkspaceFilter(scope);
  const customerFilter = getCustomersWorkspaceFilter(scope);

  try {
    const [summary] = await sql<{
      invoice_count: string;
      customer_count: string;
      paid: string | null;
      pending: string | null;
    }[]>`
      SELECT
        (
          select count(*)::text
          from invoices
          where ${renderScopeFilterEq(invoiceFilter)}
        ) as invoice_count,
        (
          select count(*)::text
          from customers
          where ${renderScopeFilterEq(customerFilter)}
        ) as customer_count,
        (
          select sum(case when status = 'paid' then amount else 0 end)::text
          from invoices
          where ${renderScopeFilterEq(invoiceFilter)}
        ) as paid,
        (
          select sum(case when status = 'pending' then amount else 0 end)::text
          from invoices
          where ${renderScopeFilterEq(invoiceFilter)}
        ) as pending
    `;

    const numberOfInvoices = Number(summary?.invoice_count ?? '0');
    const numberOfCustomers = Number(summary?.customer_count ?? '0');
    const totalPaidInvoices = formatCurrencySuffix(Number(summary?.paid ?? '0'));
    const totalPendingInvoices = formatCurrencySuffix(Number(summary?.pending ?? '0'));

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    return {
      numberOfCustomers: 0,
      numberOfInvoices: 0,
      totalPaidInvoices: formatCurrencySuffix(0),
      totalPendingInvoices: formatCurrencySuffix(0),
    };
  }
}

export type InvoiceStatusFilter = 'all' | 'overdue' | 'unpaid' | 'paid' | 'refunded';
export type InvoiceSortKey =
  | 'due_date'
  | 'amount'
  | 'created_at'
  | 'customer'
  | 'status';
export type InvoiceSortDir = 'asc' | 'desc';
export type CustomerSortKey = 'name' | 'email' | 'created_at' | 'total_invoices';
export type CustomerSortDir = 'asc' | 'desc';
export type CustomerInvoiceSortKey = 'due_date' | 'amount' | 'created_at';
export type CustomerInvoiceSortDir = 'asc' | 'desc';
export type LatePayerSortKey =
  | 'days_overdue'
  | 'paid_invoices'
  | 'name'
  | 'email'
  | 'amount';
export type LatePayerSortDir = 'asc' | 'desc';

const DEFAULT_INVOICES_PAGE_SIZE = 50;
const DEFAULT_CUSTOMERS_PAGE_SIZE = 50;
const DEFAULT_LATE_PAYERS_PAGE_SIZE = 100;
const DEFAULT_CUSTOMER_INVOICES_PAGE_SIZE = 25;

function buildInvoicesOrderByClause(sortKey: InvoiceSortKey, sortDir: InvoiceSortDir) {
  if (sortKey === 'due_date') {
    return sortDir === 'asc'
      ? sqlFragment`invoices.due_date ASC NULLS LAST, invoices.date DESC, invoices.id DESC`
      : sqlFragment`invoices.due_date DESC NULLS LAST, invoices.date DESC, invoices.id DESC`;
  }
  if (sortKey === 'amount') {
    return sortDir === 'asc'
      ? sqlFragment`invoices.amount ASC, invoices.date DESC, invoices.id DESC`
      : sqlFragment`invoices.amount DESC, invoices.date DESC, invoices.id DESC`;
  }
  if (sortKey === 'customer') {
    return sortDir === 'asc'
      ? sqlFragment`lower(customers.name) ASC, invoices.date DESC, invoices.id DESC`
      : sqlFragment`lower(customers.name) DESC, invoices.date DESC, invoices.id DESC`;
  }
  if (sortKey === 'status') {
    return sortDir === 'asc'
      ? sqlFragment`lower(invoices.status) ASC, invoices.date DESC, invoices.id DESC`
      : sqlFragment`lower(invoices.status) DESC, invoices.date DESC, invoices.id DESC`;
  }
  return sortDir === 'asc'
    ? sqlFragment`invoices.created_at ASC NULLS LAST, invoices.id DESC`
    : sqlFragment`invoices.created_at DESC NULLS LAST, invoices.id DESC`;
}

function buildCustomerInvoicesOrderByClause(
  sortKey: CustomerInvoiceSortKey,
  sortDir: CustomerInvoiceSortDir,
) {
  if (sortKey === 'due_date') {
    return sortDir === 'asc'
      ? sqlFragment`invoices.due_date ASC NULLS LAST, invoices.date DESC, invoices.id DESC`
      : sqlFragment`invoices.due_date DESC NULLS LAST, invoices.date DESC, invoices.id DESC`;
  }
  if (sortKey === 'amount') {
    return sortDir === 'asc'
      ? sqlFragment`invoices.amount ASC, invoices.date DESC, invoices.id DESC`
      : sqlFragment`invoices.amount DESC, invoices.date DESC, invoices.id DESC`;
  }
  return sortDir === 'asc'
    ? sqlFragment`invoices.date ASC, invoices.id DESC`
    : sqlFragment`invoices.date DESC, invoices.id DESC`;
}

function buildLatePayersOrderByClause(sortKey: LatePayerSortKey, sortDir: LatePayerSortDir) {
  if (sortKey === 'days_overdue') {
    return sortDir === 'asc'
      ? sqlFragment`AVG(CASE WHEN invoices.due_date IS NOT NULL THEN (invoices.paid_at::date - invoices.due_date) ELSE (invoices.paid_at::date - invoices.date) END) ASC, lower(customers.name) ASC`
      : sqlFragment`AVG(CASE WHEN invoices.due_date IS NOT NULL THEN (invoices.paid_at::date - invoices.due_date) ELSE (invoices.paid_at::date - invoices.date) END) DESC, lower(customers.name) ASC`;
  }
  if (sortKey === 'paid_invoices' || sortKey === 'amount') {
    return sortDir === 'asc'
      ? sqlFragment`COUNT(invoices.id) ASC, lower(customers.name) ASC`
      : sqlFragment`COUNT(invoices.id) DESC, lower(customers.name) ASC`;
  }
  if (sortKey === 'email') {
    return sortDir === 'asc'
      ? sqlFragment`lower(customers.email) ASC, customers.id DESC`
      : sqlFragment`lower(customers.email) DESC, customers.id DESC`;
  }
  return sortDir === 'asc'
    ? sqlFragment`lower(customers.name) ASC, customers.id DESC`
    : sqlFragment`lower(customers.name) DESC, customers.id DESC`;
}

function buildCustomersOrderByClause(sortKey: CustomerSortKey, sortDir: CustomerSortDir) {
  if (sortKey === 'email') {
    return sortDir === 'asc'
      ? sqlFragment`lower(customers.email) ASC, customers.id DESC`
      : sqlFragment`lower(customers.email) DESC, customers.id DESC`;
  }
  if (sortKey === 'created_at') {
    return sortDir === 'asc'
      ? sqlFragment`customers.created_at ASC, customers.id DESC`
      : sqlFragment`customers.created_at DESC, customers.id DESC`;
  }
  if (sortKey === 'total_invoices') {
    return sortDir === 'asc'
      ? sqlFragment`COUNT(invoices.id) ASC, lower(customers.name) ASC`
      : sqlFragment`COUNT(invoices.id) DESC, lower(customers.name) ASC`;
  }
  return sortDir === 'asc'
    ? sqlFragment`lower(customers.name) ASC, customers.id DESC`
    : sqlFragment`lower(customers.name) DESC, customers.id DESC`;
}

function buildPageCustomersOrderByClause(
  sortKey: Exclude<CustomerSortKey, 'total_invoices'>,
  sortDir: CustomerSortDir,
) {
  if (sortKey === 'email') {
    return sortDir === 'asc'
      ? sqlFragment`lower(page_customers.email) ASC, page_customers.id DESC`
      : sqlFragment`lower(page_customers.email) DESC, page_customers.id DESC`;
  }
  if (sortKey === 'created_at') {
    return sortDir === 'asc'
      ? sqlFragment`page_customers.created_at ASC, page_customers.id DESC`
      : sqlFragment`page_customers.created_at DESC, page_customers.id DESC`;
  }
  return sortDir === 'asc'
    ? sqlFragment`lower(page_customers.name) ASC, page_customers.id DESC`
    : sqlFragment`lower(page_customers.name) DESC, page_customers.id DESC`;
}

function normalizeInvoiceStatusFilter(
  statusFilter: string | undefined,
): InvoiceStatusFilter {
  if (
    statusFilter === 'overdue' ||
    statusFilter === 'unpaid' ||
    statusFilter === 'paid' ||
    statusFilter === 'refunded'
  ) {
    return statusFilter;
  }
  return 'all';
}

function normalizeInvoiceSortKey(sortKey: string | undefined): InvoiceSortKey {
  if (
    sortKey === 'due_date' ||
    sortKey === 'amount' ||
    sortKey === 'created_at' ||
    sortKey === 'customer' ||
    sortKey === 'status'
  ) {
    return sortKey;
  }
  return 'created_at';
}

function normalizeInvoiceSortDir(sortDir: string | undefined): InvoiceSortDir {
  if (sortDir === 'asc' || sortDir === 'desc') {
    return sortDir;
  }
  return 'desc';
}

function normalizeInvoicePageSize(pageSize: number | undefined): number {
  if (pageSize === 10 || pageSize === 25 || pageSize === 50 || pageSize === 100) {
    return pageSize;
  }
  return DEFAULT_INVOICES_PAGE_SIZE;
}

function logInvoiceListQueryDuration(input: {
  queryName: 'rows' | 'count';
  durationMs: number;
  pageSize: number;
  currentPage?: number;
  query: string;
  statusFilter: InvoiceStatusFilter;
  sortKey?: InvoiceSortKey;
  sortDir?: InvoiceSortDir;
}) {
  const { route, method } = getRequestMetricsMeta();
  const label = `invoices.${input.queryName}`;
  recordRequestQueryLog(label, input.durationMs);
  logDashboardQuery({
    route,
    method,
    label,
    durationMs: input.durationMs,
    details: {
      queryName: input.queryName,
      pageSize: input.pageSize,
      currentPage: input.currentPage ?? null,
      statusFilter: input.statusFilter,
      sortKey: input.sortKey ?? null,
      sortDir: input.sortDir ?? null,
      hasSearchQuery: input.query.trim().length > 0,
    },
  });
}

function logCustomerListQueryDuration(input: {
  queryName: 'rows' | 'count';
  durationMs: number;
  pageSize: number;
  currentPage?: number;
  query: string;
  sortKey?: CustomerSortKey;
  sortDir?: CustomerSortDir;
}) {
  const { route, method } = getRequestMetricsMeta();
  const label = `customers.${input.queryName}`;
  recordRequestQueryLog(label, input.durationMs);
  logDashboardQuery({
    route,
    method,
    label,
    durationMs: input.durationMs,
    details: {
      queryName: input.queryName,
      pageSize: input.pageSize,
      currentPage: input.currentPage ?? null,
      sortKey: input.sortKey ?? null,
      sortDir: input.sortDir ?? null,
      hasSearchQuery: input.query.trim().length > 0,
    },
  });
}

function normalizeCustomerSortKey(sortKey: string | undefined): CustomerSortKey {
  if (
    sortKey === 'name' ||
    sortKey === 'email' ||
    sortKey === 'created_at' ||
    sortKey === 'total_invoices'
  ) {
    return sortKey;
  }
  return 'name';
}

function normalizeCustomerSortDir(sortDir: string | undefined): CustomerSortDir {
  if (sortDir === 'asc' || sortDir === 'desc') {
    return sortDir;
  }
  return 'asc';
}

function normalizeCustomerPageSize(pageSize: number | undefined): number {
  if (pageSize === 10 || pageSize === 25 || pageSize === 50 || pageSize === 100) {
    return pageSize;
  }
  return DEFAULT_CUSTOMERS_PAGE_SIZE;
}

function normalizeCustomerInvoiceSortKey(sortKey: string | undefined): CustomerInvoiceSortKey {
  if (sortKey === 'due_date' || sortKey === 'amount' || sortKey === 'created_at') {
    return sortKey;
  }
  return 'due_date';
}

function normalizeCustomerInvoiceSortDir(sortDir: string | undefined): CustomerInvoiceSortDir {
  if (sortDir === 'asc' || sortDir === 'desc') {
    return sortDir;
  }
  return 'asc';
}

function normalizeCustomerInvoicePageSize(pageSize: number | undefined): number {
  if (pageSize === 10 || pageSize === 25 || pageSize === 50 || pageSize === 100) {
    return pageSize;
  }
  return DEFAULT_CUSTOMER_INVOICES_PAGE_SIZE;
}

function normalizeLatePayerSortKey(sortKey: string | undefined): LatePayerSortKey {
  if (
    sortKey === 'days_overdue' ||
    sortKey === 'paid_invoices' ||
    sortKey === 'name' ||
    sortKey === 'email' ||
    sortKey === 'amount'
  ) {
    return sortKey;
  }
  return 'days_overdue';
}

function normalizeLatePayerSortDir(sortDir: string | undefined): LatePayerSortDir {
  if (sortDir === 'asc' || sortDir === 'desc') {
    return sortDir;
  }
  return 'desc';
}

function normalizeLatePayerPageSize(pageSize: number | undefined): number {
  if (pageSize === 25 || pageSize === 50 || pageSize === 100 || pageSize === 200) {
    return pageSize;
  }
  return DEFAULT_LATE_PAYERS_PAGE_SIZE;
}

function logLatePayerQueryDuration(input: {
  queryName: 'rows' | 'count';
  durationMs: number;
  pageSize: number;
  currentPage?: number;
  query: string;
  sortKey?: LatePayerSortKey;
  sortDir?: LatePayerSortDir;
}) {
  const { route, method } = getRequestMetricsMeta();
  const label = `late_payers.${input.queryName}`;
  recordRequestQueryLog(label, input.durationMs);
  logDashboardQuery({
    route,
    method,
    label,
    durationMs: input.durationMs,
    details: {
      queryName: input.queryName,
      pageSize: input.pageSize,
      currentPage: input.currentPage ?? null,
      sortKey: input.sortKey ?? null,
      sortDir: input.sortDir ?? null,
      hasSearchQuery: input.query.trim().length > 0,
    },
  });
}

export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
  statusFilter: string = 'all',
  sortKey: string = 'created_at',
  sortDir: string = 'desc',
  pageSize: number = DEFAULT_INVOICES_PAGE_SIZE,
) {
  const scope = await requireInvoiceCustomerScope();
  const invoiceFilter = getInvoicesWorkspaceFilter(scope, true);
  const customerFilter = getCustomersWorkspaceFilter(scope, true);
  const safeCurrentPage = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1;
  const safePageSize = normalizeInvoicePageSize(pageSize);
  const offset = (safeCurrentPage - 1) * safePageSize;
  const safeStatusFilter = normalizeInvoiceStatusFilter(statusFilter);
  const safeSortKey = normalizeInvoiceSortKey(sortKey);
  const safeSortDir = normalizeInvoiceSortDir(sortDir);
  const orderByClause = buildInvoicesOrderByClause(safeSortKey, safeSortDir);

  try {
    const startedAt = Date.now();
    const invoices = await sql<InvoicesTable[]>`
      WITH page_invoice_ids AS (
        SELECT invoices.id
        FROM invoices
        JOIN customers ON invoices.customer_id = customers.id
        WHERE 1=1
          AND ${renderScopeFilterEq(invoiceFilter)}
          AND ${renderScopeFilterEq(customerFilter)}
          AND (
            ${safeStatusFilter} = 'all'
            OR (${safeStatusFilter} = 'paid' AND invoices.status = 'paid')
            OR (${safeStatusFilter} = 'refunded' AND invoices.status = 'refunded')
            OR (${safeStatusFilter} = 'unpaid' AND invoices.status <> 'paid')
            OR (
              ${safeStatusFilter} = 'overdue'
              AND (
                invoices.status = 'overdue'
                OR (
                  invoices.due_date IS NOT NULL
                  AND invoices.due_date < current_date
                  AND invoices.status <> 'paid'
                )
              )
            )
          )
          AND (
            customers.name ILIKE ${`%${query}%`} OR
            customers.email ILIKE ${`%${query}%`} OR
            invoices.amount::text ILIKE ${`%${query}%`} OR
            COALESCE(invoices.invoice_number, '') ILIKE ${`%${query}%`} OR
            invoices.date::text ILIKE ${`%${query}%`} OR
            invoices.status ILIKE ${`%${query}%`}
          )
        ORDER BY ${orderByClause}
        LIMIT ${safePageSize} OFFSET ${offset}
      )
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.due_date,
        invoices.status,
        invoices.invoice_number,
        logs.status as last_email_status,
        logs.sent_at as last_email_sent_at,
        logs.error as last_email_error,
        CASE
          WHEN invoices.status = 'pending'
            AND invoices.due_date IS NOT NULL
            AND invoices.due_date < current_date
          THEN (current_date - invoices.due_date)
          ELSE 0
        END AS days_overdue,
        customers.name,
        customers.email,
        customers.image_url
      FROM page_invoice_ids
      JOIN invoices ON invoices.id = page_invoice_ids.id
      JOIN customers ON invoices.customer_id = customers.id
      LEFT JOIN LATERAL (
        SELECT status, sent_at, error
        FROM public.invoice_email_logs l
        WHERE l.invoice_id = invoices.id
        ORDER BY l.created_at DESC
        LIMIT 1
      ) logs ON true
      ORDER BY ${orderByClause}
    `;
    logInvoiceListQueryDuration({
      queryName: 'rows',
      durationMs: Date.now() - startedAt,
      pageSize: safePageSize,
      currentPage: safeCurrentPage,
      query,
      statusFilter: safeStatusFilter,
      sortKey: safeSortKey,
      sortDir: safeSortDir,
    });

    return invoices;
  } catch (error) {
    if (isUndefinedTableError(error)) {
      const invoices = await sql<InvoicesTable[]>`
        SELECT
          invoices.id,
          invoices.amount,
          invoices.date,
          invoices.due_date,
          invoices.status,
          invoices.invoice_number,
          null::text as last_email_status,
          null::timestamptz as last_email_sent_at,
          null::text as last_email_error,
          CASE
            WHEN invoices.status = 'pending'
              AND invoices.due_date IS NOT NULL
              AND invoices.due_date < current_date
            THEN (current_date - invoices.due_date)
            ELSE 0
          END AS days_overdue,
          customers.name,
          customers.email,
          customers.image_url
        FROM invoices
        JOIN customers ON invoices.customer_id = customers.id
        WHERE 1=1
          AND ${renderScopeFilterEq(invoiceFilter)}
          AND ${renderScopeFilterEq(customerFilter)}
          AND (
            ${safeStatusFilter} = 'all'
            OR (${safeStatusFilter} = 'paid' AND invoices.status = 'paid')
            OR (${safeStatusFilter} = 'refunded' AND invoices.status = 'refunded')
            OR (${safeStatusFilter} = 'unpaid' AND invoices.status <> 'paid')
            OR (
              ${safeStatusFilter} = 'overdue'
              AND (
                invoices.status = 'overdue'
                OR (
                  invoices.due_date IS NOT NULL
                  AND invoices.due_date < current_date
                  AND invoices.status <> 'paid'
                )
              )
            )
          )
          AND (
            customers.name ILIKE ${`%${query}%`} OR
            customers.email ILIKE ${`%${query}%`} OR
            invoices.amount::text ILIKE ${`%${query}%`} OR
            COALESCE(invoices.invoice_number, '') ILIKE ${`%${query}%`} OR
            invoices.date::text ILIKE ${`%${query}%`} OR
            invoices.status ILIKE ${`%${query}%`}
          )
        ORDER BY ${orderByClause}
        LIMIT ${safePageSize} OFFSET ${offset}
      `;
      return invoices;
    }
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(
  query: string,
  statusFilter: string = 'all',
  pageSize: number = DEFAULT_INVOICES_PAGE_SIZE,
) {
  const scope = await requireInvoiceCustomerScope();
  const invoiceFilter = getInvoicesWorkspaceFilter(scope, true);
  const customerFilter = getCustomersWorkspaceFilter(scope, true);
  const safeStatusFilter = normalizeInvoiceStatusFilter(statusFilter);
  const safePageSize = normalizeInvoicePageSize(pageSize);

  try {
    const startedAt = Date.now();
    const data = await sql`
      SELECT COUNT(*)
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE 1=1
        AND ${renderScopeFilterEq(invoiceFilter)}
        AND ${renderScopeFilterEq(customerFilter)}
        AND (
          ${safeStatusFilter} = 'all'
          OR (${safeStatusFilter} = 'paid' AND invoices.status = 'paid')
          OR (${safeStatusFilter} = 'refunded' AND invoices.status = 'refunded')
          OR (${safeStatusFilter} = 'unpaid' AND invoices.status <> 'paid')
          OR (
            ${safeStatusFilter} = 'overdue'
            AND (
              invoices.status = 'overdue'
              OR (
                invoices.due_date IS NOT NULL
                AND invoices.due_date < current_date
                AND invoices.status <> 'paid'
              )
            )
          )
        )
        AND (
          customers.name ILIKE ${`%${query}%`} OR
          customers.email ILIKE ${`%${query}%`} OR
          invoices.amount::text ILIKE ${`%${query}%`} OR
          COALESCE(invoices.invoice_number, '') ILIKE ${`%${query}%`} OR
          invoices.date::text ILIKE ${`%${query}%`} OR
          invoices.status ILIKE ${`%${query}%`}
        )
    `;
    logInvoiceListQueryDuration({
      queryName: 'count',
      durationMs: Date.now() - startedAt,
      pageSize: safePageSize,
      query,
      statusFilter: safeStatusFilter,
    });

    const totalPages = Math.ceil(Number(data[0].count) / safePageSize);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  const scope = await requireInvoiceCustomerScope();
  const invoiceFilter = getInvoicesWorkspaceFilter(scope, true);
  const customerFilter = getCustomersWorkspaceFilter(scope, true);

  try {
    const data = await sql<InvoiceDetail[]>`
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.currency,
        invoices.processing_uplift_amount,
        invoices.payable_amount,
        invoices.platform_fee_amount,
        invoices.stripe_processing_fee_amount,
        invoices.stripe_processing_fee_currency,
        invoices.stripe_balance_transaction_id,
        invoices.stripe_net_amount,
        invoices.merchant_net_amount,
        invoices.net_received_amount,
        invoices.status,
        invoices.date,
        invoices.due_date,
        invoices.paid_at,
        invoices.reminder_level,
        invoices.last_reminder_sent_at,
        invoices.invoice_number,
        logs.status as last_email_status,
        logs.sent_at as last_email_sent_at,
        logs.error as last_email_error,
        customers.name AS customer_name,
        customers.email AS customer_email
      FROM invoices
      JOIN customers
        ON customers.id = invoices.customer_id
      left join lateral (
        select status, sent_at, error
        from public.invoice_email_logs l
        where l.invoice_id = invoices.id
        order by l.created_at desc
        limit 1
      ) logs on true
      WHERE invoices.id = ${id}
        AND ${renderScopeFilterEq(invoiceFilter)}
        AND ${renderScopeFilterEq(customerFilter)}
      LIMIT 1
    `;

    return data[0];
  } catch (error) {
    if (isUndefinedTableError(error)) {
      const fallback = await sql<InvoiceDetail[]>`
        SELECT
          invoices.id,
          invoices.customer_id,
          invoices.amount,
          invoices.currency,
          invoices.processing_uplift_amount,
          invoices.payable_amount,
          invoices.platform_fee_amount,
          invoices.stripe_processing_fee_amount,
          invoices.stripe_processing_fee_currency,
          invoices.stripe_balance_transaction_id,
          invoices.stripe_net_amount,
          invoices.merchant_net_amount,
          invoices.net_received_amount,
          invoices.status,
          invoices.date,
          invoices.due_date,
          invoices.paid_at,
          invoices.reminder_level,
          invoices.last_reminder_sent_at,
          invoices.invoice_number,
          null::text as last_email_status,
          null::timestamptz as last_email_sent_at,
          null::text as last_email_error,
          customers.name AS customer_name,
          customers.email AS customer_email
        FROM invoices
        JOIN customers
          ON customers.id = invoices.customer_id
        WHERE invoices.id = ${id}
          AND ${renderScopeFilterEq(invoiceFilter)}
          AND ${renderScopeFilterEq(customerFilter)}
        LIMIT 1
      `;
      return fallback[0];
    }
    if (isUndefinedColumnError(error)) {
      const fallback = await sql<InvoiceDetail[]>`
        SELECT
          invoices.id,
          invoices.customer_id,
          invoices.amount,
          invoices.currency,
          null::integer AS processing_uplift_amount,
          null::integer AS payable_amount,
          null::integer AS platform_fee_amount,
          null::integer AS stripe_processing_fee_amount,
          null::text AS stripe_processing_fee_currency,
          null::text AS stripe_balance_transaction_id,
          null::integer AS stripe_net_amount,
          null::integer AS merchant_net_amount,
          null::integer AS net_received_amount,
          invoices.status,
          invoices.date,
          invoices.due_date,
          null::timestamptz AS paid_at,
          null::integer AS reminder_level,
          null::timestamptz AS last_reminder_sent_at,
          invoices.invoice_number,
          null::text AS last_email_status,
          null::timestamptz AS last_email_sent_at,
          null::text AS last_email_error,
          customers.name AS customer_name,
          customers.email AS customer_email
        FROM invoices
        JOIN customers
          ON customers.id = invoices.customer_id
        WHERE invoices.id = ${id}
          AND ${renderScopeFilterEq(invoiceFilter)}
          AND ${renderScopeFilterEq(customerFilter)}
        LIMIT 1
      `;
      return fallback[0];
    }
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchInvoiceFormById(id: string) {
  const scope = await requireInvoiceCustomerScope();
  const invoiceFilter = getInvoicesWorkspaceFilter(scope, true);

  try {
    const data = await sql<InvoiceForm[]>`
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status,
        invoices.due_date
      FROM invoices
      WHERE invoices.id = ${id}
        AND ${renderScopeFilterEq(invoiceFilter)}
    `;

    const invoice = data.map((invoice) => ({
      ...invoice,
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  const scope = await requireInvoiceCustomerScope();
  const customerFilter = getCustomersWorkspaceFilter(scope);

  try {
    const customers = await sql<CustomerField[]>`
      SELECT id, name
      FROM customers
      WHERE 1=1
        AND ${renderScopeFilterEq(customerFilter)}
      ORDER BY name ASC
    `;

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchCustomerById(id: string) {
  const scope = await requireInvoiceCustomerScope();
  const customerFilter = getCustomersWorkspaceFilter(scope);

  try {
    const data = await sql<CustomerForm[]>`
      SELECT id, name, email, image_url
      FROM customers
      WHERE id = ${id}
        AND ${renderScopeFilterEq(customerFilter)}
      LIMIT 1
    `;

    return data[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch customer.');
  }
}

export async function fetchInvoicesByCustomerId(customerId: string) {
  const scope = await requireInvoiceCustomerScope();
  const invoiceFilter = getInvoicesWorkspaceFilter(scope);

  try {
    const data = await sql<CustomerInvoice[]>`
      SELECT id, amount, status, date
      FROM invoices
      WHERE customer_id = ${customerId}
        AND ${renderScopeFilterEq(invoiceFilter)}
      ORDER BY date DESC
    `;

    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch customer invoices.');
  }
}

export async function fetchCustomerInvoiceSummaryByCustomerId(customerId: string) {
  const scope = await requireInvoiceCustomerScope();
  const invoiceFilter = getInvoicesWorkspaceFilter(scope, true);

  try {
    const [data] = await sql<{
      total_count: string;
      total_paid: number | null;
      total_unpaid: number | null;
      total_overdue: number | null;
    }[]>`
      SELECT
        COUNT(*)::text AS total_count,
        SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid,
        SUM(CASE WHEN invoices.status <> 'paid' THEN invoices.amount ELSE 0 END) AS total_unpaid,
        SUM(
          CASE
            WHEN invoices.status <> 'paid'
              AND invoices.due_date IS NOT NULL
              AND invoices.due_date < current_date
            THEN invoices.amount
            ELSE 0
          END
        ) AS total_overdue
      FROM invoices
      WHERE invoices.customer_id = ${customerId}
        AND ${renderScopeFilterEq(invoiceFilter)}
    `;

    return {
      totalCount: Number(data?.total_count ?? '0'),
      totalPaid: data?.total_paid ?? 0,
      totalUnpaid: data?.total_unpaid ?? 0,
      totalOverdue: data?.total_overdue ?? 0,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch customer invoice summary.');
  }
}

export async function fetchFilteredCustomerInvoicesByCustomerId(
  customerId: string,
  query: string,
  currentPage: number = 1,
  statusFilter: string = 'all',
  sortKey: string = 'due_date',
  sortDir: string = 'asc',
  pageSize: number = DEFAULT_CUSTOMER_INVOICES_PAGE_SIZE,
) {
  const scope = await requireInvoiceCustomerScope();
  const invoiceFilter = getInvoicesWorkspaceFilter(scope, true);
  const safeCurrentPage = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1;
  const safeStatusFilter = normalizeInvoiceStatusFilter(statusFilter);
  const safeSortKey = normalizeCustomerInvoiceSortKey(sortKey);
  const safeSortDir = normalizeCustomerInvoiceSortDir(sortDir);
  const safePageSize = normalizeCustomerInvoicePageSize(pageSize);
  const offset = (safeCurrentPage - 1) * safePageSize;
  const orderByClause = buildCustomerInvoicesOrderByClause(safeSortKey, safeSortDir);

  try {
    const data = await sql<CustomerInvoiceScoped[]>`
      SELECT
        invoices.id,
        invoices.amount,
        invoices.status,
        invoices.date,
        invoices.due_date,
        invoices.invoice_number
      FROM invoices
      WHERE invoices.customer_id = ${customerId}
        AND ${renderScopeFilterEq(invoiceFilter)}
        AND (
          ${safeStatusFilter} = 'all'
          OR (${safeStatusFilter} = 'paid' AND invoices.status = 'paid')
          OR (${safeStatusFilter} = 'unpaid' AND invoices.status <> 'paid')
          OR (
            ${safeStatusFilter} = 'overdue'
            AND (
              invoices.status = 'overdue'
              OR (
                invoices.due_date IS NOT NULL
                AND invoices.due_date < current_date
                AND invoices.status <> 'paid'
              )
            )
          )
        )
        AND (
          COALESCE(invoices.invoice_number, '') ILIKE ${`%${query}%`}
          OR invoices.id::text ILIKE ${`%${query}%`}
          OR invoices.amount::text ILIKE ${`%${query}%`}
          OR invoices.status ILIKE ${`%${query}%`}
          OR invoices.date::text ILIKE ${`%${query}%`}
          OR COALESCE(invoices.due_date::text, '') ILIKE ${`%${query}%`}
        )
      ORDER BY ${orderByClause}
      LIMIT ${safePageSize} OFFSET ${offset}
    `;

    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch customer invoices.');
  }
}

export async function fetchCustomerInvoicesPagesByCustomerId(
  customerId: string,
  query: string,
  statusFilter: string = 'all',
  pageSize: number = DEFAULT_CUSTOMER_INVOICES_PAGE_SIZE,
) {
  const scope = await requireInvoiceCustomerScope();
  const invoiceFilter = getInvoicesWorkspaceFilter(scope, true);
  const safeStatusFilter = normalizeInvoiceStatusFilter(statusFilter);
  const safePageSize = normalizeCustomerInvoicePageSize(pageSize);

  try {
    const data = await sql`
      SELECT COUNT(*)
      FROM invoices
      WHERE invoices.customer_id = ${customerId}
        AND ${renderScopeFilterEq(invoiceFilter)}
        AND (
          ${safeStatusFilter} = 'all'
          OR (${safeStatusFilter} = 'paid' AND invoices.status = 'paid')
          OR (${safeStatusFilter} = 'unpaid' AND invoices.status <> 'paid')
          OR (
            ${safeStatusFilter} = 'overdue'
            AND (
              invoices.status = 'overdue'
              OR (
                invoices.due_date IS NOT NULL
                AND invoices.due_date < current_date
                AND invoices.status <> 'paid'
              )
            )
          )
        )
        AND (
          COALESCE(invoices.invoice_number, '') ILIKE ${`%${query}%`}
          OR invoices.id::text ILIKE ${`%${query}%`}
          OR invoices.amount::text ILIKE ${`%${query}%`}
          OR invoices.status ILIKE ${`%${query}%`}
          OR invoices.date::text ILIKE ${`%${query}%`}
          OR COALESCE(invoices.due_date::text, '') ILIKE ${`%${query}%`}
        )
    `;

    return Math.ceil(Number(data[0].count) / safePageSize);
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of customer invoices.');
  }
}

export async function fetchLatePayerStats(
  currentPage: number = 1,
  pageSize: number = DEFAULT_LATE_PAYERS_PAGE_SIZE,
  sortKey: string = 'days_overdue',
  sortDir: string = 'desc',
  query: string = '',
) {
  const scope = await requireInvoiceCustomerScope();
  const invoiceFilter = getInvoicesWorkspaceFilter(scope, true);
  const customerFilter = getCustomersWorkspaceFilter(scope, true);
  const safeCurrentPage = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1;
  const safePageSize = normalizeLatePayerPageSize(pageSize);
  const offset = (safeCurrentPage - 1) * safePageSize;
  const safeSortKey = normalizeLatePayerSortKey(sortKey);
  const safeSortDir = normalizeLatePayerSortDir(sortDir);
  const orderByClause = buildLatePayersOrderByClause(safeSortKey, safeSortDir);

  try {
    const startedAt = Date.now();
    const data = await sql<LatePayerStat[]>`
      SELECT
        customers.id AS customer_id,
        customers.name,
        customers.email,
        COUNT(invoices.id)::int AS paid_invoices,
        AVG(
          CASE
            WHEN invoices.due_date IS NOT NULL
            THEN (invoices.paid_at::date - invoices.due_date)
            ELSE (invoices.paid_at::date - invoices.date)
          END
        )::float AS avg_delay_days
      FROM invoices
      JOIN customers
        ON customers.id = invoices.customer_id
        AND ${renderScopeFilterEq(customerFilter)}
      WHERE
        1=1
        AND ${renderScopeFilterEq(invoiceFilter)}
        AND (
          customers.name ILIKE ${`%${query}%`}
          OR customers.email ILIKE ${`%${query}%`}
          OR COALESCE(invoices.invoice_number, '') ILIKE ${`%${query}%`}
        )
        AND invoices.status = 'paid'
        AND invoices.paid_at IS NOT NULL
        AND (
          CASE
            WHEN invoices.due_date IS NOT NULL
            THEN (invoices.paid_at::date - invoices.due_date)
            ELSE (invoices.paid_at::date - invoices.date)
          END
        ) > 0
      GROUP BY customers.id, customers.name, customers.email
      ORDER BY ${orderByClause}
      LIMIT ${safePageSize} OFFSET ${offset}
    `;
    logLatePayerQueryDuration({
      queryName: 'rows',
      durationMs: Date.now() - startedAt,
      pageSize: safePageSize,
      currentPage: safeCurrentPage,
      query,
      sortKey: safeSortKey,
      sortDir: safeSortDir,
    });

    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch late payer stats.');
  }
}

export async function fetchLatePayerPages(query: string = '', pageSize: number = DEFAULT_LATE_PAYERS_PAGE_SIZE) {
  const scope = await requireInvoiceCustomerScope();
  const invoiceFilter = getInvoicesWorkspaceFilter(scope, true);
  const customerFilter = getCustomersWorkspaceFilter(scope, true);
  const safePageSize = normalizeLatePayerPageSize(pageSize);

  try {
    const startedAt = Date.now();
    const data = await sql`
      SELECT COUNT(*)
      FROM (
        SELECT customers.id
        FROM invoices
        JOIN customers
          ON customers.id = invoices.customer_id
          AND ${renderScopeFilterEq(customerFilter)}
        WHERE
          1=1
          AND ${renderScopeFilterEq(invoiceFilter)}
          AND (
            customers.name ILIKE ${`%${query}%`}
            OR customers.email ILIKE ${`%${query}%`}
            OR COALESCE(invoices.invoice_number, '') ILIKE ${`%${query}%`}
          )
          AND invoices.status = 'paid'
          AND invoices.paid_at IS NOT NULL
          AND (
            CASE
              WHEN invoices.due_date IS NOT NULL
              THEN (invoices.paid_at::date - invoices.due_date)
              ELSE (invoices.paid_at::date - invoices.date)
            END
          ) > 0
        GROUP BY customers.id
      ) late_payers
    `;
    logLatePayerQueryDuration({
      queryName: 'count',
      durationMs: Date.now() - startedAt,
      pageSize: safePageSize,
      query,
    });

    return Math.ceil(Number(data[0].count) / safePageSize);
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of late payers.');
  }
}

export async function fetchFilteredCustomers(
  query: string,
  currentPage: number = 1,
  pageSize: number = DEFAULT_CUSTOMERS_PAGE_SIZE,
  sortKey: string = 'name',
  sortDir: string = 'asc',
) {
  const scope = await requireInvoiceCustomerScope();
  const invoiceFilter = getInvoicesWorkspaceFilter(scope, true);
  const customerFilter = getCustomersWorkspaceFilter(scope, true);
  const safeCurrentPage = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1;
  const safePageSize = normalizeCustomerPageSize(pageSize);
  const offset = (safeCurrentPage - 1) * safePageSize;
  const safeSortKey = normalizeCustomerSortKey(sortKey);
  const safeSortDir = normalizeCustomerSortDir(sortDir);
  const effectiveSortKey =
    safeSortKey === 'created_at' && !scope.hasCustomersCreatedAt ? 'name' : safeSortKey;
  const orderByClause = buildCustomersOrderByClause(effectiveSortKey, safeSortDir);

  try {
    const startedAt = Date.now();
    const data =
      effectiveSortKey === 'total_invoices'
        ? await sql<CustomersTableType[]>`
            SELECT
              customers.id,
              customers.name,
              customers.email,
              customers.image_url,
              COUNT(invoices.id) AS total_invoices,
              SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
              SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
            FROM customers
            LEFT JOIN invoices
              ON customers.id = invoices.customer_id
              AND ${renderScopeFilterEq(invoiceFilter)}
            WHERE 1=1
              AND ${renderScopeFilterEq(customerFilter)}
              AND (
                customers.name ILIKE ${`%${query}%`} OR
                customers.email ILIKE ${`%${query}%`}
              )
            GROUP BY customers.id, customers.name, customers.email, customers.image_url
            ORDER BY ${orderByClause}
            LIMIT ${safePageSize} OFFSET ${offset}
          `
        : await sql<CustomersTableType[]>`
            WITH page_customers AS (
              SELECT
                customers.id,
                customers.name,
                customers.email,
                customers.image_url,
                ${
                  scope.hasCustomersCreatedAt
                    ? sqlFragment`customers.created_at`
                    : sqlFragment`null::timestamptz as created_at`
                }
              FROM customers
              WHERE 1=1
                AND ${renderScopeFilterEq(customerFilter)}
                AND (
                  customers.name ILIKE ${`%${query}%`} OR
                  customers.email ILIKE ${`%${query}%`}
                )
              ORDER BY ${buildCustomersOrderByClause(effectiveSortKey, safeSortDir)}
              LIMIT ${safePageSize} OFFSET ${offset}
            )
            SELECT
              page_customers.id,
              page_customers.name,
              page_customers.email,
              page_customers.image_url,
              COALESCE(invoice_totals.total_invoices, 0) AS total_invoices,
              COALESCE(invoice_totals.total_pending, 0) AS total_pending,
              COALESCE(invoice_totals.total_paid, 0) AS total_paid
            FROM page_customers
            LEFT JOIN LATERAL (
              SELECT
                COUNT(*) AS total_invoices,
                SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
                SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
              FROM invoices
              WHERE invoices.customer_id = page_customers.id
                AND ${renderScopeFilterEq(invoiceFilter)}
            ) invoice_totals ON true
            ORDER BY ${buildPageCustomersOrderByClause(
              effectiveSortKey as Exclude<CustomerSortKey, 'total_invoices'>,
              safeSortDir,
            )}
          `;
    logCustomerListQueryDuration({
      queryName: 'rows',
      durationMs: Date.now() - startedAt,
      pageSize: safePageSize,
      currentPage: safeCurrentPage,
      query,
      sortKey: effectiveSortKey,
      sortDir: safeSortDir,
    });

    const customers = data.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}

export async function fetchCustomersPages(
  query: string,
  pageSize: number = DEFAULT_CUSTOMERS_PAGE_SIZE,
) {
  const scope = await requireInvoiceCustomerScope();
  const customerFilter = getCustomersWorkspaceFilter(scope, true);
  const safePageSize = normalizeCustomerPageSize(pageSize);

  try {
    const startedAt = Date.now();
    const data = await sql`
      SELECT COUNT(*)
      FROM customers
      WHERE 1=1
        AND ${renderScopeFilterEq(customerFilter)}
        AND (
          customers.name ILIKE ${`%${query}%`} OR
          customers.email ILIKE ${`%${query}%`}
        )
    `;
    logCustomerListQueryDuration({
      queryName: 'count',
      durationMs: Date.now() - startedAt,
      pageSize: safePageSize,
      query,
    });

    return Math.ceil(Number(data[0].count) / safePageSize);
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch total number of customers.');
  }
}

export type UserPlanUsage = {
  plan: PlanId;
  isPro: boolean;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | string | null;
  invoiceCount: number;
  maxPerMonth: number;
};

export type UserInvoiceUsageProgress = {
  planId: PlanId;
  maxPerMonth: number | null;
  usedThisMonth: number;
  percentUsed: number;
};

function isStrictUserPlanUsageRuntime() {
  if (
    TEST_HOOKS_ENABLED &&
    typeof __testHooks.strictUserPlanUsageRuntimeOverride === 'boolean'
  ) {
    return __testHooks.strictUserPlanUsageRuntimeOverride;
  }

  return (
    process.env.NODE_ENV === 'test' ||
    process.env.CI === 'true' ||
    process.env.GITHUB_ACTIONS === 'true'
  );
}

function isRequestScopeFallbackEligible(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  if (message.includes('fetchuserplanandusage requires request scope or test override')) {
    return true;
  }

  const requestScopeIndicators = [
    'outside a request scope',
    'outside of request scope',
    'outside of a request scope',
    'request scope',
  ];
  const requestApiIndicators = ['auth', 'headers', 'cookies'];

  return (
    requestScopeIndicators.some((indicator) => message.includes(indicator)) &&
    requestApiIndicators.some((indicator) => message.includes(indicator))
  );
}

export function getFreePlanUsageDefaults(): UserPlanUsage {
  return {
    plan: 'free',
    isPro: false,
    subscriptionStatus: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    invoiceCount: 0,
    maxPerMonth: PLAN_CONFIG.free.maxPerMonth,
  };
}

export async function fetchUserPlanAndUsage(): Promise<UserPlanUsage> {
  const hasScopedRequest = hasRequestScope();
  const hasTestWorkspaceOverride =
    TEST_HOOKS_ENABLED && __testHooks.requireWorkspaceContextOverride;
  const strictRuntime = isStrictUserPlanUsageRuntime();

  if (strictRuntime && !hasScopedRequest && !hasTestWorkspaceOverride) {
    throw new Error('fetchUserPlanAndUsage requires request scope or test override');
  }

  try {
    const workspaceContext = await resolveScopedDataWorkspaceContext();

    const billing = await resolveBillingContext({
      workspaceId: workspaceContext.workspaceId,
      userEmail: workspaceContext.userEmail,
    });

    const invoiceMetricUsage = await fetchCurrentMonthInvoiceMetricCount({
      userEmail: workspaceContext.userEmail,
      workspaceId: workspaceContext.workspaceId,
      metric: 'created',
    });

    const plan = resolveEffectivePlan(billing.plan, billing.subscriptionStatus);
    const maxPerMonth = PLAN_CONFIG[plan].maxPerMonth;
    const invoiceCount = invoiceMetricUsage.count;

    return {
      plan,
      isPro: plan !== 'free',
      subscriptionStatus: billing.subscriptionStatus,
      cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
      currentPeriodEnd: billing.currentPeriodEnd,
      invoiceCount,
      maxPerMonth,
    };
  } catch (error) {
    if (strictRuntime || !isRequestScopeFallbackEligible(error)) {
      throw error;
    }

    const { route, method } = getRequestMetricsMeta();
    const message = error instanceof Error ? error.message : 'unknown';
    console.warn(
      `[billing][plan_usage_fallback] route=${route} method=${method} reason=${JSON.stringify(message)}`,
    );
    return getFreePlanUsageDefaults();
  }
}

export async function fetchUserInvoiceUsageProgress(): Promise<UserInvoiceUsageProgress> {
  const usage = await fetchUserPlanAndUsage();
  const maxPerMonth = Number.isFinite(usage.maxPerMonth) ? usage.maxPerMonth : null;
  const usedThisMonth = usage.invoiceCount;
  const percentUsed =
    maxPerMonth === null
      ? 0
      : maxPerMonth <= 0
        ? 1
        : usedThisMonth / maxPerMonth;

  return {
    planId: usage.plan,
    maxPerMonth,
    usedThisMonth,
    percentUsed,
  };
}
