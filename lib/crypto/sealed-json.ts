import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function decodedKey(encoded: string): Buffer {
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32)
    throw new Error('Token encryption requires a 32-byte base64 key.');
  return key;
}

export function sealJson(value: unknown, encodedKey: string): string {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', decodedKey(encodedKey), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}

export function unsealJson<T>(value: string, encodedKey: string): T {
  const bytes = Buffer.from(value, 'base64url'),
    cipher = createDecipheriv(
      'aes-256-gcm',
      decodedKey(encodedKey),
      bytes.subarray(0, 12)
    );
  cipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([
      cipher.update(bytes.subarray(28)),
      cipher.final(),
    ]).toString()
  ) as T;
}
