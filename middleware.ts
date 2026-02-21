import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PRIVATE_PATH_PREFIXES = [
  '/dashboard',
  '/login',
  '/signup',
  '/onboarding',
  '/pay/',
  '/invite/',
  '/verify/',
  '/unsubscribe/',
  '/forgot-password',
  '/reset-password',
  '/auth',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const shouldNoindex = PRIVATE_PATH_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  const response = NextResponse.next();

  if (shouldNoindex) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|favicon\\.ico|opengraph-image\\.png).*)',
  ],
};
