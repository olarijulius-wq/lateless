import bcrypt from 'bcrypt';
import { z } from 'zod';
import { sql } from '@/app/lib/db';
import { issueAndSendVerificationEmail } from '@/app/lib/verification-email';
import { logFunnelEvent } from '@/app/lib/funnel-events';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function nameFromEmail(email: string) {
  const normalized = normalizeEmail(email);
  const [localPart] = normalized.split('@');
  return localPart?.trim() || normalized || 'User';
}

export const signupSchema = z.object({
  name: z.string().trim().optional(),
  email: z.string().trim().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  termsAccepted: z.literal(true, {
    errorMap: () => ({
      message: 'You must agree to the Terms and acknowledge the Privacy Policy.',
    }),
  }),
});

export type SignupErrorCode =
  | 'VALIDATION_ERROR'
  | 'EMAIL_ALREADY_EXISTS'
  | 'VERIFICATION_EMAIL_FAILED'
  | 'SIGNUP_FAILED';

export type SignupSuccessPayload = {
  ok: true;
  code: 'SIGNUP_CREATED';
  message: string;
  email: string;
};

export type SignupErrorPayload = {
  ok: false;
  code: SignupErrorCode;
  message: string;
  errors?: Record<string, string[] | undefined>;
};

export async function createUserFromSignup(input: z.infer<typeof signupSchema>): Promise<
  | { status: 201; body: SignupSuccessPayload }
  | { status: 400 | 409 | 500; body: SignupErrorPayload }
> {
  const normalizedEmail = normalizeEmail(input.email);
  const resolvedName = input.name?.trim() || nameFromEmail(normalizedEmail);

  const [existing] = await sql<{ id: string }[]>`
    select id
    from public.users
    where lower(email) = ${normalizedEmail}
    limit 1
  `;

  if (existing?.id) {
    return {
      status: 409,
      body: {
        ok: false,
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this email already exists. Log in or reset your password.',
      },
    };
  }

  let userId: string | null = null;

  try {
    const passwordHash = await bcrypt.hash(input.password, 10);
    const [inserted] = await sql<{ id: string }[]>`
      insert into public.users (name, email, password)
      values (${resolvedName}, ${normalizedEmail}, ${passwordHash})
      returning id
    `;
    userId = inserted?.id ?? null;
  } catch (error) {
    console.error('[signup] create user failed', { email: normalizedEmail, error });
    return {
      status: 500,
      body: {
        ok: false,
        code: 'SIGNUP_FAILED',
        message: 'Failed to create your account. Please try again.',
      },
    };
  }

  if (!userId) {
    return {
      status: 500,
      body: {
        ok: false,
        code: 'SIGNUP_FAILED',
        message: 'Failed to create your account. Please try again.',
      },
    };
  }

  try {
    await issueAndSendVerificationEmail({
      userId,
      email: normalizedEmail,
    });
  } catch (error) {
    console.error('[signup] verification email failed', {
      userId,
      email: normalizedEmail,
      error,
    });
    return {
      status: 500,
      body: {
        ok: false,
        code: 'VERIFICATION_EMAIL_FAILED',
        message:
          'Your account was created, but we could not send the verification email. Please try again from the login page.',
      },
    };
  }

  try {
    await logFunnelEvent({
      userEmail: normalizedEmail,
      eventName: 'signup_completed',
      source: 'signup',
      meta: { userId },
    });
  } catch (error) {
    console.error('[signup] funnel logging failed', { userId, error });
  }

  return {
    status: 201,
    body: {
      ok: true,
      code: 'SIGNUP_CREATED',
      message:
        "Account created. We've sent a verification email to your address. Please check your inbox and spam folder.",
      email: normalizedEmail,
    },
  };
}
