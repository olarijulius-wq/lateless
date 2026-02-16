import { Metadata } from 'next';
import { revalidatePath } from 'next/cache';
import { Button } from '@/app/ui/button';
import {
  ensureWorkspaceContextForCurrentUser,
  isTeamMigrationRequiredError,
  TEAM_MIGRATION_REQUIRED_CODE,
} from '@/app/lib/workspaces';
import {
  PRICING_FEE_CONFIG,
  assertPricingFeesSchemaReady,
  fetchWorkspacePricingSettings,
  isPricingFeesMigrationRequiredError,
  PRICING_FEES_MIGRATION_REQUIRED_CODE,
  upsertWorkspacePricingSettings,
} from '@/app/lib/pricing-fees';
import { PLAN_CONFIG, PLAN_IDS } from '@/app/lib/config';

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
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100 dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
        {migrationWarning}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Platform fee
        </h2>
        <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-300">
          {PLAN_IDS.map((planId) => {
            const plan = PLAN_CONFIG[planId];
            return (
              <p key={planId}>
                {plan.name}: €{(plan.platformFeeFixedCents / 100).toFixed(2)} +{' '}
                {plan.platformFeePercent.toFixed(1)}% (cap €{(plan.platformFeeCapCents / 100).toFixed(2)}) per paid invoice.
              </p>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Platform fee markup is managed by Lateless and is not configurable per merchant.
        </p>
      </div>

      <form
        action={updateProcessingUplift}
        className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-neutral-800 dark:bg-black dark:shadow-[0_18px_35px_rgba(0,0,0,0.45)]"
      >
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Processing uplift
        </h2>
        {!canManage ? (
          <p className="text-sm text-amber-700 dark:text-amber-200">
            Only owners and admins can change processing uplift settings.
          </p>
        ) : null}

        <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            name="processingUpliftEnabled"
            defaultChecked={processingUpliftEnabled}
            disabled={!canManage}
            className="mt-0.5 h-4 w-4 rounded border-slate-400 text-slate-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-slate-100"
          />
          <span>
            Enable price-inclusive processing uplift.
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              Payer label: “{PRICING_FEE_CONFIG.processingUplift.payerLabel}”.
            </span>
          </span>
        </label>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Default uplift formula: {PRICING_FEE_CONFIG.processingUplift.percent.toFixed(1)}% + €
          {(PRICING_FEE_CONFIG.processingUplift.fixedCents / 100).toFixed(2)} (gross-up).
        </p>

        <Button type="submit" disabled={!canManage}>
          Save fee settings
        </Button>
      </form>
    </div>
  );
}
