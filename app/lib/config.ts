export const PLAN_IDS = ['free', 'solo', 'pro', 'studio'] as const;

export type PlanId = (typeof PLAN_IDS)[number];

export type PlanConfig = {
  id: PlanId;
  name: string;
  maxPerMonth: number;
  priceMonthlyEuro: number;
  platformFeeFixedCents: number;
  platformFeePercent: number;
  platformFeeCapCents: number;
  canExportCsv: boolean;
  hasReminders: boolean;
  hasLatePayerAnalytics: boolean;
};

export const PLAN_CONFIG: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    maxPerMonth: 3,
    priceMonthlyEuro: 0,
    platformFeeFixedCents: 60,
    platformFeePercent: 1.5,
    platformFeeCapCents: 1500,
    canExportCsv: false,
    hasReminders: false,
    hasLatePayerAnalytics: false,
  },
  solo: {
    id: 'solo',
    name: 'Solo',
    maxPerMonth: 50,
    priceMonthlyEuro: 29,
    platformFeeFixedCents: 45,
    platformFeePercent: 1.0,
    platformFeeCapCents: 1000,
    canExportCsv: true,
    hasReminders: true,
    hasLatePayerAnalytics: true,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    maxPerMonth: 250,
    priceMonthlyEuro: 59,
    platformFeeFixedCents: 30,
    platformFeePercent: 0.7,
    platformFeeCapCents: 700,
    canExportCsv: true,
    hasReminders: true,
    hasLatePayerAnalytics: true,
  },
  studio: {
    id: 'studio',
    name: 'Studio',
    maxPerMonth: Number.POSITIVE_INFINITY,
    priceMonthlyEuro: 199,
    platformFeeFixedCents: 20,
    platformFeePercent: 0.4,
    platformFeeCapCents: 500,
    canExportCsv: true,
    hasReminders: true,
    hasLatePayerAnalytics: true,
  },
};

export const STRIPE_PRICE_ID_BY_PLAN: Record<
  Exclude<PlanId, 'free'>,
  string | undefined
> = {
  solo: process.env.STRIPE_PRICE_SOLO,
  pro: process.env.STRIPE_PRICE_PRO,
  // Studio is €199/month; keep Stripe Checkout mapped to STRIPE_PRICE_STUDIO.
  studio: process.env.STRIPE_PRICE_STUDIO,
};

export function normalizePlan(plan: string | null | undefined): PlanId {
  if (!plan) return 'free';
  return PLAN_IDS.includes(plan as PlanId) ? (plan as PlanId) : 'free';
}

export function isActiveSubscription(status: string | null | undefined) {
  return status === 'active' || status === 'trialing';
}

export function resolveEffectivePlan(
  plan: string | null | undefined,
  status: string | null | undefined,
) {
  const normalized = normalizePlan(plan);
  if (normalized === 'free') return 'free';
  return isActiveSubscription(status) ? normalized : 'free';
}

export function planFromStripePriceId(
  priceId: string | null | undefined,
): PlanId | null {
  if (!priceId) return null;

  const match = (
    Object.entries(STRIPE_PRICE_ID_BY_PLAN) as Array<
      [Exclude<PlanId, 'free'>, string | undefined]
    >
  ).find(([, id]) => id && id === priceId);

  return match ? match[0] : null;
}
