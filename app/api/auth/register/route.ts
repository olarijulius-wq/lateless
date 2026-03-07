import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceRateLimit } from '@/app/lib/security/api-guard';
import {
  createUserFromSignup,
  signupSchema,
  type SignupErrorPayload,
} from '@/app/lib/signup';

export const runtime = 'nodejs';

export const __testHooks: {
  enforceRateLimitOverride: null | typeof enforceRateLimit;
} = {
  enforceRateLimitOverride: null,
};

const signupRequestSchema = signupSchema.extend({
  callbackUrl: z.string().optional(),
});

export async function POST(request: Request) {
  const rateLimitResponse = await (__testHooks.enforceRateLimitOverride ?? enforceRateLimit)(
    request,
    {
      bucket: 'auth_signup',
      windowSec: 300,
      ipLimit: 20,
    },
    {
      failClosed: true,
    },
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json<SignupErrorPayload>(
      {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid signup request.',
      },
      { status: 400 },
    );
  }

  const parsed = signupRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<SignupErrorPayload>(
      {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'Please correct the highlighted fields and try again.',
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const result = await createUserFromSignup(parsed.data);
  return NextResponse.json(result.body, { status: result.status });
}
