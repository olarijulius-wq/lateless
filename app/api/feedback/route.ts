import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserEmail } from '@/app/lib/data';
import {
  createFeedback,
  FEEDBACK_MIGRATION_FILE,
  FEEDBACK_MIGRATION_REQUIRED_CODE,
  isFeedbackMigrationRequiredError,
} from '@/app/lib/feedback';
import {
  enforceRateLimit,
  parseJsonBody,
} from '@/app/lib/security/api-guard';

export const runtime = 'nodejs';

type FeedbackPayload = {
  message?: unknown;
  pagePath?: unknown;
};
const feedbackBodySchema = z
  .object({
    message: z.unknown().optional(),
    pagePath: z.unknown().optional(),
  })
  .strict();

function normalizeMessage(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizePagePath(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function migrationMessage() {
  return `Feedback requires DB migration ${FEEDBACK_MIGRATION_FILE}. Run migrations and retry.`;
}

export async function POST(request: NextRequest) {
  let userEmail: string;
  try {
    userEmail = await requireUserEmail();
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Unauthorized.' },
      { status: 401 },
    );
  }

  const rl = await enforceRateLimit(
    request,
    {
      bucket: 'feedback_submit',
      windowSec: 300,
      ipLimit: 30,
      userLimit: 12,
    },
    { userKey: userEmail },
  );
  if (rl) return rl;

  const parsedBody = await parseJsonBody(request, feedbackBodySchema);
  if (!parsedBody.ok) return parsedBody.response;
  const payload: FeedbackPayload = parsedBody.data;

  const message = normalizeMessage(payload.message);
  if (message.length < 1 || message.length > 2000) {
    return NextResponse.json(
      { ok: false, message: 'Feedback message must be 1 to 2000 characters.' },
      { status: 400 },
    );
  }

  const pagePath = normalizePagePath(payload.pagePath);

  try {
    await createFeedback({
      userEmail,
      message,
      pagePath,
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isFeedbackMigrationRequiredError(error)) {
      return NextResponse.json(
        {
          ok: false,
          code: FEEDBACK_MIGRATION_REQUIRED_CODE,
          message: migrationMessage(),
        },
        { status: 503 },
      );
    }

    console.error('Create feedback failed:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to submit feedback.' },
      { status: 500 },
    );
  }
}
