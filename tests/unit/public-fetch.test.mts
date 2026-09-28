import assert from 'node:assert/strict';
import test from 'node:test';

import { isPublicAddress } from '@/lib/indieweb/public-fetch';

/** Run `check` with the given environment variables, then restore them. */
function withEnv(env: Record<string, string | undefined>, check: () => void) {
  const saved = Object.fromEntries(
    Object.keys(env).map((key) => [key, process.env[key]])
  );
  Object.assign(process.env, env);
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
  }
  try {
    check();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('the local write test may reach loopback, and nothing else private', () => {
  withEnv({ INDIEWEB_TEST_ALLOW_LOOPBACK: 'true', VERCEL: undefined }, () => {
    // An IPv4-mapped loopback address is the same host.
    for (const address of [
      '127.0.0.1',
      '127.8.9.10',
      '::1',
      '[::1]',
      '::ffff:127.0.0.1',
    ]) {
      assert.equal(isPublicAddress(address), true, address);
    }
    for (const address of [
      '10.0.0.5',
      '169.254.169.254',
      '192.168.1.1',
      '::ffff:169.254.169.254',
      'fd00::1',
    ]) {
      assert.equal(isPublicAddress(address), false, address);
    }
  });
});

test('a Vercel deployment ignores the loopback allowance', () => {
  withEnv({ INDIEWEB_TEST_ALLOW_LOOPBACK: 'true', VERCEL: '1' }, () => {
    assert.equal(isPublicAddress('127.0.0.1'), false);
  });
});

test('without the allowance loopback is refused', () => {
  withEnv({ INDIEWEB_TEST_ALLOW_LOOPBACK: undefined }, () => {
    assert.equal(isPublicAddress('127.0.0.1'), false);
    assert.equal(isPublicAddress('::1'), false);
  });
});
