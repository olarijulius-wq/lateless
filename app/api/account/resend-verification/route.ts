import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@/app/lib/db';
import { issueAndSendVerificationEmail } from '@/app/lib/verification-email';
import { enforceRateLimit, parseJsonBody } from '@/app/lib/security/api-guard';

export const runtime = 'nodejs';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

const resendVerificationSchema = z
  .object({
    email: z.string().email().max(254).trim(),
  })
  .strict();

export async function POST(request: Request) {
  const rateLimitResponse = await enforceRateLimit(
    request,
    {
      bucket: 'resend_verification',
      windowSec: 60,
      ipLimit: 5,
    },
    {
      failClosed: true,
    },
  );
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

    await issueAndSendVerificationEmail({
      userId: user.id,
      email: normalizedEmail,
    });
  } catch (error) {
    console.error('Resend verification failed:', error);
  }

  return NextResponse.json({ ok: true });
}
