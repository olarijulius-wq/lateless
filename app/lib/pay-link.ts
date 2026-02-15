import crypto from 'crypto';

type PayLinkPayload = {
  invoiceId: string;
  iat?: number;
  exp?: number;
};

type PayTokenVerificationResult =
  | { ok: true; payload: PayLinkPayload }
  | { ok: false; reason: 'invalid' | 'expired' };

function getPayLinkSecret() {
  const secret = process.env.PAY_LINK_SECRET;
  if (!secret) {
    throw new Error('Missing PAY_LINK_SECRET');
  }
  return secret;
}

function encodePayload(payload: PayLinkPayload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodePayload(encoded: string): PayLinkPayload | null {
  try {
    const decoded = Buffer.from(encoded, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as PayLinkPayload;
    if (
      !parsed?.invoiceId ||
      typeof parsed.invoiceId !== 'string'
    ) {
      return null;
    }
    if (parsed.iat !== undefined && typeof parsed.iat !== 'number') {
      return null;
    }
    if (parsed.exp !== undefined && typeof parsed.exp !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function signPayload(encoded: string) {
  const secret = getPayLinkSecret();
  return crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
}

function getPayLinkTtlSeconds() {
  const raw = process.env.PAY_LINK_TTL_SECONDS;
  if (!raw) return null;
  const ttlSeconds = Number(raw);
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) return null;
  return Math.floor(ttlSeconds);
}

export function generatePayToken(invoiceId: string) {
  const iat = Math.floor(Date.now() / 1000);
  const ttlSeconds = getPayLinkTtlSeconds();
  const payload: PayLinkPayload = { invoiceId, iat };

  if (ttlSeconds !== null) {
    payload.exp = iat + ttlSeconds;
  }

  const encoded = encodePayload(payload);
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

export function verifyPayToken(token: string): PayTokenVerificationResult {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return { ok: false, reason: 'invalid' };

  const expected = signPayload(encoded);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return { ok: false, reason: 'invalid' };
  }

  const payload = decodePayload(encoded);
  if (!payload) {
    return { ok: false, reason: 'invalid' };
  }

  const ttlSeconds = getPayLinkTtlSeconds();
  if (ttlSeconds !== null) {
    const now = Math.floor(Date.now() / 1000);
    const exp = payload.exp;

    if (typeof exp !== 'number' || now > exp) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[pay-link] token expired', {
          now,
          exp: exp ?? null,
          ttlSeconds,
        });
      }
      return { ok: false, reason: 'expired' };
    }
  }

  return { ok: true, payload };
}

export function generatePayLink(baseUrl: string, invoiceId: string) {
  const token = generatePayToken(invoiceId);
  return `${baseUrl}/pay/${token}`;
}
