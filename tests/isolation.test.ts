import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import postgres from 'postgres';

type WorkspaceContext = {
  userEmail: string;
  workspaceId: string;
};

type TestContext = {
  userId: string;
  userEmail: string;
  teammateUserId: string;
  teammateUserEmail: string;
  workspaceA: string;
  workspaceB: string;
  customerA: string;
  customerB: string;
  invoiceA: string;
  invoiceB: string;
};

function requireTestDatabaseUrl() {
  const url = process.env.POSTGRES_URL_TEST?.trim();
  if (!url) {
    throw new Error('Missing POSTGRES_URL_TEST.');
  }
  return url;
}

function resolveSslMode(dbUrl: string): false | 'require' {
  const hostname = new URL(dbUrl).hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' ? false : 'require';
}

const testDbUrl = requireTestDatabaseUrl();
process.env.AUTH_SECRET ??= 'test-auth-secret';
process.env.NEXTAUTH_SECRET ??= process.env.AUTH_SECRET;
process.env.NEXTAUTH_URL ??= 'http://localhost:3000';
process.env.PAY_LINK_SECRET ??= 'test-pay-link-secret';
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000';

const sql = postgres(testDbUrl, { ssl: resolveSslMode(testDbUrl), prepare: false });
const sqlClients: Array<ReturnType<typeof postgres>> = [sql];

async function closeSqlClients() {
  await Promise.allSettled(
    sqlClients.map((client) => client.end({ timeout: 5 })),
  );
}

async function resetDb() {
  await sql`
    truncate table
      public.refund_requests,
      public.invoice_email_logs,
      public.company_profiles,
      public.invoices,
      public.customers,
      public.workspace_invites,
      public.workspace_members,
      public.workspaces,
      public.nextauth_sessions,
      public.nextauth_accounts,
      public.users
    restart identity cascade
  `;
}

async function seedFixtures(): Promise<TestContext> {
  const userId = '11111111-1111-4111-8111-111111111111';
  const teammateUserId = '22222222-2222-4222-8222-222222222222';
  const workspaceA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const workspaceB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const customerA = 'aaaaaaaa-1111-4111-8111-aaaaaaaa1111';
  const customerB = 'bbbbbbbb-2222-4222-8222-bbbbbbbb2222';
  const invoiceA = 'aaaaaaaa-3333-4333-8333-aaaaaaaa3333';
  const invoiceB = 'bbbbbbbb-4444-4444-8444-bbbbbbbb4444';
  const userEmail = 'isolation-owner@example.com';
  const teammateUserEmail = 'isolation-member@example.com';

  await sql`
    insert into public.users (
      id,
      name,
      email,
      password,
      is_verified,
      plan,
      subscription_status
    )
    values (
      ${userId},
      'Isolation Owner',
      ${userEmail},
      '$2b$10$uD50r8jflxRQQ6MShwbVVuAVrkMtk0iA0WIMRqjYOEoTP0TO.Zi5q',
      true,
      'solo',
      'active'
    )
  `;
  await sql`
    insert into public.users (
      id,
      name,
      email,
      password,
      is_verified,
      plan,
      subscription_status
    )
    values (
      ${teammateUserId},
      'Isolation Member',
      ${teammateUserEmail},
      '$2b$10$uD50r8jflxRQQ6MShwbVVuAVrkMtk0iA0WIMRqjYOEoTP0TO.Zi5q',
      true,
      'solo',
      'active'
    )
  `;

  await sql`
    insert into public.workspaces (id, name, owner_user_id)
    values
      (${workspaceA}, 'Workspace A', ${userId}),
      (${workspaceB}, 'Workspace B', ${userId})
  `;

  await sql`
    insert into public.workspace_members (workspace_id, user_id, role)
    values
      (${workspaceA}, ${userId}, 'owner'),
      (${workspaceA}, ${teammateUserId}, 'member'),
      (${workspaceB}, ${userId}, 'owner')
  `;

  await sql`
    update public.users
    set active_workspace_id = ${workspaceA}
    where id = ${userId}
  `;

  await sql`
    insert into public.customers (id, name, email, user_email, workspace_id)
    values
      (${customerA}, 'Customer A', 'a@example.com', ${userEmail}, ${workspaceA}),
      (${customerB}, 'Customer B', 'b@example.com', ${userEmail}, ${workspaceB})
  `;

  await sql`
    insert into public.invoices (
      id,
      customer_id,
      amount,
      status,
      date,
      due_date,
      user_email,
      invoice_number,
      workspace_id,
      created_at
    )
    values
      (
        ${invoiceA},
        ${customerA},
        15000,
        'pending',
        date '2026-01-10',
        date '2026-01-20',
        ${userEmail},
        'A-001',
        ${workspaceA},
        now()
      ),
      (
        ${invoiceB},
        ${customerB},
        27000,
        'pending',
        date '2026-01-11',
        date '2026-01-21',
        ${userEmail},
        'B-001',
        ${workspaceB},
        now()
      )
  `;

  return {
    userId,
    userEmail,
    teammateUserId,
    teammateUserEmail,
    workspaceA,
    workspaceB,
    customerA,
    customerB,
    invoiceA,
    invoiceB,
  };
}

