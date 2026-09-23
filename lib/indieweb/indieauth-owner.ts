import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type {
  OwnerAuthenticator,
  OwnerCheck,
  OwnerSignInStore,
} from '@/lib/indieweb/types';

/**
 * The owner check on the IndieAuth consent page. Approving a client needs a
 * current code from Willie's authenticator app (TOTP, RFC 6238). The secret
 * lives only in the `INDIEAUTH_TOTP_SECRET` environment variable, never in
 * the repository.
 *
 * The consent flow only sees the `OwnerAuthenticator` interface, so a
 * different check, such as verifying Cloudflare Access's
 * `Cf-Access-Jwt-Assertion` header, replaces this one without changing the
 * flow: implement `verify` against the request and set `prompt` to `none`.
 */

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** The shortest secret accepted, in bytes. RFC 4226 recommends 20. */
export const TOTP_MIN_SECRET_BYTES = 16;
/**
 * Failed codes allowed across all clients in a rolling day. With two codes
 * valid at a time, ten guesses a day give an attacker about a 1% chance a
 * year; past the limit, sign-in stops until the window rolls on.
 */
export const SIGN_IN_FAILURE_LIMIT = 10;
export const SIGN_IN_FAILURE_WINDOW_MS = 24 * 60 * 60 * 1000;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

/**
 * Decode an RFC 4648 base32 secret as authenticator apps show it: case,
 * spaces, and padding are ignored. Null for anything else.
 */
export function decodeBase32(text: string): Buffer | null {
  const clean = text.replace(/[\s=]/g, '').toUpperCase();
  if (!clean || /[^A-Z2-7]/.test(clean)) return null;
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** A fresh 160-bit secret in base32, for `pnpm indieauth:totp`. */
export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

/** The TOTP time step a moment falls in. */
export function totpStep(now: Date): number {
  return Math.floor(now.getTime() / 1000 / TOTP_STEP_SECONDS);
}

/** The HOTP value (RFC 4226) for a counter, as a zero-padded string. */
export function totpCode(
  secret: Uint8Array,
  step: number,
  digits = TOTP_DIGITS
): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', secret).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, '0');
}

/**
 * The step a code belongs to: the current one, or the one before it for a
 * code that rolled over while it was typed. Null when it matches neither.
 */
export function matchTotp(
  secret: Uint8Array,
  code: string,
  now: Date
): number | null {
  const typed = code.replace(/\s/g, '');
  if (!/^\d+$/.test(typed) || typed.length !== TOTP_DIGITS) return null;
  const current = totpStep(now);
  for (const step of [current, current - 1]) {
    const expected = Buffer.from(totpCode(secret, step));
    if (timingSafeEqual(expected, Buffer.from(typed))) return step;
  }
  return null;
}

/** The `otpauth://` URI an authenticator app scans to add the secret. */
export function totpProvisioningUri(
  secret: string,
  issuer: string,
  account: string
): string {
  // Spaces are written %20, not +, which some apps would show literally.
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = Object.entries({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  })
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return `otpauth://totp/${label}?${params}`;
}

/**
 * The TOTP owner check. A code counts once: its step is claimed in the store,
 * and a step at or before the last claimed one is refused. Every attempt is
 * recorded before its code is checked, and only wrong and replayed codes stay
 * counted toward the daily failure limit.
 */
export function createTotpOwnerAuthenticator({
  secret,
  store,
  now = () => new Date(),
}: {
  secret: Uint8Array;
  store: OwnerSignInStore;
  now?: () => Date;
}): OwnerAuthenticator {
  return {
    prompt: 'code',
    async verify(_request, form): Promise<OwnerCheck> {
      const at = now();
      // The attempt is recorded before the code is checked, so parallel
      // requests cannot all read a count under the limit and then guess.
      const attempt = await store.recordAttempt(SIGN_IN_FAILURE_WINDOW_MS, at);
      if (attempt.attempts > SIGN_IN_FAILURE_LIMIT) {
        // A refused attempt checked nothing, so it does not extend the pause.
        await store.forgetAttempt(attempt.id);
        return { ok: false, reason: 'locked' };
      }

      const code = form.get('code');
      const step =
        typeof code === 'string' ? matchTotp(secret, code, at) : null;
      if (step !== null && (await store.claimTotpStep(step, at))) {
        await store.forgetAttempt(attempt.id);
        return { ok: true };
      }

      return { ok: false, reason: 'invalid' };
    },
  };
}

/**
 * The owner check the environment configures, or null when there is none,
 * which turns sign-in off. A secret too short to be safe also turns it off.
 */
export function ownerAuthenticatorFromEnvironment(
  env: Record<string, string | undefined>,
  store: OwnerSignInStore
): OwnerAuthenticator | null {
  const encoded = env.INDIEAUTH_TOTP_SECRET;
  if (!encoded) return null;
  const secret = decodeBase32(encoded);
  if (!secret || secret.length < TOTP_MIN_SECRET_BYTES) {
    console.error(
      'INDIEAUTH_TOTP_SECRET must be base32 and at least 16 bytes; sign-in is off.'
    );
    return null;
  }
  return createTotpOwnerAuthenticator({ secret, store });
}
