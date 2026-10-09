import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { type ServerHttp2Session, createSecureServer } from 'node:http2';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';

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

test('cold publishing imports preserve native HTTPS headers and gzip bodies', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'native-fetch-'));
  const certificate = join(directory, 'certificate.pem');
  const key = join(directory, 'key.pem');
  let server: ReturnType<typeof createSecureServer> | undefined;
  const sessions = new Set<ServerHttp2Session>();
  try {
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'ec',
        '-pkeyopt',
        'ec_paramgen_curve:P-256',
        '-nodes',
        '-keyout',
        key,
        '-out',
        certificate,
        '-days',
        '1',
        '-subj',
        '/CN=127.0.0.1',
        '-addext',
        'subjectAltName=IP:127.0.0.1',
      ],
      { stdio: 'ignore' }
    );
    server = createSecureServer({
      key: await readFile(key),
      cert: await readFile(certificate),
      allowHTTP1: true,
    });
    server.on('session', (session) => {
      sessions.add(session);
      session.on('close', () => sessions.delete(session));
    });
    const body = JSON.stringify({ message: 'Readable metadata' });
    server.on('request', (_request, response) => {
      response.writeHead(200, {
        'content-type': 'application/did+ld+json',
        'content-encoding': 'gzip',
        link: '</token>; rel="token_endpoint"',
      });
      response.end(gzipSync(body));
    });
    await new Promise<void>((finish, reject) => {
      server!.once('error', reject);
      server!.listen(0, '127.0.0.1', finish);
    });
    const address = server.address();
    assert(address && typeof address !== 'string');
    const script = `
      await Promise.all([
        import('./lib/atproto/bluesky.ts'),
        import('./lib/atproto/client.ts'),
      ]);
      const response = await fetch('https://127.0.0.1:${address.port}');
      console.log(JSON.stringify({
        status: response.status,
        contentType: response.headers.get('content-type'),
        link: response.headers.get('link'),
        body: await response.text(),
      }));
      await (await import('undici')).getGlobalDispatcher().close();
    `;
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '--eval', script],
      {
        // A fresh process preserves the failing import order without changing TLS verification.
        env: { ...process.env, NODE_EXTRA_CA_CERTS: certificate },
        timeout: 15000,
      }
    );
    assert.deepEqual(JSON.parse(stdout), {
      status: 200,
      contentType: 'application/did+ld+json',
      link: '</token>; rel="token_endpoint"',
      body,
    });
  } finally {
    for (const session of sessions) session.destroy();
    if (server?.listening)
      await new Promise<void>((finish) => server!.close(() => finish()));
    await rm(directory, { recursive: true, force: true });
  }
});
