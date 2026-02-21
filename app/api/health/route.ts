import { NextResponse } from 'next/server';
import postgres from 'postgres';

export const runtime = 'nodejs';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export async function GET() {
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
