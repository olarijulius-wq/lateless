import { NextResponse } from 'next/server';
import { getAbsoluteUrl, getSiteUrl } from '@/app/lib/seo/site-url';
import { enforceRateLimit } from '@/app/lib/security/api-guard';

export async function GET(req: Request) {
  const rateLimitResponse = await enforceRateLimit(req, {
    bucket: 'seo_verify',
    windowSec: 60,
    ipLimit: 30,
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const appUrl = getSiteUrl().toString();
  const robotsUrl = getAbsoluteUrl('/robots.txt');
  const sitemapUrl = getAbsoluteUrl('/sitemap.xml');

  return NextResponse.json(
    {
      appUrl,
      robotsUrl,
      sitemapUrl,
      environment: {
        NODE_ENV: process.env.NODE_ENV ?? null,
        VERCEL_ENV: process.env.VERCEL_ENV ?? null,
      },
      note: 'In production, robots should be served from public/robots.txt when present.',
    },
    {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
      },
    },
  );
}
