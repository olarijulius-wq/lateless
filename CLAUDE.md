# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server (Next.js + Turbopack)
pnpm build        # Production build
pnpm lint         # ESLint
pnpm test         # Integration tests (requires POSTGRES_URL_TEST env var)
pnpm db:migrate   # Apply SQL migrations
DRY_RUN=1 pnpm db:migrate  # Dry-run migrations
```

Tests use **jiti** to run TypeScript directly without compilation. Set `POSTGRES_URL_TEST` to a dedicated test database before running `pnpm test`. The test runner automatically maps it to `POSTGRES_URL`, runs migrations, and executes `tests/isolation.test.ts`. There is no per-test filter flag; comment out test blocks in the file to run a subset.

## Non-negotiable invariants

Violations of these rules introduce security bugs or production breakage. Do not deviate:

1. **Workspace tenant isolation.** All invoice/customer reads MUST scope by `workspace_id` when the column exists and has a value. `user_email` is a legacy fallback only — never use it as the sole tenant filter in production code paths. See `getInvoicesWorkspaceFilter` / `getCustomersWorkspaceFilter` in `app/lib/data.ts` for the approved pattern.

2. **Public endpoints fail closed.** Public routes (`/api/public/**`, `/pay/**`) MUST resolve branding and billing via `invoice.workspace_id`. When `workspace_id` is null or missing, return 404 — never fall back to `user_email` in production. `app/lib/public-branding.ts` enforces this; do not weaken it.

3. **Stripe billing is workspace-scoped.** All billing reads/writes go through `workspace_billing` (via `app/lib/workspace-billing.ts`). `users.*` billing columns are a read-only mirror — drift logging is allowed but `users.*` must not be the source of truth in any production code path. The `ALLOW_DEV_TEST_FALLBACK` guard in `workspace-billing.ts` is intentional and must not be removed.

4. **No UI regressions on clickable rows.** Action buttons (`Send`, `Pay`, `Approve`, etc.) inside clickable table/card rows MUST have `data-row-nav-stop` + `stopPropagation()` + `pointer-events-auto`. Never nest an interactive element inside a parent anchor/button in a way that makes it unreachable or hijacks the click.

5. **No hardcoded internal admin emails.** Use `INTERNAL_ADMIN_EMAILS` env var with `isInternalAdmin()` from `app/lib/internal-admin-email.ts`. The hardcoded `user@nextmail.com` in `app/lib/feedback.ts` and `app/ui/dashboard/nav-links-data.ts` is tracked debt — do not add more instances.

## Before you commit

Run these in order — all must pass before opening a PR:

```bash
pnpm lint           # Zero errors required
pnpm build          # Must compile cleanly
pnpm test           # Run if POSTGRES_URL_TEST is set; skip gracefully otherwise
```

- Review every new or changed migration for irreversibility (DROP, ALTER, backfill without rollback path).
- Verify CI is green before merging to `main`.

## When making changes

**Typical workflow:**
```
git checkout -b <branch>
# make changes
pnpm lint && pnpm build
git commit -m "concise present-tense message"
git push -u origin <branch>
# open PR → squash merge to main
```

**Merge conflicts:** Accept both sides only when the changes are genuinely independent (e.g. two separate exports added to the same file). For overlapping logic, understand both sides before deciding — never blindly accept either.

**Schema changes:**
1. Add a numbered migration: `migrations/NNN_description.sql` (increment from the highest existing number).
2. Dry-run before applying: `DRY_RUN=1 pnpm db:migrate`.
3. Before deploying code that reads `workspace_billing`, `workspace_id` on invoices/customers, or new FKs, confirm those columns/tables exist in production (`\d public.workspace_billing` in psql).
4. Backfill scripts must be idempotent: use `WHERE column IS NULL`, `ON CONFLICT … DO NOTHING`, etc.

## Architecture

**Lateless** is a multi-tenant invoicing SaaS (Next.js 15, TypeScript, PostgreSQL). Users create workspaces, invite team members, create customers and invoices, and collect payment via Stripe Checkout links. Overdue reminders run on a Vercel Cron schedule.

### Key directories

- `app/lib/` — All business logic. The most important:
  - `db.ts` — Singleton `postgres` client (`prepare: false` for PgBouncer compatibility)
  - `data.ts` — All data-fetching queries; workspace-scoped by default via `requireInvoiceCustomerScope`
  - `actions.ts` — Server actions wiring forms to mutations
  - `definitions.ts` — Shared TypeScript types
  - `config.ts` — Plan limits (Free / Solo / Pro / Studio)
  - `email.ts` — Sends via Resend or SMTP (controlled by `EMAIL_PROVIDER`)
  - `stripe-*.ts` — Stripe Checkout, webhooks, Connect, dunning
  - `reminder-*.ts` — Cron-triggered reminder logic
  - `usage.ts` — Monthly invoice cap enforcement
  - `workspaces.ts` — Multi-workspace / team membership helpers
  - `workspace-billing.ts` — Canonical billing source; reads/writes `workspace_billing` table
  - `workspace-context.ts` — Resolves current user's active workspace from session
  - `public-branding.ts` — Company profile for public invoice pages (fail-closed in production)
- `app/(auth)/` — Login, signup, verify routes (public)
- `app/dashboard/` — All protected pages (invoices, customers, settings, etc.)
- `app/api/` — API routes: Stripe webhooks, reminder cron, settings helpers
- `app/api/public/` — Unauthenticated public routes (pay, PDF, refund request)
- `migrations/` — 46 sequential SQL files managed by `scripts/migrate.mjs`
- `tests/` — Integration test suite (`isolation.test.ts`)

### Data model

All data is scoped to a **workspace**. Users belong to one or more workspaces via `workspace_members`. Core tables: `users`, `workspaces`, `workspace_members`, `customers`, `invoices`, `invoice_email_logs`. Plan usage tracked in `usage_events`. Stripe subscription state lives in `workspace_billing` (canonical), `dunning_state`, and `billing_events`. Webhook idempotency enforced via `stripe_webhook_events`. `company_profiles` has a `workspace_id` FK since migration 013.

### Rendering patterns

- Data pages use **React Server Components** with direct DB calls (no separate API layer).
- Mutations use **`'use server'` actions** (not REST endpoints).
- After mutations, prefer revalidating narrow paths with `revalidatePath`; avoid broad dashboard-wide invalidations.
- Force-dynamic rendering only for pages that must reflect real-time payment state (invoice detail, PDF).

### Auth

NextAuth 5 (beta) with a Credentials provider. Session validation happens in `auth.ts`; route protection in `middleware.ts`. Login attempts are rate-limited (15-minute window). CSRF protection validates `Origin`/`Referer` headers for all mutating requests.

### Email

Controlled by `EMAIL_PROVIDER=resend|smtp`. Reminder emails can use a separate sender via `REMINDER_FROM_EMAIL`. Throttle behaviour during cron runs is controlled by `EMAIL_BATCH_SIZE`, `EMAIL_THROTTLE_MS`, and `EMAIL_MAX_RUN_MS`.

### Diagnostics & smoke checks

- `/dashboard/settings/smoke-check` — Run a manual smoke check as owner/admin.
- `/dashboard/settings/all-checks` — Full pre-launch checklist.
- `DIAGNOSTICS_ENABLED` env var: defaults ON in development, OFF in production. Enable temporarily for diagnostics runs.

### Testing reminder cron locally

```bash
curl -i -H "Authorization: Bearer $REMINDER_CRON_TOKEN" \
  "http://localhost:3000/api/reminders/run?triggeredBy=cron"
```
