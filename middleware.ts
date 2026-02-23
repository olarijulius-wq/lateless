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

/**
 * Paths that are FULLY exempt from CSRF checks regardless of auth method.
 * Use EXACT paths only \u2014 prefix matching is intentionally avoided to prevent
 * accidental exemption of sibling routes (e.g. /api/reminders/run-manual).
 */
const CSRF_EXEMPT_API_EXACT_PATHS = new Set([
  '/api/stripe/webhook',
]);

/**
 * Path prefixes that are FULLY exempt from CSRF checks.
 * Keep this list minimal. /api/public/ and /api/auth/ are genuinely public.
 * Do NOT add /api/reminders/run here \u2014 use the exact-path set above for that.
 */
const CSRF_EXEMPT_API_PREFIXES = [
  '/api/public/',
  '/api/auth/',
];

/**
 * Returns true when the request carries a recognized cron token header or
 * Authorization bearer token. Such requests originate from server-to-server
 * cron jobs and carry no browser cookie session, so CSRF does not apply.
 *
 * IMPORTANT: this bypass is ONLY applied when the request has no cookie
 * header \u2014 i.e., it is not a browser-originated request. A browser that
 * also sends a cron token must still pass the origin check.
 */
function hasCronTokenHeader(request: NextRequest): boolean {
  const auth = request.headers.get('authorization')?.trim() ?? '';
  if (auth.toLowerCase().startsWith('bearer ') && auth.slice(7).trim()) {
    return true;
  }
  const xCronToken = request.headers.get('x-reminder-cron-token')?.trim();
  if (xCronToken) {
    return true;
  }
  return false;
}

function isApiCsrfExempt(pathname: string): boolean {
  // Exact-path exemptions first (most specific)
  if (CSRF_EXEMPT_API_EXACT_PATHS.has(pathname)) {
    return true;
  }
  // Prefix exemptions (public/auth routes)
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

    // Cron-token requests without a cookie are server-to-server \u2014 browser
    // CSRF does not apply. If they also have a cookie, they must still pass
    // the same-origin check like any other cookie-bearing request.
    if (!hasCookie && hasCronTokenHeader(request)) {
      // No CSRF check needed \u2014 no session cookie to forge
    } else if (hasCookie) {
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

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');

  const isProd =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  if (isProd) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|favicon\\.ico|opengraph-image\\.png).*)',
  ],
};
