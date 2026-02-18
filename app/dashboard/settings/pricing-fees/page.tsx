import { Metadata } from 'next';
import { revalidatePath } from 'next/cache';
import {
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
  TEAM_MIGRATION_REQUIRED_CODE,
} from '@/app/lib/workspaces';
import {
  PRICING_FEE_CONFIG,
  assertPricingFeesSchemaReady,
  computeInvoiceFeeBreakdown,
  fetchWorkspacePricingSettings,
  isPricingFeesMigrationRequiredError,
  PRICING_FEES_MIGRATION_REQUIRED_CODE,
  upsertWorkspacePricingSettings,
} from '@/app/lib/pricing-fees';
import { PLAN_CONFIG, PLAN_IDS } from '@/app/lib/config';
import PricingPanel from '@/app/ui/pricing/panel';
import { primaryButtonClasses } from '@/app/ui/button';
import { LIGHT_SURFACE } from '@/app/ui/theme/tokens';

export const metadata: Metadata = {
  title: 'Pricing & Fees',
};

const migrationMessage =
  'Pricing and fees require DB migration 022_add_pricing_fee_fields.sql. Run migrations and retry.';

async function updateProcessingUplift(formData: FormData) {
  'use server';

  await assertPricingFeesSchemaReady();
  const context = await ensureWorkspaceContextForCurrentUser();
  if (context.userRole !== 'owner' && context.userRole !== 'admin') {
    throw new Error('Forbidden');
  }

  const processingUpliftEnabled = formData.get('processingUpliftEnabled') === 'on';
  await upsertWorkspacePricingSettings(context.workspaceId, {
    processingUpliftEnabled,
  });

  revalidatePath('/dashboard/settings/pricing-fees');
}

export default async function PricingFeesSettingsPage() {
  let migrationWarning: string | null = null;
  let canManage = false;
  let processingUpliftEnabled = PRICING_FEE_CONFIG.processingUplift.enabledByDefault;

  try {
    const context = await ensureWorkspaceContextForCurrentUser();
    canManage = context.userRole === 'owner' || context.userRole === 'admin';

    await assertPricingFeesSchemaReady();
    const settings = await fetchWorkspacePricingSettings(context.workspaceId);
    processingUpliftEnabled = settings.processingUpliftEnabled;
  } catch (error) {
    if (isTeamMigrationRequiredError(error)) {
      migrationWarning = `Team setup is missing (${TEAM_MIGRATION_REQUIRED_CODE}). ${migrationMessage}`;
    } else if (isPricingFeesMigrationRequiredError(error)) {
      migrationWarning = `${PRICING_FEES_MIGRATION_REQUIRED_CODE}: ${migrationMessage}`;
    } else {
      throw error;
    }
  }

  if (migrationWarning) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <div className={`rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100 dark:shadow-[0_16px_34px_rgba(0,0,0,0.42)]`}>
          {migrationWarning}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <PricingPanel className="space-y-2">
        <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">Pricing &amp; Fees</h2>
        <p className="text-sm text-slate-600 dark:text-neutral-300">
          Stripe processing fees are separate. Lateless adds a platform fee per paid invoice based on plan.
        </p>
      </PricingPanel>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {PLAN_IDS.map((planId) => {
          const plan = PLAN_CONFIG[planId];
          const example = computeInvoiceFeeBreakdown(10000, false, planId);
          return (
            <PricingPanel key={planId} className="space-y-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{plan.name}</h3>
                <span className="rounded-full border border-neutral-900 bg-neutral-900 px-2 py-0.5 text-[11px] text-white dark:border-neutral-700 dark:text-neutral-300">
                  Plan fee
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-neutral-300">
                €{(plan.platformFeeFixedCents / 100).toFixed(2)} + {plan.platformFeePercent.toFixed(1)}% per paid invoice
              </p>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                Cap: €{(plan.platformFeeCapCents / 100).toFixed(2)}
              </p>
              <div className={`rounded-xl border px-3 py-2 text-xs text-slate-700 ${LIGHT_SURFACE} dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300 dark:shadow-none`}>
                On €100 paid invoice: €{(example.platformFeeAmount / 100).toFixed(2)} fee
              </div>
            </PricingPanel>
          );
        })}
      </div>

      <PricingPanel className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Processing uplift</h3>
        <p className="text-sm text-slate-600 dark:text-neutral-300">
          Keep this on to present inclusive payment totals to payers.
          <span className="block text-xs text-slate-500 dark:text-neutral-400">
            Payer label: “{PRICING_FEE_CONFIG.processingUplift.payerLabel}”.
          </span>
        </p>
        <p className="text-xs text-slate-500 dark:text-neutral-400">
          Default uplift formula: {PRICING_FEE_CONFIG.processingUplift.percent.toFixed(1)}% + €
          {(PRICING_FEE_CONFIG.processingUplift.fixedCents / 100).toFixed(2)} (gross-up).
        </p>

        <form action={updateProcessingUplift} className="space-y-4">
          {!canManage ? (
            <p className="text-sm text-amber-700 dark:text-amber-200">
              Only owners and admins can change processing uplift settings.
            </p>
          ) : null}

          <label className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-sm text-slate-700 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-200 dark:shadow-none">
            <input
              type="checkbox"
              name="processingUpliftEnabled"
              defaultChecked={processingUpliftEnabled}
              disabled={!canManage}
              className="mt-0.5 h-4 w-4 rounded border-neutral-400 bg-white text-black dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            />
            <span>Enable price-inclusive processing uplift</span>
          </label>

          <button
            type="submit"
            disabled={!canManage}
            className={`${primaryButtonClasses} rounded-full`}
          >
            Save fee settings
          </button>
        </form>
      </PricingPanel>
    </div>
  );
}
