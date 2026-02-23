import { NextResponse } from 'next/server';
import { z, type ZodType } from 'zod';
import { sql } from '@/app/lib/db';

export type RateLimitPolicy = {
  bucket: string;
  windowSec: number;
  ipLimit: number;
  userLimit?: number;
};

type RateLimitDecision = {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
  limit: number;
};

type ParseSuccess<T> = { ok: true; data: T };
type ParseFailure = { ok: false; response: NextResponse };
export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

const RATE_LIMIT_MODE = process.env.RATE_LIMIT_MODE === 'report' ? 'report' : 'enforce';

const TOKEN_PARAM_SCHEMA = z
  .object({
    token: z
      .string()
      .trim()
      .min(16)
      .max(2048)
      .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, 'Invalid token format'),
  })
  .strict();

const UUID_PARAM_SCHEMA = z
  .object({
    id: z.string().uuid('Route param id must be a valid UUID'),
  })
  .strict();

function normalizeKey(value: string) {
  return value.trim().toLowerCase().slice(0, 256);
}

function parseClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown';
}

async function consumeLimit(input: {
  bucket: string;
  key: string;
  limit: number;
  windowSec: number;
}): Promise<RateLimitDecision> {
  const rows = await sql<{
    count: number;
    retry_after_sec: number;
  }[]>`
    with bumped as (
      insert into public.api_rate_limits (bucket, key, window_start, count)
      values (${input.bucket}, ${input.key}, now(), 1)
      on conflict (bucket, key)
      do update
      set
        count = case
          when public.api_rate_limits.window_start <= now() - (${input.windowSec} * interval '1 second')
            then 1
          else public.api_rate_limits.count + 1
        end,
        window_start = case
          when public.api_rate_limits.window_start <= now() - (${input.windowSec} * interval '1 second')
            then now()
          else public.api_rate_limits.window_start
        end
      returning count, window_start
    )
    select
      count,
      greatest(
        0,
        ceil(
          ${input.windowSec} - extract(epoch from (now() - window_start))
        )::int
      ) as retry_after_sec
    from bumped
  `;

  const count = Number(rows[0]?.count ?? 0);
  const retryAfterSec = Math.max(1, Number(rows[0]?.retry_after_sec ?? input.windowSec));
  const remaining = Math.max(0, input.limit - count);

  return {
    allowed: count <= input.limit,
    retryAfterSec,
    remaining,
    limit: input.limit,
  };
}

function rateLimitResponse(input: {
  bucket: string;
  retryAfterSec: number;
  limit: number;
  remaining: number;
}) {
  return NextResponse.json(
    {
      ok: false,
      code: 'RATE_LIMITED',
      error: 'Too many requests',
      bucket: input.bucket,
      retryAfterSec: input.retryAfterSec,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(input.retryAfterSec),
        'X-RateLimit-Limit': String(input.limit),
        'X-RateLimit-Remaining': String(input.remaining),
      },
    },
  );
}

export async function enforceRateLimit(
  req: Request,
  policy: RateLimitPolicy,
  options?: { userKey?: string | null },
): Promise<NextResponse | null> {
  const ipKey = normalizeKey(parseClientIp(req));

  try {
    const ipDecision = await consumeLimit({
      bucket: `${policy.bucket}:ip`,
      key: ipKey,
      limit: policy.ipLimit,
      windowSec: policy.windowSec,
    });

    let userDecision: RateLimitDecision | null = null;
    const userKey = options?.userKey?.trim();
    if (userKey && policy.userLimit) {
      userDecision = await consumeLimit({
        bucket: `${policy.bucket}:user`,
        key: normalizeKey(userKey),
        limit: policy.userLimit,
        windowSec: policy.windowSec,
      });
    }

    const denied = [ipDecision, userDecision]
      .filter((decision): decision is RateLimitDecision => Boolean(decision))
      .find((decision) => !decision.allowed);

    if (!denied) {
      return null;
    }

    if (RATE_LIMIT_MODE === 'report') {
      console.warn('[rate-limit][report-only] would block request', {
        bucket: policy.bucket,
        ip: ipKey,
        userKey: userKey ?? null,
        retryAfterSec: denied.retryAfterSec,
      });
      return null;
    }

    return rateLimitResponse({
      bucket: policy.bucket,
      retryAfterSec: denied.retryAfterSec,
      limit: denied.limit,
      remaining: denied.remaining,
    });
  } catch (error) {
    console.error('[rate-limit] limiter failed open', {
      bucket: policy.bucket,
      error,
    });
    return null;
  }
}

export function parseRouteParams<T>(
  schema: ZodType<T>,
  params: unknown,
): ParseResult<T> {
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          code: 'INVALID_ROUTE_PARAMS',
          message: 'Invalid route parameters.',
          issues: parsed.error.issues,
        },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

export function parseQuery<T>(schema: ZodType<T>, url: URL): ParseResult<T> {
  const queryObject = Object.fromEntries(url.searchParams.entries());
  const parsed = schema.safeParse(queryObject);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          code: 'INVALID_QUERY',
          message: 'Invalid query parameters.',
          issues: parsed.error.issues,
        },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

export async function parseJsonBody<T>(
  req: Request,
  schema: ZodType<T>,
): Promise<ParseResult<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          code: 'INVALID_JSON',
          message: 'Request body must be valid JSON.',
        },
        { status: 400 },
      ),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          code: 'INVALID_REQUEST_BODY',
          message: 'Invalid request body.',
          issues: parsed.error.issues,
        },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

export const routeTokenParamsSchema = TOKEN_PARAM_SCHEMA;
export const routeUuidParamsSchema = UUID_PARAM_SCHEMA;
