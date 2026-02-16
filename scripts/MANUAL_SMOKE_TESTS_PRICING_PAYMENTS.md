# Pricing + Payments Manual Smoke Tests

## 1) Not connected: pay link blocked
1. Use an invoice owned by a user with no `stripe_connect_account_id`.
2. Open `/pay/<token>` and verify the page shows: `Payments aren't enabled for this merchant yet.` and does not show a pay button.
3. Run `POST /api/public/invoices/<token>/pay` and verify HTTP `409` with JSON code `CONNECT_REQUIRED`.

## 2) Connected: checkout uses application fee and payer total includes uplift
1. Enable processing uplift in Pricing & Fees settings.
2. Use an invoice owned by a connected account and start payment (`POST /api/invoices/<id>/pay` or public endpoint).
3. Verify DB row has `processing_uplift_amount`, `payable_amount`, `platform_fee_amount` populated before redirect.
4. Verify Stripe Checkout/PaymentIntent amount equals `payable_amount`.
5. Verify `application_fee_amount` equals `platform_fee_amount` for the connected-account direct charge.

## 3) Paid invoice detail: estimated + actual values
1. Complete payment for a connected-account invoice.
2. Open `/dashboard/invoices/<id>`.
3. Verify fee preview shows `Estimated range: X - Y`.
4. Verify paid invoice shows `Actual Stripe net (after processing)` and `Actual merchant take-home (after platform fee)`.
