const LOCALHOST_FALLBACK_ORIGIN = 'http://localhost:3000';
const PRODUCTION_CANONICAL_ORIGIN = 'https://lateless.org';

function normalizeOrigin(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function getCanonicalAuthOrigin(): string {
  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_CANONICAL_ORIGIN;
  }

  return (
    normalizeOrigin(process.env.NEXTAUTH_URL) ||
    normalizeOrigin(process.env.AUTH_URL) ||
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeOrigin(process.env.VERCEL_URL) ||
    LOCALHOST_FALLBACK_ORIGIN
  );
}

export function sanitizeRelativeCallbackPath(
  rawValue: string | null | undefined,
  fallback = '/dashboard',
): string {
  const safeFallback = fallback.startsWith('/') ? fallback : '/dashboard';
  const candidate = rawValue?.trim();
  if (!candidate) {
    return safeFallback;
  }

  if (candidate.startsWith('/')) {
    return candidate.startsWith('//') ? safeFallback : candidate;
  }

  try {
    const parsed = new URL(candidate);
    const canonical = new URL(getCanonicalAuthOrigin());
    if (parsed.origin !== canonical.origin) {
      return safeFallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return safeFallback;
  }
}

export function buildCanonicalAuthUrl(pathname: string): string {
  return new URL(pathname, getCanonicalAuthOrigin()).toString();
}

export function resolveCanonicalCallbackUrl(
  rawValue: string | null | undefined,
  fallback = '/dashboard',
): string {
  const canonicalOrigin = getCanonicalAuthOrigin();
  const safeFallback = fallback.startsWith('/') ? fallback : '/dashboard';
  const candidate = rawValue?.trim();

  if (!candidate) {
    return buildCanonicalAuthUrl(safeFallback);
  }

  try {
    const parsed = new URL(candidate, canonicalOrigin);
    const finalPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return buildCanonicalAuthUrl(finalPath || safeFallback);
  } catch {
    return buildCanonicalAuthUrl(safeFallback);
  }
}

export function isCanonicalAuthRequest(url: URL): boolean {
  return url.origin === new URL(getCanonicalAuthOrigin()).origin;
}
