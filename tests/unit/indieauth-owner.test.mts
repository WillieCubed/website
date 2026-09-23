import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SIGN_IN_FAILURE_LIMIT,
  SIGN_IN_FAILURE_WINDOW_MS,
  TOTP_STEP_SECONDS,
  createTotpOwnerAuthenticator,
  decodeBase32,
  encodeBase32,
  generateTotpSecret,
  matchTotp,
  ownerAuthenticatorFromEnvironment,
  totpCode,
  totpProvisioningUri,
  totpStep,
} from '@/lib/indieweb/indieauth-owner';

import { memoryOwnerSignInStore } from './indieauth-memory-store.mts';

// The RFC 6238 appendix B SHA-1 secret.
const SECRET = Buffer.from('12345678901234567890');
const request = new Request('https://willie.page/indieauth/consent', {
  method: 'POST',
});

function form(code: string): FormData {
  const data = new FormData();
  data.set('code', code);
  return data;
}

test('base32 round-trips and reads secrets as apps display them', () => {
  assert.equal(encodeBase32(SECRET), 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.deepEqual(
    decodeBase32('gezd gnbv gy3t qojq gezd gnbv gy3t qojq'),
    SECRET
  );
  assert.equal(decodeBase32('not base32!'), null);
  assert.equal(decodeBase32(''), null);
  const generated = generateTotpSecret();
  assert.equal(decodeBase32(generated)?.length, 20);
});

test('totpCode matches the RFC 6238 SHA-1 test vectors', () => {
  const vectors: [number, string][] = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ];
  for (const [seconds, expected] of vectors) {
    const step = totpStep(new Date(seconds * 1000));
    assert.equal(totpCode(SECRET, step, 8), expected, String(seconds));
    // Six digits are the last six of the same value.
    assert.equal(totpCode(SECRET, step), expected.slice(2));
  }
});

test('matchTotp accepts the current and previous step only', () => {
  const now = new Date(1234567890 * 1000);
  const step = totpStep(now);
  assert.equal(matchTotp(SECRET, totpCode(SECRET, step), now), step);
  assert.equal(matchTotp(SECRET, totpCode(SECRET, step - 1), now), step - 1);
  assert.equal(matchTotp(SECRET, totpCode(SECRET, step - 2), now), null);
  assert.equal(matchTotp(SECRET, totpCode(SECRET, step + 1), now), null);
  // Spaces from the app's display are fine; other input is not.
  const spaced = totpCode(SECRET, step).replace(/(\d{3})/, '$1 ');
  assert.equal(matchTotp(SECRET, spaced, now), step);
  assert.equal(matchTotp(SECRET, '12345', now), null);
  assert.equal(matchTotp(SECRET, 'abcdef', now), null);
});

test('a code signs the owner in once', async () => {
  const now = new Date(1234567890 * 1000);
  const { store } = memoryOwnerSignInStore();
  const owner = createTotpOwnerAuthenticator({
    secret: SECRET,
    store,
    now: () => now,
  });
  const code = totpCode(SECRET, totpStep(now));

  assert.deepEqual(await owner.verify(request, form(code)), { ok: true });
  assert.deepEqual(await owner.verify(request, form(code)), {
    ok: false,
    reason: 'invalid',
  });
  // The previous step's code is older than the one just used.
  const previous = totpCode(SECRET, totpStep(now) - 1);
  assert.equal((await owner.verify(request, form(previous))).ok, false);
});

test('too many wrong codes in a day pause sign-in', async () => {
  let now = new Date(1234567890 * 1000);
  const { store, failures } = memoryOwnerSignInStore();
  const owner = createTotpOwnerAuthenticator({
    secret: SECRET,
    store,
    now: () => now,
  });

  for (let attempt = 0; attempt < SIGN_IN_FAILURE_LIMIT; attempt++) {
    assert.deepEqual(await owner.verify(request, form('000000')), {
      ok: false,
      reason: 'invalid',
    });
  }
  assert.equal(failures.size, SIGN_IN_FAILURE_LIMIT);

  // Even the right code is refused while paused.
  const right = totpCode(SECRET, totpStep(now));
  assert.deepEqual(await owner.verify(request, form(right)), {
    ok: false,
    reason: 'locked',
  });

  // Refused attempts do not extend the pause.
  assert.equal(failures.size, SIGN_IN_FAILURE_LIMIT);

  now = new Date(
    now.getTime() + SIGN_IN_FAILURE_WINDOW_MS + TOTP_STEP_SECONDS * 1000
  );
  const later = totpCode(SECRET, totpStep(now));
  assert.deepEqual(await owner.verify(request, form(later)), { ok: true });
  // A right code is not counted as a failure.
  assert.equal(failures.size, SIGN_IN_FAILURE_LIMIT);
});

test('parallel wrong codes cannot get past the daily limit', async () => {
  const now = new Date(1234567890 * 1000);
  const { store, failures } = memoryOwnerSignInStore();
  const owner = createTotpOwnerAuthenticator({
    secret: SECRET,
    store,
    now: () => now,
  });
  const right = totpCode(SECRET, totpStep(now));
  const wrong = right === '000000' ? '000001' : '000000';

  // Two hundred requests at once, starting a few ticks apart so their
  // queries interleave the way concurrent serverless calls would.
  async function burst() {
    return Promise.all(
      Array.from({ length: 200 }, async (_, index) => {
        for (let tick = 0; tick < index % 7; tick++) await Promise.resolve();
        return owner.verify(request, form(wrong));
      })
    );
  }
  function checked(results: Awaited<ReturnType<typeof burst>>) {
    return results.filter((result) => !result.ok && result.reason === 'invalid')
      .length;
  }

  const first = checked(await burst());
  assert.ok(first <= SIGN_IN_FAILURE_LIMIT, `${first} codes were checked`);
  assert.equal(failures.size, first);
  // One at a time, the rest of the day's guesses are still there, and no more.
  const sequential = [];
  for (let attempt = 0; attempt < 200; attempt++) {
    sequential.push(await owner.verify(request, form(wrong)));
  }
  assert.equal(first + checked(sequential), SIGN_IN_FAILURE_LIMIT);
  assert.equal(failures.size, SIGN_IN_FAILURE_LIMIT);
  assert.equal(checked(await burst()), 0);
});

test('the environment turns the TOTP check on only with a strong secret', () => {
  const { store } = memoryOwnerSignInStore();
  assert.equal(ownerAuthenticatorFromEnvironment({}, store), null);

  const errors: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    assert.equal(
      ownerAuthenticatorFromEnvironment(
        { INDIEAUTH_TOTP_SECRET: 'GEZDGNBV' },
        store
      ),
      null
    );
    assert.equal(errors.length, 1);
  } finally {
    console.error = original;
  }

  const owner = ownerAuthenticatorFromEnvironment(
    { INDIEAUTH_TOTP_SECRET: generateTotpSecret() },
    store
  );
  assert.equal(owner?.prompt, 'code');
});

test('the provisioning URI is what authenticator apps scan', () => {
  assert.equal(
    totpProvisioningUri(
      'GEZDGNBV',
      'Willie Chalmers III IndieAuth',
      'willie.page'
    ),
    'otpauth://totp/Willie%20Chalmers%20III%20IndieAuth:willie.page?secret=GEZDGNBV&issuer=Willie%20Chalmers%20III%20IndieAuth&algorithm=SHA1&digits=6&period=30'
  );
});
