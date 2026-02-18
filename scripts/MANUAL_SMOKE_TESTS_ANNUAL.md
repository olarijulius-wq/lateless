# Manual Smoke Tests: Annual Billing

## Prereqs
- Stripe test mode is enabled.
- Annual env vars are set:
  - `STRIPE_PRICE_SOLO_ANNUAL`
  - `STRIPE_PRICE_PRO_ANNUAL`
  - `STRIPE_PRICE_STUDIO_ANNUAL`

## 1) Annual checkout (Pro / Studio)
1. Open `/?interval=annual#pricing`.
2. Click `Start with Pro` (repeat for Studio).
3. Complete auth if needed and continue to billing.
4. Click `Choose Pro` (or Studio) and verify Checkout uses annual test price.
5. Complete test payment.

Expected:
- Stripe Checkout line item uses the annual Price ID for the selected plan.
- Success returns to `/dashboard/settings?success=1`.

## 2) Stripe portal renewal cadence
1. From Billing Settings, open `Manage billing / Cancel`.
2. In Stripe customer portal, inspect the active subscription.

Expected:
- Subscription is annual.
- Renewal date is approximately 1 year from start date.

## 3) Webhook sync behavior
1. Trigger checkout completion for annual plan.
2. Confirm webhook events are processed (`checkout.session.completed`, `customer.subscription.updated`).
3. Verify user row updates as before (`plan`, `subscription_status`, `stripe_subscription_id`, period fields).

Expected:
- Plan entitlements map correctly for annual and monthly prices.
- Monthly subscriptions still continue to map to the same plan as before.
