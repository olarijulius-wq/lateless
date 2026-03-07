const LOCALHOST_FALLBACK_ORIGIN = 'http://localhost:3000';
const PRODUCTION_CANONICAL_ORIGIN = 'https://lateless.org';

type AuthOriginOptions = {
  requestOrigin?: string | null;
  baseUrl?: string | null;
};

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

  if (!process.env.VERCEL) {
    return LOCALHOST_FALLBACK_ORIGIN;
  }

  return normalizeOrigin(process.env.VERCEL_URL) || LOCALHOST_FALLBACK_ORIGIN;
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

function resolveAuthOrigin(options?: AuthOriginOptions): string {
  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_CANONICAL_ORIGIN;
  }

  if (!process.env.VERCEL) {
    return (
      normalizeOrigin(options?.requestOrigin) ||
      normalizeOrigin(options?.baseUrl) ||
      LOCALHOST_FALLBACK_ORIGIN
    );
  }

  return (
    normalizeOrigin(options?.requestOrigin) ||
    normalizeOrigin(options?.baseUrl) ||
    normalizeOrigin(process.env.VERCEL_URL) ||
    LOCALHOST_FALLBACK_ORIGIN
  );
}

export function resolveCanonicalCallbackUrl(
  rawValue: string | null | undefined,
  fallback = '/dashboard',
  options?: AuthOriginOptions,
): string {
  const canonicalOrigin = resolveAuthOrigin(options);
  const safeFallback = fallback.startsWith('/') ? fallback : '/dashboard';
  const candidate = rawValue?.trim();

  if (!candidate) {
    return new URL(safeFallback, canonicalOrigin).toString();
  }

  try {
    const parsed = new URL(candidate, canonicalOrigin);
    const finalPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return new URL(finalPath || safeFallback, canonicalOrigin).toString();
  } catch {
    return new URL(safeFallback, canonicalOrigin).toString();
  }
}

export function isCanonicalAuthRequest(url: URL): boolean {
  return url.origin === new URL(getCanonicalAuthOrigin()).origin;
}
