import crypto from 'crypto';
import { sql } from '@/app/lib/db';
import { getEmailBaseUrl } from '@/app/lib/app-url';
import {
  sanitizeLifecycleEmailError,
  type LifecycleEmailType,
  upsertLifecycleEmailLog,
} from '@/app/lib/lifecycle-email-log';

type UserTokenColumn = 'verification_token' | 'password_reset_token';
type UserSentAtColumn = 'verification_sent_at' | 'password_reset_sent_at';

export async function issueTokenAndSendLifecycleEmail(input: {
  userId: string;
  email: string;
  emailType: LifecycleEmailType;
  tokenColumn: UserTokenColumn;
  sentAtColumn: UserSentAtColumn;
  pathPrefix: '/verify/' | '/reset-password/';
  send: (args: { to: string; url: string }) => Promise<void>;
  failureMessage: string;
}) {
  const token = crypto.randomUUID();
  const idempotencyKey = `${input.emailType}:${token}`;

  await sql.unsafe(
    `
      update public.users
      set ${input.tokenColumn} = $1,
          ${input.sentAtColumn} = now()
      where id = $2
    `,
    [token, input.userId],
  );

  const url = `${getEmailBaseUrl()}${input.pathPrefix}${token}`;

  try {
    await input.send({ to: input.email, url });
    await upsertLifecycleEmailLog({
      userId: input.userId,
      emailType: input.emailType,
      idempotencyKey,
      status: 'sent',
      errorMessage: null,
    });
    console.info(
      `[email][delivery] type=${input.emailType} status=sent user_id=${input.userId}`,
    );
  } catch (error) {
    const sanitizedError = sanitizeLifecycleEmailError(error, input.failureMessage);
    await upsertLifecycleEmailLog({
      userId: input.userId,
      emailType: input.emailType,
      idempotencyKey,
      status: 'failed',
      errorMessage: sanitizedError,
    });
    console.error(
      `[email][delivery] type=${input.emailType} status=failed user_id=${input.userId} error=${sanitizedError}`,
    );
    throw error;
  }

  return { token };
}

