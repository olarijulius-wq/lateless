import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/app/lib/db';
import { sendEmailVerification } from '@/app/lib/email';
import { enforceRateLimit, parseJsonBody } from '@/app/lib/security/api-guard';

export const runtime = 'nodejs';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function resolveBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000')
  );
}

const resendVerificationSchema = z
  .object({
    email: z.string().email().max(254).trim(),
  })
  .strict();

export async function POST(request: Request) {
  const rateLimitResponse = await enforceRateLimit(request, {
    bucket: 'resend_verification',
    windowSec: 60,
    ipLimit: 5,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const parsedBody = await parseJsonBody(request, resendVerificationSchema);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const normalizedEmail = normalizeEmail(parsedBody.data.email);
    const [user] = await sql<{
      id: string;
      email: string;
      is_verified: boolean;
    }[]>`
      select id, email, is_verified
      from users
      where lower(email) = ${normalizedEmail}
      limit 1
    `;

    if (!user || user.is_verified) {
      return NextResponse.json({ ok: true });
    }

    const token = crypto.randomUUID();
    await sql`
      update users
      set verification_token = ${token},
          verification_sent_at = now()
      where id = ${user.id}
    `;

    const baseUrl = resolveBaseUrl();
    const verifyUrl = `${baseUrl}/verify/${token}`;

    await sendEmailVerification({
      to: normalizedEmail,
      verifyUrl,
    });
  } catch (error) {
    console.error('Resend verification failed:', error);
  }

  return NextResponse.json({ ok: true });
}
