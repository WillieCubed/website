import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function storageKey(value: string): Buffer {
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32)
    throw new Error('ATPROTO_OAUTH_STORAGE_KEY must encode 32 bytes.');
  return key;
}

export function encryptOAuthValue(value: unknown, key: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', storageKey(key), nonce);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([nonce, cipher.getAuthTag(), data]).toString('base64');
}

export function decryptOAuthValue<T>(value: string, key: string): T {
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length < 29) throw new Error('Invalid encrypted OAuth value.');
  const cipher = createDecipheriv(
    'aes-256-gcm',
    storageKey(key),
    bytes.subarray(0, 12)
  );
  cipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString(
      'utf8'
    )
  ) as T;
}
