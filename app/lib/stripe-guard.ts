import 'server-only';

import fs from 'fs';
import path from 'path';
import Stripe from 'stripe';

export const STRIPE_CONFIG_ERROR_CODE = 'STRIPE_CONFIG_INVALID';

type StripeMode = 'test' | 'live';

type AssertStripeConfigInput = {
  expectedMode?: StripeMode;
  allowLiveInDev?: boolean;
};

type StripeRequestVerifier = {
  getPlatformAccount: () => Promise<Stripe.Account>;
  verifyConnectedAccountAccess: (connectedAccountId: string) => Promise<Stripe.Account>;
};

type StripeConfigState = {
  secretKeyMasked: string;
  secretKeyMode: StripeMode | 'unknown';
  environment: 'development' | 'preview' | 'production';
};

let hasPrintedEnvConflictWarning = false;

export function inferAppEnvironment(): StripeConfigState['environment'] {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === 'production') return 'production';
  if (vercelEnv === 'preview') return 'preview';
  if (process.env.NODE_ENV === 'production') return 'production';
  if (process.env.NODE_ENV === 'development') return 'development';
  return 'preview';
}

function detectStripeModeFromSecretKey(secretKey: string): StripeMode | 'unknown' {
  if (secretKey.startsWith('sk_live_')) return 'live';
  if (secretKey.startsWith('sk_test_')) return 'test';
  return 'unknown';
}

function maskSecretKey(secretKey: string) {
  const suffix = secretKey.slice(-4);
  return `****${suffix}`;
}

function readStripeKeyFromEnvFile(filePath: string): string | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const match = raw.match(/^\s*STRIPE_SECRET_KEY\s*=\s*(.*)\s*$/m);
    if (!match) return null;
    const value = match[1]?.trim();
    if (!value) return null;
    return value.replace(/^['"]|['"]$/g, '').trim() || null;
  } catch {
    return null;
  }
}

function warnOnConflictingLocalStripeEnvOnce() {
  if (hasPrintedEnvConflictWarning) return;
  if (process.env.NODE_ENV === 'production') return;

  const cwd = process.cwd();
  const envPath = path.join(cwd, '.env');
  const envLocalPath = path.join(cwd, '.env.local');
  if (!fs.existsSync(envPath) || !fs.existsSync(envLocalPath)) {
    return;
  }

  const envKey = readStripeKeyFromEnvFile(envPath);
  const envLocalKey = readStripeKeyFromEnvFile(envLocalPath);
  if (!envKey || !envLocalKey || envKey === envLocalKey) return;

  hasPrintedEnvConflictWarning = true;
  console.warn(
    '[stripe config warning] .env and .env.local have different STRIPE_SECRET_KEY values. Local development should use .env.local only.',
  );
}

export class StripeConfigError extends Error {
  readonly code: string;
  readonly guidance: string;

  constructor(message: string, guidance: string) {
    super(message);
    this.code = STRIPE_CONFIG_ERROR_CODE;
    this.guidance = guidance;
  }
}

export function getStripeConfigState(): StripeConfigState {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
  return {
    secretKeyMasked: secretKey ? maskSecretKey(secretKey) : 'not-set',
    secretKeyMode: secretKey ? detectStripeModeFromSecretKey(secretKey) : 'unknown',
    environment: inferAppEnvironment(),
  };
}

export function assertStripeConfig(input: AssertStripeConfigInput = {}): StripeConfigState {
  warnOnConflictingLocalStripeEnvOnce();

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
  if (!secretKey) {
    throw new StripeConfigError(
      'STRIPE_SECRET_KEY is not configured.',
      'Set STRIPE_SECRET_KEY in environment variables and redeploy.',
    );
  }

  const mode = detectStripeModeFromSecretKey(secretKey);
  if (mode === 'unknown') {
    throw new StripeConfigError(
      'STRIPE_SECRET_KEY has an unsupported format.',
      'Use a Stripe secret key starting with sk_test_ or sk_live_.',
    );
  }

  const env = inferAppEnvironment();
  const allowLiveInDev =
    input.allowLiveInDev || process.env.ALLOW_LIVE_STRIPE_IN_DEV === 'true';
  const allowTestInProd = process.env.ALLOW_TEST_STRIPE_IN_PRODUCTION === 'true';

  if (mode === 'live' && env !== 'production' && !allowLiveInDev) {
    throw new StripeConfigError(
      `Live Stripe keys are blocked in ${env} environment.`,
      'Use a test key or set ALLOW_LIVE_STRIPE_IN_DEV=true only for controlled checks.',
    );
  }

  if (mode === 'test' && env === 'production' && !allowTestInProd) {
    throw new StripeConfigError(
      'Test Stripe keys are blocked in production.',
      'Use sk_live_ key in production, or set ALLOW_TEST_STRIPE_IN_PRODUCTION=true for emergency diagnostics only.',
    );
  }

  if (input.expectedMode && input.expectedMode !== mode) {
    throw new StripeConfigError(
      `Stripe key mode mismatch: expected ${input.expectedMode}, got ${mode}.`,
      'Check STRIPE_SECRET_KEY and Stripe webhook mode, then redeploy.',
    );
  }

  return {
    secretKeyMasked: maskSecretKey(secretKey),
    secretKeyMode: mode,
    environment: env,
  };
}

function isPermissionMismatchMessage(message: string) {
  return (
    /provided key does not have access to account/i.test(message) ||
    /does not have access/i.test(message) ||
    /application access may have been revoked/i.test(message)
  );
}

export function normalizeStripeConfigError(error: unknown): StripeConfigError {
  if (error instanceof StripeConfigError) {
    return error;
  }

  const stripeError = error as {
    message?: string;
    type?: string;
    rawType?: string;
  } | null;
  const message = stripeError?.message ?? 'Stripe request failed.';

  if (
    stripeError?.type === 'StripePermissionError' ||
    stripeError?.rawType === 'permission_error' ||
    isPermissionMismatchMessage(message)
  ) {
    return new StripeConfigError(
      'Stripe account access failed.',
      'Check Stripe secret key + Connect account, re-authorize Connect if needed.',
    );
  }

  return new StripeConfigError(
    message,
    'Check Stripe secret key + Connect account, re-authorize Connect if needed.',
  );
}

export function createStripeRequestVerifier(stripe: Stripe): StripeRequestVerifier {
  const cache = new Map<string, Promise<Stripe.Account>>();

  const getOrSet = (cacheKey: string, loader: () => Promise<Stripe.Account>) => {
    const existing = cache.get(cacheKey);
    if (existing) return existing;
    const created = loader();
    cache.set(cacheKey, created);
    return created;
  };

  return {
    getPlatformAccount() {
      return getOrSet('platform', async () => {
        try {
          return (await stripe.accounts.retrieve()) as Stripe.Account;
        } catch (error) {
          throw normalizeStripeConfigError(error);
        }
      });
    },
    verifyConnectedAccountAccess(connectedAccountId: string) {
      const normalizedAccountId = connectedAccountId.trim();
      return getOrSet(`acct:${normalizedAccountId}`, async () => {
        try {
          return (await stripe.accounts.retrieve(normalizedAccountId)) as Stripe.Account;
        } catch (error) {
          throw normalizeStripeConfigError(error);
        }
      });
    },
  };
}
