import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { type Server, createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

import { isMain } from '../../../scripts/shared/command.mts';
import { studioTestDatabase } from './database.mts';
import { seedStudioDatabase } from './fixtures.mts';

export async function runStudioTests() {
  const metrics = process.env.STUDIO_TEST_METRICS === '1';
  const musicFixtures = metrics || process.env.MUSIC_E2E === '1';
  const port = Number(process.env.STUDIO_TEST_PORT || 3217);
  const origin = `http://localhost:${port}`;
  const schema = `studio_e2e_${randomUUID().replaceAll('-', '')}`;
  const database = studioTestDatabase(
    schema,
    process.env.STUDIO_TEST_DATABASE_URL
  );
  const db = new Pool(database.admin);
  let server: Server | undefined;
  let next: ChildProcess | undefined;
  let runningTests: ChildProcess | undefined;
  let cleaning: Promise<void> | undefined;
  function cleanup(): Promise<void> {
    cleaning ??= cleanResources();
    return cleaning;
  }
  async function cleanResources() {
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
    try {
      if (server)
        await new Promise<void>((resolve, reject) =>
          server!.close((error) => (error ? reject(error) : resolve()))
        );
    } finally {
      try {
        await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      } finally {
        await db.end();
      }
    }
  }
  function interrupt() {
    void cleanup().finally(() => process.exit(130));
  }
  function terminate() {
    void cleanup().finally(() => process.exit(143));
  }
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', terminate);
  try {
    await seedStudioDatabase(db, schema, musicFixtures);
    const { issuer, token } = await startIssuer();
    const env = {
      ...process.env,
      SITE_MODE:
        process.env.STUDIO_TEST_SITE_MODE === 'public' ? 'public' : 'preview',
      STUDIO_DATABASE_URL: database.applicationUrl,
      ...(musicFixtures
        ? { MUSIC_PUBLIC_DATABASE_URL: database.applicationUrl, MUSIC_E2E: '1' }
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
    process.exitCode = await runScenario(env, token);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    try {
      await cleanup();
    } finally {
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', terminate);
    }
  }
  async function runScenario(
    env: NodeJS.ProcessEnv,
    token: string
  ): Promise<number> {
    const args = metrics
      ? [
          'exec',
          'tsx',
          fileURLToPath(
            new URL(
              '../../../scripts/cloudflare/preview-metrics.mts',
              import.meta.url
            )
          ),
        ]
      : [
          'exec',
          'playwright',
          'test',
          '--config',
          process.env.STUDIO_TEST_CONFIG ??
            (musicFixtures
              ? 'tests/music-admin.config.mts'
              : 'tests/studio.config.mts'),
          ...process.argv.slice(2),
        ];
    runningTests = spawn('pnpm', args, {
      env: metrics
        ? {
            ...env,
            PREVIEW_METRICS_BASE_URL: origin,
            PREVIEW_METRICS_PRIVATE_ONLY: '1',
            PREVIEW_METRICS_PRIVATE_BASE_URL: origin,
            PREVIEW_METRICS_PRIVATE_HEADERS: JSON.stringify({
              'cf-access-jwt-assertion': token,
            }),
          }
        : env,
      stdio: 'inherit',
      detached: true,
    });
    const code = await new Promise<number | null>((resolve, reject) => {
      runningTests!.once('error', reject);
      runningTests!.once('exit', resolve);
    });
    return code ?? 1;
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
    next = spawn(
      'pnpm',
      [
        'exec',
        'next',
        process.env.STUDIO_TEST_PRODUCTION === '1' ? 'start' : 'dev',
        '--port',
        String(port),
      ],
      {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      }
    );
    const preview = next;
    let spawnError: Error | undefined;
    preview.once('error', (error) => {
      spawnError = error;
    });
    let logs = '';
    for (const stream of [preview.stdout, preview.stderr])
      stream?.on('data', (chunk) => {
        logs = (logs + chunk).slice(-16000);
        if (process.env.STUDIO_TEST_VERBOSE) process.stdout.write(chunk);
      });
    const readyPath =
      env.SITE_MODE === 'public' ? '/music' : '/api/studio/documents';
    await waitForPreview();
    async function waitForPreview(): Promise<void> {
      let ready = false;
      for (let attempt = 0; attempt < 120; attempt++) {
        if (spawnError) throw spawnError;
        if (preview.exitCode !== null || preview.signalCode !== null)
          throw new Error(`Preview server exited: ${logs}`);
        try {
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
      if (!ready)
        throw new Error(`Preview server did not become ready: ${logs}`);
    }
  }
}

if (isMain(import.meta.url)) await runStudioTests();