async function run() {
  try {
    execSync('node scripts/assert-hooks-disabled.mjs', {
      stdio: 'inherit',
      env: {
        ...process.env,
        POSTGRES_URL: testDbUrl,
        DATABASE_URL: testDbUrl,
      },
    });

    execSync('pnpm db:migrate', {
      stdio: 'inherit',
      env: {
        ...process.env,
        POSTGRES_URL: testDbUrl,
        DATABASE_URL: testDbUrl,
      },
    });

    const dataModule = await import('@/app/lib/data');
    const publicBrandingModule = await import('@/app/lib/public-branding');
    const payLinkModule = await import('@/app/lib/pay-link');
    const invoiceExportRoute = await import('@/app/api/invoices/export/route');
    const customerExportRoute = await import('@/app/api/customers/export/route');
    const sendInvoiceRoute = await import('@/app/api/invoices/[id]/send/route');
    const publicInvoicePayRoute = await import('@/app/api/public/invoices/[token]/pay/route');
    const remindersRunRoute = await import('@/app/api/reminders/run/route');
    const refundRequestRoute = await import('@/app/api/public/invoices/[token]/refund-request/route');
    const refundApproveRoute = await import('@/app/api/dashboard/refund-requests/[id]/approve/route');
    const smokeCheckPingRoute = await import('@/app/api/settings/smoke-check/ping/route');
    const stripePortalRoute = await import('@/app/api/stripe/portal/route');
    const workspaceBillingModule = await import('@/app/lib/workspace-billing');
    const stripeWorkspaceMetadataModule = await import('@/app/lib/stripe-workspace-metadata');
    const invoiceWorkspaceBillingModule = await import('@/app/lib/invoice-workspace-billing');
    const { authConfig } = await import('@/auth.config');

    let failures = 0;

    async function runCase(name: string, fn: () => Promise<void>) {
      try {
        await resetDb();
        await fn();
        console.log(`PASS ${name}`);
      } catch (error) {
        failures += 1;
        console.error(`FAIL ${name}`);
        console.error(error);
      } finally {
        dataModule.__testHooks.requireWorkspaceContextOverride = null;
        invoiceExportRoute.__testHooks.authOverride = null;
        invoiceExportRoute.__testHooks.requireWorkspaceContextOverride = null;
        invoiceExportRoute.__testHooks.enforceRateLimitOverride = null;
        customerExportRoute.__testHooks.authOverride = null;
        customerExportRoute.__testHooks.requireWorkspaceContextOverride = null;
        customerExportRoute.__testHooks.enforceRateLimitOverride = null;
        sendInvoiceRoute.__testHooks.authOverride = null;
        sendInvoiceRoute.__testHooks.enforceRateLimitOverride = null;
        sendInvoiceRoute.__testHooks.requireWorkspaceRoleOverride = null;
        sendInvoiceRoute.__testHooks.sendInvoiceEmailOverride = null;
        sendInvoiceRoute.__testHooks.revalidatePathOverride = null;
        publicInvoicePayRoute.__testHooks.enforceRateLimitOverride = null;
        publicInvoicePayRoute.__testHooks.resolveStripeWorkspaceBillingForInvoiceOverride = null;
        publicInvoicePayRoute.__testHooks.assertStripeConfigOverride = null;
        publicInvoicePayRoute.__testHooks.checkConnectedAccountAccessOverride = null;
        publicInvoicePayRoute.__testHooks.getConnectChargeCapabilityStatusOverride = null;
        publicInvoicePayRoute.__testHooks.createInvoiceCheckoutSessionOverride = null;
        remindersRunRoute.__testHooks.sendWorkspaceEmailOverride = null;
        refundApproveRoute.__testHooks.ensureWorkspaceContextForCurrentUserOverride = null;
        refundApproveRoute.__testHooks.enforceRateLimitOverride = null;
        refundApproveRoute.__testHooks.paymentIntentRetrieveOverride = null;
        refundApproveRoute.__testHooks.refundCreateOverride = null;
        refundApproveRoute.__testHooks.chargeRetrieveOverride = null;
        smokeCheckPingRoute.__testHooks.ensureWorkspaceContextForCurrentUserOverride = null;
        smokeCheckPingRoute.__testHooks.getSmokeCheckAccessDecisionOverride = null;
        smokeCheckPingRoute.__testHooks.getSmokeCheckPingPayloadOverride = null;
        stripePortalRoute.__testHooks.authOverride = null;
        stripePortalRoute.__testHooks.ensureWorkspaceContextOverride = null;
        stripePortalRoute.__testHooks.enforceRateLimitOverride = null;
        stripePortalRoute.__testHooks.createCustomerOverride = null;
        stripePortalRoute.__testHooks.createPortalSessionOverride = null;
        stripePortalRoute.__testHooks.assertStripeConfigOverride = null;
        stripePortalRoute.__testHooks.onResolvedPortalCustomerId = null;
      }
    }

    await runCase('unauthenticated diagnostics dashboard path is denied by auth callback', async () => {
      const authorized = authConfig.callbacks?.authorized;
      assert.ok(authorized, 'authorized callback should be defined');

      const result = await authorized?.({
        auth: null,
        request: {
          nextUrl: new URL('http://localhost/dashboard/settings/smoke-check'),
        },
      } as never);

      assert.equal(result, false, 'unauthenticated diagnostics dashboard request should be denied');
    });

    await runCase('authenticated non-internal user is denied diagnostics endpoint', async () => {
      const previousDiagnosticsEnabled = process.env.DIAGNOSTICS_ENABLED;
      const previousInternalAdmins = process.env.INTERNAL_ADMIN_EMAILS;

      process.env.DIAGNOSTICS_ENABLED = '1';
      process.env.INTERNAL_ADMIN_EMAILS = 'internal-admin@example.com';

      try {
        smokeCheckPingRoute.__testHooks.ensureWorkspaceContextForCurrentUserOverride = async () =>
          ({
            userEmail: 'member@example.com',
          }) as never;

        const response = await smokeCheckPingRoute.GET();
        assert.equal(response.status, 403, 'non-internal diagnostics endpoint request should be denied');
      } finally {
        process.env.DIAGNOSTICS_ENABLED = previousDiagnosticsEnabled;
        process.env.INTERNAL_ADMIN_EMAILS = previousInternalAdmins;
      }
    });

    await runCase('unauthenticated diagnostics endpoint is denied', async () => {
      const previousDiagnosticsEnabled = process.env.DIAGNOSTICS_ENABLED;
      const previousInternalAdmins = process.env.INTERNAL_ADMIN_EMAILS;

      process.env.DIAGNOSTICS_ENABLED = '1';
      process.env.INTERNAL_ADMIN_EMAILS = 'internal-admin@example.com';

      try {
        smokeCheckPingRoute.__testHooks.ensureWorkspaceContextForCurrentUserOverride = async () => {
          throw new Error('Unauthorized');
        };

        const response = await smokeCheckPingRoute.GET();
        assert.equal(response.status, 401, 'unauthenticated diagnostics endpoint request should be denied');
      } finally {
        process.env.DIAGNOSTICS_ENABLED = previousDiagnosticsEnabled;
        process.env.INTERNAL_ADMIN_EMAILS = previousInternalAdmins;
      }
    });

    await runCase('authenticated internal user is allowed diagnostics endpoint', async () => {
      const previousDiagnosticsEnabled = process.env.DIAGNOSTICS_ENABLED;
      const previousInternalAdmins = process.env.INTERNAL_ADMIN_EMAILS;

      process.env.DIAGNOSTICS_ENABLED = '1';
      process.env.INTERNAL_ADMIN_EMAILS = 'internal-admin@example.com';

      try {
        smokeCheckPingRoute.__testHooks.ensureWorkspaceContextForCurrentUserOverride = async () =>
          ({
            userEmail: 'internal-admin@example.com',
          }) as never;
        smokeCheckPingRoute.__testHooks.getSmokeCheckAccessDecisionOverride = async () =>
          ({
            allowed: true,
            reason: 'test',
            context: {} as never,
          }) as never;
        smokeCheckPingRoute.__testHooks.getSmokeCheckPingPayloadOverride = async () => ({
          checks: [],
          env: {},
        });

        const response = await smokeCheckPingRoute.GET();
        assert.equal(response.status, 200, 'internal diagnostics endpoint request should be allowed');
      } finally {
        process.env.DIAGNOSTICS_ENABLED = previousDiagnosticsEnabled;
        process.env.INTERNAL_ADMIN_EMAILS = previousInternalAdmins;
      }
    });

    await runCase('stripe workspace metadata parser prefers workspace_id', async () => {
      assert.equal(
        stripeWorkspaceMetadataModule.readWorkspaceIdFromStripeMetadata({
          workspace_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        }),
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      );
      assert.equal(
        stripeWorkspaceMetadataModule.readWorkspaceIdFromStripeMetadata({
          workspace_id: '   ',
        }),
        null,
      );
      assert.equal(
        stripeWorkspaceMetadataModule.readWorkspaceIdFromStripeMetadata({
          workspaceId: 'legacy',
        }),
        null,
      );
      assert.equal(
        stripeWorkspaceMetadataModule.readLegacyWorkspaceIdFromStripeMetadata({
          workspaceId: 'legacy-workspace-id',
        }),
        'legacy-workspace-id',
      );
    });

    await runCase('listing isolation (invoices + customers)', async () => {
      const fixtures = await seedFixtures();
      const workspaceAContext: WorkspaceContext = {
        userEmail: fixtures.userEmail,
        workspaceId: fixtures.workspaceA,
      };

      dataModule.__testHooks.requireWorkspaceContextOverride = async () => workspaceAContext;

      const invoices = await dataModule.fetchFilteredInvoices('', 1, 'all', 'created_at', 'desc', 25);
      const customers = await dataModule.fetchFilteredCustomers('', 1, 25, 'name', 'asc');

      assert.equal(invoices.length, 1, 'workspace A should only see one invoice');
      assert.equal(invoices[0].id, fixtures.invoiceA);
      assert.equal(customers.length, 1, 'workspace A should only see one customer');
      assert.equal(customers[0].id, fixtures.customerA);
    });

    await runCase('workspace billing keeps plans isolated between workspaces', async () => {
      const fixtures = await seedFixtures();
      await sql`
        insert into public.workspace_billing (
          workspace_id,
          plan,
          subscription_status,
          stripe_customer_id,
          updated_at
        )
        values
          (${fixtures.workspaceA}, 'solo', 'active', 'cus_workspace_a', now()),
          (${fixtures.workspaceB}, 'studio', 'active', 'cus_workspace_b', now())
      `;

      const workspaceABilling = await workspaceBillingModule.resolveBillingContext({
        workspaceId: fixtures.workspaceA,
        userId: fixtures.userId,
      });
      const workspaceBBilling = await workspaceBillingModule.resolveBillingContext({
        workspaceId: fixtures.workspaceB,
        userId: fixtures.userId,
      });

      assert.equal(workspaceABilling.plan, 'solo');
      assert.equal(workspaceBBilling.plan, 'studio');
      assert.notEqual(
        workspaceABilling.plan,
        workspaceBBilling.plan,
        'workspace plans must remain isolated',
      );
    });

    await runCase('same-workspace members share listing + export visibility', async () => {
      const fixtures = await seedFixtures();
      const workspaceAOwnerContext: WorkspaceContext = {
        userEmail: fixtures.userEmail,
        workspaceId: fixtures.workspaceA,
      };
      const workspaceAMemberContext: WorkspaceContext = {
        userEmail: fixtures.teammateUserEmail,
        workspaceId: fixtures.workspaceA,
      };
      const noRateLimit = async () => null;

      dataModule.__testHooks.requireWorkspaceContextOverride = async () => workspaceAOwnerContext;
      const ownerInvoices = await dataModule.fetchFilteredInvoices('', 1, 'all', 'created_at', 'desc', 25);
      assert.equal(ownerInvoices.length, 1, 'owner should see workspace A invoice');
      assert.equal(ownerInvoices[0].id, fixtures.invoiceA);

      dataModule.__testHooks.requireWorkspaceContextOverride = async () => workspaceAMemberContext;
      const memberInvoices = await dataModule.fetchFilteredInvoices('', 1, 'all', 'created_at', 'desc', 25);
      assert.equal(memberInvoices.length, 1, 'member should see same workspace A invoice');
      assert.equal(memberInvoices[0].id, fixtures.invoiceA);

      const memberAuthSession = async () => ({ user: { email: fixtures.teammateUserEmail } });
      invoiceExportRoute.__testHooks.authOverride = memberAuthSession;
      invoiceExportRoute.__testHooks.requireWorkspaceContextOverride = async () => workspaceAMemberContext;
      invoiceExportRoute.__testHooks.enforceRateLimitOverride = noRateLimit;

      const invoiceExportRes = await invoiceExportRoute.GET(
        new Request('http://localhost/api/invoices/export'),
      );
      const invoiceExportCsv = await invoiceExportRes.text();
      assert.equal(invoiceExportRes.status, 200, 'member invoice export should succeed');
      assert.match(invoiceExportCsv, new RegExp(fixtures.invoiceA));
      assert.doesNotMatch(invoiceExportCsv, new RegExp(fixtures.invoiceB));
    });

    await runCase('same-workspace member can create invoice for owner customer', async () => {
      const fixtures = await seedFixtures();
      const memberInvoiceId = 'cccccccc-5555-4555-8555-cccccccc5555';
      const memberInvoiceNumber = 'A-002';

      await sql`
        insert into public.invoices (
          id,
          customer_id,
          amount,
          status,
          date,
          due_date,
          user_email,
          invoice_number,
          workspace_id,
          created_at
        )
        values (
          ${memberInvoiceId},
          ${fixtures.customerA},
          22000,
          'pending',
          date '2026-01-12',
          date '2026-01-22',
          ${fixtures.teammateUserEmail},
          ${memberInvoiceNumber},
          ${fixtures.workspaceA},
          now()
        )
      `;

      const workspaceAOwnerContext: WorkspaceContext = {
        userEmail: fixtures.userEmail,
        workspaceId: fixtures.workspaceA,
      };
      const workspaceAMemberContext: WorkspaceContext = {
        userEmail: fixtures.teammateUserEmail,
        workspaceId: fixtures.workspaceA,
      };

      dataModule.__testHooks.requireWorkspaceContextOverride = async () => workspaceAOwnerContext;
      const ownerInvoices = await dataModule.fetchFilteredInvoices('', 1, 'all', 'created_at', 'desc', 25);
      assert.ok(
        ownerInvoices.some((invoice) => invoice.id === memberInvoiceId),
        'owner should see member-created invoice in the same workspace',
      );

      dataModule.__testHooks.requireWorkspaceContextOverride = async () => workspaceAMemberContext;
      const memberInvoices = await dataModule.fetchFilteredInvoices('', 1, 'all', 'created_at', 'desc', 25);
      assert.ok(
        memberInvoices.some((invoice) => invoice.id === memberInvoiceId),
        'member should see their created invoice in the same workspace',
      );
    });

    await runCase('invoice workspace billing resolver uses workspace owner Stripe account', async () => {
      const fixtures = await seedFixtures();
      const memberInvoiceId = 'dddddddd-6666-4666-8666-dddddddd6666';
      const ownerStripeAccount = 'acct_workspace_owner';
      const memberStripeAccount = 'acct_workspace_member';
      const workspaceCustomerId = 'cus_workspace_a';

      await sql`
        update public.users
        set
          stripe_connect_account_id = case
            when id = ${fixtures.userId} then ${ownerStripeAccount}
            when id = ${fixtures.teammateUserId} then ${memberStripeAccount}
            else stripe_connect_account_id
          end,
          stripe_connect_payouts_enabled = true,
          stripe_connect_details_submitted = true
        where id in (${fixtures.userId}, ${fixtures.teammateUserId})
      `;

      await sql`
        insert into public.workspace_billing (
          workspace_id,
          plan,
          subscription_status,
          stripe_customer_id,
          updated_at
        )
        values (
          ${fixtures.workspaceA},
          'solo',
          'active',
          ${workspaceCustomerId},
          now()
        )
      `;

      await sql`
        insert into public.invoices (
          id,
          customer_id,
          amount,
          status,
          date,
          due_date,
          user_email,
          invoice_number,
          workspace_id,
          created_at
        )
        values (
          ${memberInvoiceId},
          ${fixtures.customerA},
          18000,
          'pending',
          date '2026-01-13',
          date '2026-01-23',
          ${fixtures.teammateUserEmail},
          'A-003',
          ${fixtures.workspaceA},
          now()
        )
      `;

      const resolved =
        await invoiceWorkspaceBillingModule.resolveStripeWorkspaceBillingForInvoice(
          memberInvoiceId,
        );

      assert.ok(resolved, 'workspace billing resolver should return a row');
      assert.equal(resolved.workspaceId, fixtures.workspaceA);
      assert.equal(resolved.stripeAccountId, ownerStripeAccount);
      assert.equal(resolved.stripeCustomerId, workspaceCustomerId);
      assert.notEqual(resolved.stripeAccountId, memberStripeAccount);
    });

    await runCase('public branding resolves by invoice workspace (not user email)', async () => {
      const fixtures = await seedFixtures();
      const workspaceBUserEmail = fixtures.userEmail.replace('@', '+b@');

      await sql`
        insert into public.company_profiles (
          user_email,
          workspace_id,
          company_name,
          billing_email
        )
        values
          (${fixtures.userEmail}, ${fixtures.workspaceA}, 'Workspace A Brand', 'billing-a@example.com'),
          (${workspaceBUserEmail}, ${fixtures.workspaceB}, 'Workspace B Brand', 'billing-b@example.com')
      `;

      const workspaceABranding = await publicBrandingModule.getCompanyProfileForInvoiceWorkspace({
        invoiceId: fixtures.invoiceA,
        workspaceId: fixtures.workspaceA,
        userEmail: fixtures.userEmail,
      });

      assert.equal(workspaceABranding.companyName, 'Workspace A Brand');
      assert.equal(workspaceABranding.billingEmail, 'billing-a@example.com');
      assert.notEqual(workspaceABranding.companyName, 'Workspace B Brand');
    });

    await runCase('export isolation (invoices + customers)', async () => {
      const fixtures = await seedFixtures();
      const workspaceAContext: WorkspaceContext = {
        userEmail: fixtures.userEmail,
        workspaceId: fixtures.workspaceA,
      };

      const authSession = async () => ({ user: { email: fixtures.userEmail } });
      const noRateLimit = async () => null;

      invoiceExportRoute.__testHooks.authOverride = authSession;
      invoiceExportRoute.__testHooks.requireWorkspaceContextOverride = async () => workspaceAContext;
      invoiceExportRoute.__testHooks.enforceRateLimitOverride = noRateLimit;

      customerExportRoute.__testHooks.authOverride = authSession;
      customerExportRoute.__testHooks.requireWorkspaceContextOverride = async () => workspaceAContext;
      customerExportRoute.__testHooks.enforceRateLimitOverride = noRateLimit;

      const invoiceRes = await invoiceExportRoute.GET(
        new Request('http://localhost/api/invoices/export'),
      );
      const invoiceCsv = await invoiceRes.text();
      assert.equal(invoiceRes.status, 200, 'invoice export should succeed');
      assert.match(invoiceCsv, new RegExp(fixtures.invoiceA));
      assert.doesNotMatch(invoiceCsv, new RegExp(fixtures.invoiceB));

      const customerRes = await customerExportRoute.GET(
        new Request('http://localhost/api/customers/export'),
      );
      const customerCsv = await customerRes.text();
      assert.equal(customerRes.status, 200, 'customer export should succeed');
      assert.match(customerCsv, new RegExp(fixtures.customerA));
      assert.doesNotMatch(customerCsv, new RegExp(fixtures.customerB));
    });

    await runCase('portal route uses workspace billing stripe_customer_id', async () => {
      const fixtures = await seedFixtures();
      const noRateLimit = async () => null;
      const workspaceCustomerId = 'cus_workspace_specific';

      await sql`
        insert into public.workspace_billing (
          workspace_id,
          plan,
          subscription_status,
          stripe_customer_id,
          updated_at
        )
        values (
          ${fixtures.workspaceB},
          'studio',
          'active',
          ${workspaceCustomerId},
          now()
        )
      `;

      stripePortalRoute.__testHooks.authOverride = async () => ({
        user: { email: fixtures.userEmail },
      });
      stripePortalRoute.__testHooks.ensureWorkspaceContextOverride = async () => ({
        workspaceId: fixtures.workspaceB,
      });
      stripePortalRoute.__testHooks.enforceRateLimitOverride = noRateLimit;
      stripePortalRoute.__testHooks.assertStripeConfigOverride = () => {};
      stripePortalRoute.__testHooks.createPortalSessionOverride = async ({ customer }) => ({
        url: `https://portal.test/${customer}`,
      });

      let resolvedCustomerId: string | null = null;
      stripePortalRoute.__testHooks.onResolvedPortalCustomerId = (customerId) => {
        resolvedCustomerId = customerId;
      };

      const response = await stripePortalRoute.POST(
        new Request('http://localhost/api/stripe/portal', { method: 'POST' }),
      );
      const payload = await response.json();

      assert.equal(response.status, 200, 'portal route should succeed');
      assert.equal(resolvedCustomerId, workspaceCustomerId);
      assert.equal(payload.url, `https://portal.test/${workspaceCustomerId}`);
    });

    await runCase('send isolation blocks cross-workspace invoice send', async () => {
      const fixtures = await seedFixtures();
      let sendCalled = false;

      sendInvoiceRoute.__testHooks.authOverride = async () => ({ user: { email: fixtures.userEmail } });
      sendInvoiceRoute.__testHooks.requireWorkspaceRoleOverride = async () => ({
        workspaceId: fixtures.workspaceA,
        role: 'owner',
      });
      sendInvoiceRoute.__testHooks.enforceRateLimitOverride = async () => null;
      sendInvoiceRoute.__testHooks.sendInvoiceEmailOverride = async () => {
        sendCalled = true;
        return { provider: 'test', sentAt: new Date().toISOString() };
      };
      sendInvoiceRoute.__testHooks.revalidatePathOverride = () => {};

      const res = await sendInvoiceRoute.POST(
        new Request(`http://localhost/api/invoices/${fixtures.invoiceB}/send`, { method: 'POST' }),
        { params: Promise.resolve({ id: fixtures.invoiceB }) },
      );

      assert.ok(
        res.status === 403 || res.status === 404,
        `expected 403 or 404 for cross-workspace send, got ${res.status}`,
      );
      assert.equal(sendCalled, false, 'cross-workspace invoice must not trigger email send');
    });

    await runCase('send invoice route triggers successfully for workspace invoice', async () => {
      const fixtures = await seedFixtures();
      let sendCalled = false;

      sendInvoiceRoute.__testHooks.authOverride = async () => ({ user: { email: fixtures.userEmail } });
      sendInvoiceRoute.__testHooks.requireWorkspaceRoleOverride = async () => ({
        workspaceId: fixtures.workspaceA,
        role: 'owner',
      });
      sendInvoiceRoute.__testHooks.enforceRateLimitOverride = async () => null;
      sendInvoiceRoute.__testHooks.sendInvoiceEmailOverride = async () => {
        sendCalled = true;
        return { provider: 'test', sentAt: new Date().toISOString() };
      };
      sendInvoiceRoute.__testHooks.revalidatePathOverride = () => {};

      const res = await sendInvoiceRoute.POST(
        new Request(`http://localhost/api/invoices/${fixtures.invoiceA}/send`, { method: 'POST' }),
        { params: Promise.resolve({ id: fixtures.invoiceA }) },
      );
      const body = await res.json();

      assert.equal(res.status, 200, 'workspace invoice send should succeed');
      assert.equal(body.ok, true);
      assert.equal(sendCalled, true, 'send route should trigger invoice email path');
    });

    await runCase('reminder run sends via workspace provider selector path', async () => {
      const fixtures = await seedFixtures();
      let sendCalled = false;
      let sendUseCase: string | null = null;
      const previousReminderCronToken = process.env.REMINDER_CRON_TOKEN;
      const previousMailFromEmail = process.env.MAIL_FROM_EMAIL;

      process.env.REMINDER_CRON_TOKEN = 'test-reminder-cron-token';
      process.env.MAIL_FROM_EMAIL = 'billing@example.com';

      try {
        remindersRunRoute.__testHooks.sendWorkspaceEmailOverride = async (input) => {
          sendCalled = true;
          sendUseCase = input.useCase ?? null;
          return { provider: 'smtp', messageId: 'test-message-id' };
        };

        const response = await remindersRunRoute.POST(
          new Request('http://localhost/api/reminders/run?triggeredBy=cron', {
            method: 'POST',
            headers: {
              authorization: 'Bearer test-reminder-cron-token',
              'x-reminders-workspace-id': fixtures.workspaceA,
              'x-forwarded-for': '203.0.113.20',
            },
          }),
        );

        assert.equal(response.status, 200, 'reminder run should succeed');
        assert.equal(sendCalled, true, 'reminder run should call workspace email sender');
        assert.equal(sendUseCase, 'reminder', 'reminder run should pass reminder use case');
      } finally {
        process.env.REMINDER_CRON_TOKEN = previousReminderCronToken;
        process.env.MAIL_FROM_EMAIL = previousMailFromEmail;
      }
    });

    await runCase('refund request scopes to invoice workspace (not active workspace)', async () => {
      const fixtures = await seedFixtures();

      await sql`
        update public.users
        set active_workspace_id = ${fixtures.workspaceB}
        where id = ${fixtures.userId}
      `;
      await sql`
        update public.invoices
        set
          status = 'paid',
          paid_at = now()
        where id = ${fixtures.invoiceA}
      `;

      const token = payLinkModule.generatePayToken(fixtures.invoiceA);
      const res = await refundRequestRoute.POST(
        new Request(`http://localhost/api/public/invoices/${token}/refund-request`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-forwarded-for': '203.0.113.10',
          },
          body: JSON.stringify({
            reason: 'Please refund this accidental duplicate payment.',
          }),
        }),
        { params: Promise.resolve({ token }) },
      );

      assert.equal(res.status, 200, 'refund request should succeed');

      const [refundRow] = await sql<{ workspace_id: string; invoice_id: string }[]>`
        select workspace_id, invoice_id
        from public.refund_requests
        where invoice_id = ${fixtures.invoiceA}
        limit 1
      `;
      assert.ok(refundRow, 'refund request row should be inserted');
      assert.equal(refundRow.workspace_id, fixtures.workspaceA);
      assert.notEqual(refundRow.workspace_id, fixtures.workspaceB);
    });

    await runCase('refund request token cannot be remapped to another workspace', async () => {
      const fixtures = await seedFixtures();

      await sql`
        update public.invoices
        set
          status = 'paid',
          paid_at = now()
        where id in (${fixtures.invoiceA}, ${fixtures.invoiceB})
      `;

      const token = payLinkModule.generatePayToken(fixtures.invoiceB);
      const res = await refundRequestRoute.POST(
        new Request(`http://localhost/api/public/invoices/${token}/refund-request`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-forwarded-for': '203.0.113.22',
          },
          body: JSON.stringify({
            reason: 'Workspace B refund request should remain in workspace B.',
          }),
        }),
        { params: Promise.resolve({ token }) },
      );

      assert.equal(res.status, 200, 'refund request should succeed');

      const [refundRow] = await sql<{ workspace_id: string; invoice_id: string }[]>`
        select workspace_id, invoice_id
        from public.refund_requests
        where invoice_id = ${fixtures.invoiceB}
        limit 1
      `;
      assert.ok(refundRow, 'refund request row should be inserted for invoice B');
      assert.equal(refundRow.invoice_id, fixtures.invoiceB);
      assert.equal(refundRow.workspace_id, fixtures.workspaceB);
      assert.notEqual(refundRow.workspace_id, fixtures.workspaceA);
    });

    await runCase('refund request fails closed when invoice.workspace_id is missing', async () => {
      const fixtures = await seedFixtures();

      await sql`
        update public.invoices
        set
          status = 'paid',
          paid_at = now(),
          workspace_id = null
        where id = ${fixtures.invoiceA}
      `;

      const token = payLinkModule.generatePayToken(fixtures.invoiceA);
      const res = await refundRequestRoute.POST(
        new Request(`http://localhost/api/public/invoices/${token}/refund-request`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-forwarded-for': '203.0.113.11',
          },
          body: JSON.stringify({
            reason: 'Refund request should fail when workspace is unset.',
          }),
        }),
        { params: Promise.resolve({ token }) },
      );

      assert.equal(res.status, 404, 'missing invoice workspace should fail closed');

      const rows = await sql<{ id: string }[]>`
        select id
        from public.refund_requests
        where invoice_id = ${fixtures.invoiceA}
      `;
      assert.equal(rows.length, 0, 'no refund request should be created');
    });

    await runCase('pay-link -> pay -> refund-request -> approve happy path for workspace', async () => {
      const fixtures = await seedFixtures();
      const ownerStripeAccount = 'acct_workspace_owner_pay_refund_happy';

      await sql`
        update public.users
        set
          stripe_connect_account_id = ${ownerStripeAccount},
          stripe_connect_payouts_enabled = true,
          stripe_connect_details_submitted = true
        where id = ${fixtures.userId}
      `;
      await sql`
        insert into public.workspace_billing (
          workspace_id,
          plan,
          subscription_status,
          stripe_customer_id,
          updated_at
        )
        values (
          ${fixtures.workspaceA},
          'solo',
          'active',
          'cus_pay_refund_workspace_a',
          now()
        )
      `;

      const token = payLinkModule.generatePayToken(fixtures.invoiceA);

      publicInvoicePayRoute.__testHooks.enforceRateLimitOverride = async () => null;
      publicInvoicePayRoute.__testHooks.assertStripeConfigOverride = () => {};
      publicInvoicePayRoute.__testHooks.checkConnectedAccountAccessOverride = async () => ({
        ok: true,
        isModeMismatch: false,
        message: 'ok',
      });
      publicInvoicePayRoute.__testHooks.getConnectChargeCapabilityStatusOverride = async () => ({
        ok: true,
        cardPayments: 'active',
        chargesEnabled: true,
        detailsSubmitted: true,
      });
      publicInvoicePayRoute.__testHooks.createInvoiceCheckoutSessionOverride = async () => ({
        checkoutSession: {
          id: 'cs_test_pay_refund_happy',
          url: 'https://checkout.stripe.test/session',
          payment_intent: 'pi_test_pay_refund_happy',
        },
        feeBreakdown: {
          processingUpliftAmount: 0,
          payableAmount: 15000,
          platformFeeAmount: 0,
        },
      });

      const payRes = await publicInvoicePayRoute.POST(
        new Request(`http://localhost/api/public/invoices/${token}/pay`, {
          method: 'POST',
          headers: {
            'x-forwarded-for': '203.0.113.31',
          },
        }),
        { params: Promise.resolve({ token }) },
      );
      const payBody = await payRes.json();
      assert.equal(payRes.status, 200, 'public pay route should return checkout URL');
      assert.equal(payBody.url, 'https://checkout.stripe.test/session');

      await sql`
        update public.invoices
        set
          status = 'paid',
          paid_at = now()
        where id = ${fixtures.invoiceA}
      `;

      const requestRes = await refundRequestRoute.POST(
        new Request(`http://localhost/api/public/invoices/${token}/refund-request`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-forwarded-for': '203.0.113.32',
          },
          body: JSON.stringify({
            reason: 'Please refund this paid invoice from the happy path flow.',
          }),
        }),
        { params: Promise.resolve({ token }) },
      );
      assert.equal(requestRes.status, 200, 'refund request should succeed after pay');

      const [requestRow] = await sql<{ id: string }[]>`
        select id
        from public.refund_requests
        where invoice_id = ${fixtures.invoiceA}
        order by requested_at desc
        limit 1
      `;
      assert.ok(requestRow?.id, 'refund request row should be present');

      refundApproveRoute.__testHooks.ensureWorkspaceContextForCurrentUserOverride = async () => ({
        userEmail: fixtures.userEmail,
        workspaceId: fixtures.workspaceA,
        userRole: 'owner',
      });
      refundApproveRoute.__testHooks.enforceRateLimitOverride = async () => null;
      refundApproveRoute.__testHooks.paymentIntentRetrieveOverride = async () => ({
        latest_charge: 'ch_test_pay_refund_happy',
      });
      refundApproveRoute.__testHooks.refundCreateOverride = async () => ({
        id: 're_test_pay_refund_happy',
      });
      refundApproveRoute.__testHooks.chargeRetrieveOverride = async () => ({
        amount: 15000,
        amount_refunded: 15000,
        currency: 'eur',
        refunds: {
          data: [{ id: 're_test_pay_refund_happy', created: 1700000000, amount: 15000 }],
        },
      });

      const approveRes = await refundApproveRoute.POST(
        new Request(`http://localhost/api/dashboard/refund-requests/${requestRow.id}/approve`, {
          method: 'POST',
          headers: {
            'x-forwarded-for': '203.0.113.33',
          },
        }),
        { params: Promise.resolve({ id: requestRow.id }) },
      );
      const approveBody = await approveRes.json();

      assert.equal(approveRes.status, 200, 'refund approval should succeed');
      assert.equal(approveBody.ok, true);

      const [invoiceAfter] = await sql<{ status: string }[]>`
        select status
        from public.invoices
        where id = ${fixtures.invoiceA}
        limit 1
      `;
      assert.equal(invoiceAfter?.status, 'refunded');
    });

    await runCase('refund approve resolves stripe via invoice workspace billing', async () => {
      const fixtures = await seedFixtures();
      const ownerStripeAccount = 'acct_workspace_owner_for_refund';
      const memberStripeAccount = 'acct_workspace_member_for_refund';
      const positiveRequestId = 'f1f1f1f1-aaaa-4aaa-8aaa-f1f1f1f1f1f1';
      const negativeRequestId = 'f2f2f2f2-bbbb-4bbb-8bbb-f2f2f2f2f2f2';
      const paidMemberInvoiceId = 'eeeeeeee-7777-4777-8777-eeeeeeee7777';
      const paidOwnerInvoiceId = 'eeeeeeee-8888-4888-8888-eeeeeeee8888';
      let seenStripeAccount: string | null = null;

      await sql`
        update public.users
        set
          stripe_connect_account_id = case
            when id = ${fixtures.userId} then ${ownerStripeAccount}
            when id = ${fixtures.teammateUserId} then ${memberStripeAccount}
            else stripe_connect_account_id
          end,
          stripe_connect_payouts_enabled = true,
          stripe_connect_details_submitted = true
        where id in (${fixtures.userId}, ${fixtures.teammateUserId})
      `;

      await sql`
        insert into public.workspace_billing (
          workspace_id,
          plan,
          subscription_status,
          stripe_customer_id,
          updated_at
        )
        values (
          ${fixtures.workspaceA},
          'solo',
          'active',
          'cus_refund_workspace_a',
          now()
        )
      `;

      await sql`
        insert into public.invoices (
          id,
          customer_id,
          amount,
          status,
          paid_at,
          date,
          due_date,
          user_email,
          invoice_number,
          workspace_id,
          stripe_payment_intent_id,
          created_at
        )
        values
          (
            ${paidMemberInvoiceId},
            ${fixtures.customerA},
            21000,
            'paid',
            now(),
            date '2026-01-14',
            date '2026-01-24',
            ${fixtures.teammateUserEmail},
            'A-004',
            ${fixtures.workspaceA},
            'pi_refund_member_invoice',
            now()
          ),
          (
            ${paidOwnerInvoiceId},
            ${fixtures.customerA},
            22000,
            'paid',
            now(),
            date '2026-01-15',
            date '2026-01-25',
            ${fixtures.userEmail},
            'A-005',
            ${fixtures.workspaceA},
            'pi_refund_owner_invoice',
            now()
          )
      `;

      await sql`
        insert into public.refund_requests (
          id,
          workspace_id,
          invoice_id,
          payer_email,
          reason,
          status
        )
        values
          (
            ${positiveRequestId},
            ${fixtures.workspaceA},
            ${paidMemberInvoiceId},
            'payer@example.com',
            'Approve member-created invoice refund.',
            'pending'
          ),
          (
            ${negativeRequestId},
            ${fixtures.workspaceA},
            ${paidOwnerInvoiceId},
            'payer@example.com',
            'Fail when workspace billing row is missing.',
            'pending'
          )
      `;

      refundApproveRoute.__testHooks.ensureWorkspaceContextForCurrentUserOverride = async () => ({
        userEmail: fixtures.userEmail,
        workspaceId: fixtures.workspaceA,
        userRole: 'owner',
      });
      refundApproveRoute.__testHooks.enforceRateLimitOverride = async () => null;
      refundApproveRoute.__testHooks.paymentIntentRetrieveOverride = async (
        _paymentIntentId,
        stripeAccount,
      ) => {
        seenStripeAccount = stripeAccount;
        return {
          latest_charge: 'ch_refund_member_invoice',
        };
      };
      refundApproveRoute.__testHooks.refundCreateOverride = async () => ({
        id: 're_refund_member_invoice',
      });
      refundApproveRoute.__testHooks.chargeRetrieveOverride = async () => ({
        amount: 21000,
        amount_refunded: 21000,
        currency: 'eur',
        refunds: {
          data: [{ id: 're_refund_member_invoice', created: 1700000000, amount: 21000 }],
        },
      });

      const positiveRes = await refundApproveRoute.POST(
        new Request(`http://localhost/api/dashboard/refund-requests/${positiveRequestId}/approve`, {
          method: 'POST',
          headers: {
            'x-forwarded-for': '203.0.113.12',
          },
        }),
        { params: Promise.resolve({ id: positiveRequestId }) },
      );

      assert.equal(positiveRes.status, 200, 'owner approval should succeed');
      const positiveBody = await positiveRes.json();
      assert.equal(positiveBody.ok, true);
      assert.equal(seenStripeAccount, ownerStripeAccount, 'must use workspace owner Stripe account');
      assert.notEqual(seenStripeAccount, memberStripeAccount);

      await sql`
        delete from public.workspace_billing
        where workspace_id = ${fixtures.workspaceA}
      `;

      const negativeRes = await refundApproveRoute.POST(
        new Request(`http://localhost/api/dashboard/refund-requests/${negativeRequestId}/approve`, {
          method: 'POST',
          headers: {
            'x-forwarded-for': '203.0.113.13',
          },
        }),
        { params: Promise.resolve({ id: negativeRequestId }) },
      );

      assert.equal(negativeRes.status, 409, 'missing workspace billing should fail closed');
      const negativeBody = await negativeRes.json();
      assert.equal(negativeBody.ok, false);
      assert.equal(negativeBody.code, 'WORKSPACE_BILLING_MISSING');
      assert.notEqual(negativeBody.message, 'Connected Stripe account is not configured.');
    });

    if (failures > 0) {
      process.exitCode = 1;
      throw new Error(`${failures} isolation test(s) failed.`);
    }

    console.log('All isolation tests passed.');

    if (process.env.NODE_ENV === 'test') {
      setTimeout(() => {
        const proc = process as NodeJS.Process & {
          _getActiveHandles?: () => unknown[];
          _getActiveRequests?: () => unknown[];
        };
        const handles = proc._getActiveHandles?.() ?? [];
        const requests = proc._getActiveRequests?.() ?? [];

        if (handles.length > 0 || requests.length > 0) {
          console.log('[isolation] Active handles before forced exit:', handles);
          console.log('[isolation] Active requests before forced exit:', requests);
        }

        process.exit(0);
      }, 1500);
    }
  } finally {
    await closeSqlClients();
  }
}

run().catch(async (error) => {
  console.error(error);
  await closeSqlClients().catch(() => {});
  process.exit(1);
});
