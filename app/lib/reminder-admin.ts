import { isInternalAdmin } from '@/app/lib/internal-admin-email';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseAdminEmails(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
}

export function isReminderManualRunAdmin(userEmail?: string | null) {
  const normalized = normalizeEmail(userEmail ?? '');
  if (!normalized) {
    return false;
  }

  const configuredAdmins = parseAdminEmails(
    process.env.REMINDER_MANUAL_ADMIN_EMAILS ??
      process.env.REMINDER_MANUAL_ADMIN_EMAIL,
  );

  if (configuredAdmins.length > 0) {
    return configuredAdmins.includes(normalized);
  }

  return isInternalAdmin(normalized);
}
