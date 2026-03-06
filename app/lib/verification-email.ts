import crypto from 'crypto';
import { sendEmailVerification } from '@/app/lib/email';
import { sql } from '@/app/lib/db';
import {
  sanitizeLifecycleEmailError,
  upsertLifecycleEmailLog,
} from '@/app/lib/lifecycle-email-log';

export const __testHooks: {
  sendEmailVerificationOverride: null | typeof sendEmailVerification;
} = {
  sendEmailVerificationOverride: null,
};

function getBaseAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000')
  );
}

export async function issueAndSendVerificationEmail(input: {
  userId: string;
  email: string;
}) {
  const token = crypto.randomUUID();

  await sql`
    update users
    set verification_token = ${token},
        verification_sent_at = now()
    where id = ${input.userId}
  `;

  const verifyUrl = `${getBaseAppUrl()}/verify/${token}`;
  const idempotencyKey = `verification:${token}`;
  const sendEmail =
    __testHooks.sendEmailVerificationOverride ?? sendEmailVerification;

  try {
    await sendEmail({ to: input.email, verifyUrl });
    await upsertLifecycleEmailLog({
      userId: input.userId,
      emailType: 'verification',
      idempotencyKey,
      status: 'sent',
      errorMessage: null,
    });
  } catch (error) {
    await upsertLifecycleEmailLog({
      userId: input.userId,
      emailType: 'verification',
      idempotencyKey,
      status: 'failed',
      errorMessage: sanitizeLifecycleEmailError(
        error,
        'Unknown verification email failure',
      ),
    });
    throw error;
  }

  return { token };
}
