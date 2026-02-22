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

const API_MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSRF_EXEMPT_API_PREFIXES = [
  '/api/public/',
  '/api/stripe/webhook',
  '/api/auth/',
  '/api/reminders/run',
];

function isApiCsrfExempt(pathname: string) {
  return CSRF_EXEMPT_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isSameOrigin(value: string, expectedOrigin: string) {
  try {
    return new URL(value).origin === expectedOrigin;
  } catch {
    return false;
  }
}

function csrfFailureResponse() {
  return NextResponse.json(
    {
      ok: false,
      code: 'CSRF_ORIGIN_MISMATCH',
      error: 'Cross-site request blocked.',
    },
    { status: 403 },
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();
  const shouldNoindex = PRIVATE_PATH_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (
    pathname.startsWith('/api/') &&
    API_MUTATION_METHODS.has(method) &&
    !isApiCsrfExempt(pathname)
  ) {
    const hasCookie = Boolean(request.headers.get('cookie'));
    if (hasCookie) {
      const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
      const proto = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');
      const origin = request.headers.get('origin');
      const referer = request.headers.get('referer');

      if (host) {
        const expectedOrigin = `${proto}://${host}`;
        const originMatches = origin ? isSameOrigin(origin, expectedOrigin) : false;
        const refererMatches = referer ? isSameOrigin(referer, expectedOrigin) : false;
        if (!originMatches && !refererMatches) {
          return csrfFailureResponse();
        }
      }
    }
  }

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
