import crypto from 'crypto';
import { sendEmailVerification } from '@/app/lib/email';
import { sql } from '@/app/lib/db';

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

function sanitizeErrorForLog(error: unknown): string {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown verification email failure';
  const scrubbed = rawMessage.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]');
  return scrubbed.length <= 500 ? scrubbed : `${scrubbed.slice(0, 500)}…`;
}

async function upsertVerificationLifecycleLog(input: {
  userId: string;
  idempotencyKey: string;
  status: 'sent' | 'failed';
  errorMessage: string | null;
}) {
  await sql`
    insert into public.lifecycle_email_logs (
      user_id,
      email_type,
      idempotency_key,
      status,
      sent_at,
      error_message,
      last_attempt_at
    )
    values (
      ${input.userId},
      'verification',
      ${input.idempotencyKey},
      ${input.status},
      case when ${input.status} = 'sent' then now() else null end,
      ${input.errorMessage},
      now()
    )
    on conflict (user_id, email_type, idempotency_key)
    do update
      set
        status = excluded.status,
        sent_at = excluded.sent_at,
        error_message = excluded.error_message,
        last_attempt_at = excluded.last_attempt_at
  `;
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
    await upsertVerificationLifecycleLog({
      userId: input.userId,
      idempotencyKey,
      status: 'sent',
      errorMessage: null,
    });
  } catch (error) {
    await upsertVerificationLifecycleLog({
      userId: input.userId,
      idempotencyKey,
      status: 'failed',
      errorMessage: sanitizeErrorForLog(error),
    });
    throw error;
  }

  return { token };
}
