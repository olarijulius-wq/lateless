export function isSettingsRemindersAdminEmail(email: string | null | undefined): boolean {
  const normalized = (email ?? '').trim().toLowerCase();
  return normalized === 'olarijulius@gmail.com';
}
