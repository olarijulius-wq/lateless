import crypto from 'crypto';
import { sql } from '@/app/lib/db';
import { sendPasswordResetEmail } from '@/app/lib/email';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getBaseAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000')
  );
}

export async function requestPasswordResetByEmail(email: string): Promise<{
  userFound: boolean;
}> {
  const normalizedEmail = normalizeEmail(email);
  const [user] = await sql<{ id: string }[]>`
    select id
    from users
    where lower(email) = ${normalizedEmail}
    limit 1
  `;

  if (!user?.id) {
    return { userFound: false };
  }

  const token = crypto.randomUUID();
  await sql`
    update users
    set password_reset_token = ${token},
        password_reset_sent_at = now()
    where id = ${user.id}
  `;

  const resetUrl = `${getBaseAppUrl()}/reset-password/${token}`;
  await sendPasswordResetEmail({ to: normalizedEmail, resetUrl });
  return { userFound: true };
}
