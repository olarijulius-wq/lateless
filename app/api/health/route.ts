import { NextResponse } from 'next/server';
import { sql } from '@/app/lib/db';
import { enforceRateLimit } from '@/app/lib/security/api-guard';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const rateLimitResponse = await enforceRateLimit(
    req,
    {
      bucket: 'health',
      windowSec: 60,
      ipLimit: 60,
    },
    {
      failClosed: true,
    },
  );
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const time = new Date().toISOString();
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  let db: 'ok' | 'fail' = 'ok';
  try {
    await sql`select 1`;
  } catch {
    db = 'fail';
  }

  return NextResponse.json(
    {
      ok: true,
      version: process.env.APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? 'dev',
      env: isProduction
        ? 'production'
        : process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
      db,
      time,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
