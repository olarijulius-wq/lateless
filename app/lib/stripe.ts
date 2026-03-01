// app/lib/stripe.ts
import 'server-only';
import Stripe from 'stripe';

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeSingleton) {
    return stripeSingleton;
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const isTestMode =
    process.env.LATELLESS_TEST_MODE === '1' || process.env.NODE_ENV === 'test';

  if (!stripeSecretKey) {
    if (isTestMode) {
      stripeSingleton = new Stripe('sk_test_dummy');
      return stripeSingleton;
    }
    throw new Error('Missing STRIPE_SECRET_KEY');
  }

  stripeSingleton = new Stripe(stripeSecretKey);
  return stripeSingleton;
}
