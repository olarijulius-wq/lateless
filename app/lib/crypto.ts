import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_VERSION = 'v1';
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;

let cachedEncryptionKey: Buffer | null | undefined;

function parseEncryptionKey(): Buffer | null {
  if (cachedEncryptionKey !== undefined) {
    return cachedEncryptionKey;
  }

  const raw = process.env.SMTP_ENCRYPTION_KEY_BASE64;
  if (!raw || raw.trim() === '') {
    cachedEncryptionKey = null;
    return cachedEncryptionKey;
  }

  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      'SMTP_ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes for AES-256-GCM.',
    );
  }

  cachedEncryptionKey = key;
  return cachedEncryptionKey;
}

function requireEncryptionKey(): Buffer {
  const key = parseEncryptionKey();
  if (!key) {
    throw new Error(
      'SMTP encryption key is missing. Set SMTP_ENCRYPTION_KEY_BASE64 (base64-encoded 32-byte key).',
    );
  }
  return key;
}

export function isEncryptionKeyConfigured(): boolean {
  return Boolean(parseEncryptionKey());
}

export function encryptString(plaintext: string): string {
  const key = requireEncryptionKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTION_VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptString(payload: string): string {
  const [version, ivB64, tagB64, ciphertextB64] = payload.split(':');
  if (
    version !== ENCRYPTION_VERSION ||
    !ivB64 ||
    !tagB64 ||
    !ciphertextB64
  ) {
    throw new Error('Invalid encrypted SMTP payload format.');
  }

  const key = requireEncryptionKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
