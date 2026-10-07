import { createHash, timingSafeEqual } from 'node:crypto';

export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function validateBrowserBinding(state: unknown, cookie: string): void {
  if (
    !state ||
    typeof state !== 'object' ||
    !('browserHash' in state) ||
    typeof state.browserHash !== 'string' ||
    !cookie
  ) {
    throw new Error('This sign-in has expired.');
  }
  const expected = Buffer.from(state.browserHash);
  const actual = Buffer.from(digest(cookie));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new Error('This sign-in belongs to another browser.');
}
