import { NextResponse } from 'next/server';
import { fetchUserPlanAndUsage } from '@/app/lib/data';
import {
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
} from '@/app/lib/workspaces';
import {
  fetchCurrentTallinnMonthWindow,
  fetchCurrentMonthInvoiceMetricCount,
  fetchInvoiceDailySeries,
  getDailyWindow,
  fetchReminderDailySeries,
  fetchUsageTopReasons,
  getUsageCapabilities,
  isUsageMigrationRequiredError,
  normalizeUsageInvoiceMetric,
  normalizeUsageInvoiceWindow,
  USAGE_MIGRATION_REQUIRED_CODE,
} from '@/app/lib/usage';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const context = await ensureWorkspaceContextForCurrentUser();
    const plan = await fetchUserPlanAndUsage();
    const monthWindow = await fetchCurrentTallinnMonthWindow();
    const params = new URL(request.url).searchParams;
    const metric = normalizeUsageInvoiceMetric(params.get('metric'));
    const win = normalizeUsageInvoiceWindow(params.get('win'));

    const [capabilities, monthMetric, invoiceDailyWindow, invoiceDaily, reminderDaily, topSkipReasons] =
      await Promise.all([
        getUsageCapabilities(),
        fetchCurrentMonthInvoiceMetricCount({
          workspaceId: context.workspaceId,
          userEmail: context.userEmail,
          metric: 'created',
        }),
        getDailyWindow(win),
        fetchInvoiceDailySeries({
          workspaceId: context.workspaceId,
          userEmail: context.userEmail,
          win,
          metric,
        }),
        fetchReminderDailySeries({
          workspaceId: context.workspaceId,
          userEmail: context.userEmail,
          days: 30,
        }),
        fetchUsageTopReasons({
          workspaceId: context.workspaceId,
          userEmail: context.userEmail,
          monthStart: monthWindow.monthStart,
          monthEnd: monthWindow.monthEnd,
        }),
      ]);

    return NextResponse.json({
      ok: true,
      workspaceId: context.workspaceId,
      userRole: context.userRole,
      metric,
      win,
      capabilities,
      plan: {
        plan: plan.plan,
        invoiceCount: plan.invoiceCount,
        maxPerMonth: plan.maxPerMonth,
        subscriptionStatus: plan.subscriptionStatus,
      },
      month: {
        created: monthMetric.count,
        total: monthMetric.count,
        debug: monthMetric,
      },
      invoices: {
        points: invoiceDaily.points,
        window: invoiceDailyWindow,
        debug: invoiceDaily.debug,
      },
      reminders: {
        points: reminderDaily.points,
        totals: reminderDaily.totals,
        debug: reminderDaily.debug,
      },
      topSkipReasons,
      monthStart: monthWindow.monthStart.toISOString(),
      monthEnd: monthWindow.monthEnd.toISOString(),
      monthStartDate: monthWindow.monthStartDate,
      monthEndDate: monthWindow.monthEndDate,
      timezone: monthWindow.timezone,
    });
  } catch (error) {
    if (isTeamMigrationRequiredError(error)) {
      return NextResponse.json(
        {
          ok: false,
          code: 'TEAM_MIGRATION_REQUIRED',
          message:
            'Team requires DB migrations 007_add_workspaces_and_team.sql and 013_add_active_workspace_and_company_profile_workspace_scope.sql. Run migrations and retry.',
        },
        { status: 503 },
      );
    }

    if (isUsageMigrationRequiredError(error)) {
      return NextResponse.json(
        {
          ok: false,
          code: USAGE_MIGRATION_REQUIRED_CODE,
          message:
            'Usage analytics requires DB migration 017_add_usage_events.sql. Run migrations and retry.',
        },
        { status: 503 },
      );
    }

    console.error('Load usage analytics failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to load usage analytics.' },
      { status: 500 },
    );
  }
}
