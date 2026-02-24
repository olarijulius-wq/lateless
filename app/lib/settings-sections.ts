import 'server-only';

import { existsSync } from 'node:fs';
import path from 'node:path';

export type SettingsSection = {
  name: string;
  href: string;
};

type BuildSettingsSectionsInput = {
  isInternalAdmin: boolean;
  canViewBillingEvents: boolean;
  canViewLaunchCheck: boolean;
  canViewSmokeCheck: boolean;
  canViewAllChecks: boolean;
  canViewFunnel: boolean;
  diagnosticsEnabled: boolean;
};

function pageExists(relativeDir: string) {
  return existsSync(path.join(process.cwd(), 'app', 'dashboard', 'settings', relativeDir, 'page.tsx'));
}

export function buildSettingsSections(input: BuildSettingsSectionsInput): SettingsSection[] {
  const sections: SettingsSection[] = [
    { name: 'Usage', href: '/dashboard/settings/usage' },
    { name: 'Billing', href: '/dashboard/settings/billing' },
  ];

  if (pageExists('pricing-fees')) {
    sections.push({ name: 'Pricing & fees', href: '/dashboard/settings/pricing-fees' });
  }
  if (pageExists('payouts')) {
    sections.push({ name: 'Payouts', href: '/dashboard/settings/payouts' });
  }
  if (pageExists('refunds')) {
    sections.push({ name: 'Refunds', href: '/dashboard/settings/refunds' });
  }

  sections.push(
    { name: 'Team', href: '/dashboard/settings/team' },
    { name: 'Company profile', href: '/dashboard/settings/company-profile' },
    { name: 'Email setup', href: '/dashboard/settings/smtp' },
    { name: 'Unsubscribe', href: '/dashboard/settings/unsubscribe' },
    { name: 'Documents', href: '/dashboard/settings/documents' },
  );

  if (!input.isInternalAdmin) {
    return sections;
  }

  if (input.canViewBillingEvents && pageExists('billing-events')) {
    sections.push({ name: 'Billing events', href: '/dashboard/settings/billing-events' });
  }
  if (input.canViewLaunchCheck && pageExists('launch-check')) {
    sections.push({ name: 'Launch readiness', href: '/dashboard/settings/launch-check' });
  }
  if (
    input.diagnosticsEnabled &&
    input.canViewAllChecks &&
    pageExists('all-checks')
  ) {
    sections.push({ name: 'All checks', href: '/dashboard/settings/all-checks' });
  }
  if (
    input.diagnosticsEnabled &&
    input.canViewSmokeCheck &&
    pageExists('smoke-check')
  ) {
    sections.push({ name: 'Smoke check', href: '/dashboard/settings/smoke-check' });
  }
  if (
    input.diagnosticsEnabled &&
    input.canViewSmokeCheck &&
    pageExists('migrations')
  ) {
    sections.push({ name: 'Migrations', href: '/dashboard/settings/migrations' });
  }
  if (input.canViewFunnel && pageExists('funnel')) {
    sections.push({ name: 'Funnel', href: '/dashboard/settings/funnel' });
  }

  return sections;
}
