import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { type Server, createServer } from 'node:http';
import { userInfo } from 'node:os';
import { Pool } from 'pg';

import { isMain } from '../publishing/runtime.mts';
import { seedStudioDatabase } from './fixtures.mts';

export async function runStudioTests() {
  const port = Number(process.env.STUDIO_TEST_PORT || 3217);
  const origin = `http://localhost:${port}`;
  const schema = `studio_e2e_${randomUUID().replaceAll('-', '')}`;
  const db = new Pool({ host: '/tmp', database: 'postgres' });
  let server: Server | undefined;
  let next: ChildProcess | undefined;
  let runningTests: ChildProcess | undefined;
  let cleaning = false;
  async function cleanup() {
    if (cleaning) return;
    cleaning = true;
    if (runningTests?.pid !== undefined) {
      try {
        process.kill(-runningTests.pid, 'SIGTERM');
      } catch {
        /* Test runner may have stopped already. */
      }
    }
    if (next?.pid !== undefined) {
      try {
        process.kill(-next.pid, 'SIGTERM');
      } catch {
        /* Process or server may have already stopped. */
      }
    }
    if (server)
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve()))
      );
    await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await db.end();
  }
  process.once('SIGINT', async () => {
    await cleanup();
    process.exit(130);
  });
  process.once('SIGTERM', async () => {
    await cleanup();
    process.exit(143);
  });
  try {
    await seedStudioDatabase(db, schema);
    const { issuer, token } = await startIssuer();
    const dbURL = new URL('postgresql:///postgres');
    dbURL.searchParams.set('host', '/tmp');
    dbURL.searchParams.set('user', userInfo().username);
    dbURL.searchParams.set('options', `-c search_path=${schema}`);
    const env = {
      ...process.env,
      SITE_MODE:
        process.env.STUDIO_TEST_SITE_MODE === 'public' ? 'public' : 'preview',
      STUDIO_DATABASE_URL: dbURL.href,
      ...(process.env.MUSIC_E2E === '1'
        ? { MUSIC_PUBLIC_DATABASE_URL: dbURL.href }
        : {}),
      STUDIO_ORIGIN: origin,
      OWNER_ACCESS_ISSUER: issuer,
      OWNER_ACCESS_AUDIENCE: 'studio-e2e',
      OWNER_ACCESS_EMAIL: 'studio-test@example.invalid',
      STUDIO_TEST_ORIGIN: origin,
      STUDIO_TEST_TOKEN: token,
      STUDIO_E2E: '1',
    };
    await startPreview(env, token);
    runningTests = spawn(
      'pnpm',
      [
        'exec',
        'playwright',
        'test',
        '--config',
        process.env.STUDIO_TEST_CONFIG ??
          (process.env.MUSIC_E2E
            ? 'tests/music-admin.config.mts'
            : 'tests/studio.config.mts'),
        ...process.argv.slice(2),
      ],
      { env, stdio: 'inherit', detached: true }
    );
    const code = await new Promise<number | null>((resolve) =>
      runningTests!.once('exit', resolve)
    );
    process.exitCode = code ?? 0;
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
  async function startIssuer() {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = {
      ...(await exportJWK(publicKey)),
      kid: 'studio-e2e',
      alg: 'RS256',
      use: 'sig',
    };
    server = createServer((req, res) => {
      if (req.url !== '/cdn-cgi/access/certs') {
        res.writeHead(404).end();
        return;
      }
      res
        .writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify({ keys: [jwk] }));
    });
    await new Promise<void>((resolve) =>
      server!.listen(0, '127.0.0.1', resolve)
    );
    const address = server.address();
    if (address === null || typeof address === 'string')
      throw new Error('The test issuer needs a local TCP listener.');
    const issuer = `http://127.0.0.1:${address.port}`;
    const token = await new SignJWT({ email: 'studio-test@example.invalid' })
      .setProtectedHeader({ alg: 'RS256', kid: jwk.kid })
      .setIssuer(issuer)
      .setAudience('studio-e2e')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    return { issuer, token };
  }
  async function startPreview(
    env: NodeJS.ProcessEnv,
    token: string
  ): Promise<void> {
    // Private mode uses real JWT/JWKS checks; public mode exercises the public
    // boundary with Studio routes disabled. Neither uses provider credentials.
    next = spawn('pnpm', ['exec', 'next', 'dev', '--port', String(port)], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    let logs = '';
    for (const stream of [next.stdout, next.stderr])
      stream?.on('data', (chunk) => {
        logs = (logs + chunk).slice(-16000);
        if (process.env.STUDIO_TEST_VERBOSE) process.stdout.write(chunk);
      });
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (next.exitCode !== null)
        throw new Error(`Preview server exited: ${logs}`);
      try {
        const readyPath =
          env.SITE_MODE === 'public' ? '/music' : '/api/studio/documents';
        const response = await fetch(`${origin}${readyPath}`, {
          headers: { 'cf-access-jwt-assertion': token },
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        /* Process or server may have already stopped. */
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error(`Preview server did not become ready: ${logs}`);
  }
}

if (isMain(import.meta.url)) await runStudioTests();
