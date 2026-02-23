import 'server-only';

const INTERNAL_ADMIN_EMAIL = 'olarijulius@gmail.com';

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function isInternalAdminEmail(email: string | null | undefined): boolean {
  return normalizeEmail(email) === INTERNAL_ADMIN_EMAIL;
}
