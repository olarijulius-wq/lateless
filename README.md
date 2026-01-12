# Invoicify

Invoicify is a multi-tenant invoicing dashboard built with Next.js 15 (App Router) and TypeScript. The UI is styled with Tailwind CSS and uses @heroicons for icons. Application data is stored in Postgres and accessed through postgres.js. Authentication is implemented using NextAuth with a Credentials provider (bcrypt password hashing). The application supports a Free vs Pro model with Stripe subscriptions, Pro-only CSV exports, and tenant isolation so each user sees only their own customers and invoices.

## What the app does

The app has a simple landing page (app/page.tsx) with an “Invoicify” hero and a login link. Authentication flows are implemented as App Router routes: app/login (login view) and app/signup (signup view). Login uses a server action (authenticate) and signup uses a server action (registerUser). Once authenticated, users can access the protected area under /dashboard. Route protection is handled through NextAuth authorization logic and middleware/matcher setup (middleware.ts and/or proxy helper), ensuring that dashboard pages are not accessible without a valid session.

Inside /dashboard the application contains:
- Overview dashboard: statistics cards, “Latest Invoices”, and a “Recent Revenue” chart.
- Customers: list view with debounced search (URL query params), customer creation form, customer deletion, and CSV export (Pro only).
- Invoices: list view with debounced search and pagination, invoice create/edit, invoice delete, and CSV export (Pro only). The Free plan has a limit of 5 invoices; Pro is unlimited. The invoice limit is enforced server-side.
- Settings: plan information and usage, Stripe upgrade flow, and Stripe billing portal access.

## Multi-tenant behavior (tenant isolation)

Invoicify is multi-tenant. The current tenant key is the user’s email (user_email) stored on domain tables, and all tenant checks use a normalized email value (trim + lowercase). Normalization is applied consistently during authentication as well as in all database reads/writes. All server-side queries are filtered by the tenant key to ensure users can only read and modify their own records. Update and delete queries include tenant filters (“surgical filtering”) to prevent IDOR-style access (for example, update/delete operations are not performed solely by record id; tenant conditions are also applied). Session handling guarantees user.email, and the session has also been extended to include user.id via JWT + session callbacks to support future migration from email-based tenancy to user_id-based tenancy.

## Plan logic (Free vs Pro)

The application supports Free and Pro plans. Pro status is stored in the users table and read from the database wherever needed (it is not cached in the session token as the source of truth). Pro-only features include CSV export endpoints and unlimited invoices.

The Free plan invoice limit (5 invoices) is enforced on the server in the createInvoice server action. This prevents bypassing UI constraints by calling server actions or endpoints directly. The createInvoice server action returns structured results, including error codes for LIMIT_REACHED and VALIDATION. The invoice create form UI consumes this structured response: if the free limit is reached it shows an Upgrade CTA (call-to-action) that directs the user to upgrade; if validation fails it shows field-level errors in red text; other errors appear as a general message.

## CSV exports

CSV export endpoints exist under app/api:
- /api/invoices/export
- /api/customers/export

Both endpoints check for a valid session and verify Pro status. If permitted, they return a CSV payload (text/csv) with Content-Disposition headers so the browser downloads a file. If the user is not Pro (or not authenticated), the request is blocked.

## Stripe integration

Stripe is used for subscription management. The project includes:
- /api/stripe/checkout: creates a Stripe subscription checkout session.
- /api/stripe/portal: creates a billing portal session; creates a Stripe customer if needed.
- /api/stripe/webhook: receives Stripe events and updates the users table with billing state (is_pro, customer id, subscription id, status, cancel_at_period_end, current_period_end).

Checkout requests include metadata containing userId and normalized email. The webhook handler prefers userId for identifying the correct user record when updating subscription state. This reduces the risk of mismatches that can occur when relying only on email.

## Code layout

The main application is under app/ (App Router). The lib layer (app/lib) includes data access and server actions:
- app/lib/data.ts: database queries for invoices, customers, stats, and plan/usage checks.
- app/lib/actions.ts: server actions for create/update/delete invoices, create/delete customers, user registration, and authentication. This includes server-side invoice limit enforcement and structured responses for UI handling.
- app/lib/stripe.ts: Stripe client setup and helpers.
- app/lib/definitions.ts: shared types.

Reusable UI components live under app/ui (tables, forms, navigation, dashboard cards, etc.). Authentication configuration and callbacks are in auth-related files (auth.ts, auth.config.ts). Middleware (middleware.ts and/or proxy helper) protects dashboard routes.

The project also includes course-origin seed/example endpoints (route.ts files). A seed endpoint can create initial tables and insert placeholder data; example/learning endpoints may be present and can be disabled for production.

## Data model (expected / reflected in code)

users table includes id, name, email, password (hashed), plus Pro/billing fields such as is_pro, stripe_customer_id, stripe_subscription_id, subscription_status, cancel_at_period_end, current_period_end. The customers table includes at least id, name, email, and user_email (tenant key). The invoices table includes id, customer_id, amount, status, date, and user_email (tenant key).

## Configuration requirements (env vars)

The application expects environment variables for Postgres, NextAuth, and Stripe. Typical variables include:
- POSTGRES_URL (with SSL require depending on provider)
- NEXTAUTH_SECRET (and possibly NEXTAUTH_URL)
- STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET
- NEXT_PUBLIC_APP_URL (or a proper deployed domain) for Stripe redirects

## Current status and improvements already implemented

The project is functioning end-to-end. Recent hardening and UX improvements include: server-side enforcement of the Free plan invoice limit, consistent email normalization throughout authentication and DB operations, tenant filters applied across server queries (including update/delete) to prevent cross-tenant access, session augmentation to include user.id for future-proofing, Stripe metadata containing userId (preferred by webhook), and a user-visible, structured UX on invoice creation where limit errors show an Upgrade CTA and validation errors display at field level.

## Future roadmap (optional)

Possible next steps include: adding DB-level indexes and constraints for tenant columns and normalized emails (via migrations), and migrating tenant association from user_email to user_id across domain tables to support future email-change functionality and stronger referential integrity.