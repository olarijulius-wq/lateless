import { sql } from '@/app/lib/db';
import { sendPasswordResetEmail } from '@/app/lib/email';
import { issueTokenAndSendLifecycleEmail } from '@/app/lib/lifecycle-email';

export const __testHooks: {
  sendPasswordResetEmailOverride: null | typeof sendPasswordResetEmail;
} = {
  sendPasswordResetEmailOverride: null,
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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

  const sendEmail =
    __testHooks.sendPasswordResetEmailOverride ?? sendPasswordResetEmail;

  await issueTokenAndSendLifecycleEmail({
    userId: user.id,
    email: normalizedEmail,
    emailType: 'password_reset',
    tokenColumn: 'password_reset_token',
    sentAtColumn: 'password_reset_sent_at',
    pathPrefix: '/reset-password/',
    send: ({ to, url }) => sendEmail({ to, resetUrl: url }),
    failureMessage: 'Unknown password reset email failure',
  });

  return { userFound: true };
}
