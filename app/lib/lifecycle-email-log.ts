import 'server-only';

import { sql } from '@/app/lib/db';

export type LifecycleEmailType = 'verification' | 'password_reset';
export type LifecycleEmailStatus = 'sent' | 'failed';

export function sanitizeLifecycleEmailError(
  error: unknown,
  fallbackMessage: string,
): string {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : fallbackMessage;
  const scrubbed = rawMessage
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/(api[_-]?key|token|secret|password)=\S+/gi, '$1=[redacted]');
  return scrubbed.length <= 500 ? scrubbed : `${scrubbed.slice(0, 500)}…`;
}

export async function upsertLifecycleEmailLog(input: {
  userId: string;
  emailType: LifecycleEmailType;
  idempotencyKey: string;
  status: LifecycleEmailStatus;
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
      ${input.emailType},
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

  console.info(
    `[email][lifecycle] type=${input.emailType} status=${input.status} user_id=${input.userId}`,
  );
}
