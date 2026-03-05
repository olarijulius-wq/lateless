import { NextRequest, NextResponse } from 'next/server';
import { requireUserEmail } from '@/app/lib/data';
import { enforceRateLimit } from '@/app/lib/security/api-guard';
import { requestPasswordResetByEmail } from '@/app/lib/password-reset';

export const runtime = 'nodejs';

export const __testHooks: {
  requireUserEmailOverride: null | (() => Promise<string>);
  enforceRateLimitOverride: null | typeof enforceRateLimit;
  requestPasswordResetByEmailOverride:
    | null
    | typeof requestPasswordResetByEmail;
} = {
  requireUserEmailOverride: null,
  enforceRateLimitOverride: null,
  requestPasswordResetByEmailOverride: null,
};

export async function POST(request: NextRequest) {
  let userEmail = '';

  try {
    const resolveUserEmail = __testHooks.requireUserEmailOverride ?? requireUserEmail;
    userEmail = await resolveUserEmail();
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Unauthorized.' },
      { status: 401 },
    );
  }

  try {
    const applyRateLimit = __testHooks.enforceRateLimitOverride ?? enforceRateLimit;
    const rl = await applyRateLimit(
      request,
      {
        bucket: 'account_password_reset',
        windowSec: 300,
        ipLimit: 20,
        userLimit: 5,
      },
      { userKey: userEmail },
    );
    if (rl) return rl;

    const sendReset = __testHooks.requestPasswordResetByEmailOverride ?? requestPasswordResetByEmail;
    const result = await sendReset(userEmail);
    if (!result.userFound) {
      return NextResponse.json(
        { ok: false, message: 'Account not found for this session.', code: 'ACCOUNT_NOT_FOUND' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Authenticated password reset request failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to send reset email.' },
      { status: 500 },
    );
  }
}
