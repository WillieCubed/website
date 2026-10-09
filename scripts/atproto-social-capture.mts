import type {} from '@atcute/atproto';
import { Client, ok } from '@atcute/client';
import type { Did } from '@atcute/lexicons';
import type { StoredSession, StoredState } from '@atcute/oauth-node-client';
import { chromium } from '@playwright/test';
import { createPool, sql } from '@vercel/postgres';
import matter from 'gray-matter';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, createPublicKey } from 'node:crypto';
import { chmod, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs, parseEnv } from 'node:util';

import { loadOwnedAcceptanceIdentities } from './atproto-acceptance-identities.mts';
import {
  type CapturedCallback,
  callbackSignature,
  verifyCallbackSignature,
} from './atproto-callback-proof.mts';
import {
  checkNotificationWorkflow,
  externalChecks,
  recoverNotificationWorkflow,
  verifyAcceptanceVideoAccount,
} from './atproto-external-checks.mts';
import { fixtureSource } from './atproto-fixture-source.mts';
import {
  captureSocialLoading,
  captureSocialLogout,
  captureSocialState,
  recoverSocialFailures,
  socialUiFailures,
} from './atproto-social-failures.mts';

let notificationCleanup: (() => Promise<void>) | undefined;
let finalNotification: (() => Promise<void>) | undefined;

let fixtureCleanup: (() => Promise<void>) | undefined;
let sourceCleanup: (() => Promise<void>) | undefined;
let lifecycleCleanup: (() => Promise<void>) | undefined;
let publicationCleanupVerified = true;
let browserCleanupSucceeded = true;
let phase = 'input validation';
let recoveryPath = 'the selected private output directory';
async function main() {
  const ORIGIN = 'https://indieweb-acceptance.vercel.app';
  const OWNER = 'did:plc:iyn6nc3ffqm2e3555exyrgvv';
  const authorizationRevision = '3120ee12571e4b186ea85ddfd4a2862b669a396a';
  const legacySocialRevision = '9014e42aeb9c566d7952485fc40bf6137913fe5f';
  const currentSocialRevision = '7f71010c5cf37cb379681e8a0e982f159d6e2a0d';
  const hlsSocialRevision = '4d0ff1f9a76010ff429c84b9917fa6da4416297c';
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string' },
      slug: { type: 'string' },
      env: {
        type: 'string',
        default: resolve(root, '.env.standard-test.local'),
      },
      output: {
        type: 'string',
        default: resolve(
          root,
          '.playwright-mcp',
          `social-capture-${Date.now()}`
        ),
      },
      'refresh-wait-seconds': { type: 'string', default: '0' },
      'cleanup-only': { type: 'boolean', default: false },
      'defer-bluesky': { type: 'boolean', default: false },
      'authorization-only': { type: 'boolean', default: false },
      'cookie-delivery-failure': { type: 'boolean', default: false },
      'social-only': { type: 'boolean', default: false },
      'fixture-source-journal': { type: 'string' },
      'fixture-publication-journal': { type: 'string' },
      'social-runtime-revision': { type: 'string' },
    },
  });
  assert(
    !(values['defer-bluesky'] && values['cleanup-only']),
    '--defer-bluesky cannot be combined with --cleanup-only. Cleanup retains the original run scope.'
  );
  recoveryPath = values.output!;
  let authorizationOnly = values['authorization-only'];
  let socialOnly = values['social-only'];
  let socialRevision =
    values['social-runtime-revision'] ?? legacySocialRevision;
  if (values['cleanup-only']) {
    try {
      const recordedScope = JSON.parse(
        await readFile(resolve(values.output!, 'run-scope.json'), 'utf8')
      ) as {
        origin: string;
        scope: string;
        runtimeRevision?: string;
        fixtureSourceJournal?: string;
        fixturePublicationJournal?: string;
      };
      assert.equal(recordedScope.origin, ORIGIN);
      if (recordedScope.scope === 'atproto-authorization-and-subscription') {
        assert.equal(recordedScope.runtimeRevision, authorizationRevision);
        authorizationOnly = true;
      } else if (recordedScope.scope === 'real-social-only') {
        assert(
          recordedScope.runtimeRevision === legacySocialRevision ||
            recordedScope.runtimeRevision === currentSocialRevision ||
            recordedScope.runtimeRevision === hlsSocialRevision,
          'Cleanup must use an explicitly supported fixture runtime.'
        );
        if (values['social-runtime-revision'])
          assert.equal(
            values['social-runtime-revision'],
            recordedScope.runtimeRevision
          );
        socialRevision = recordedScope.runtimeRevision;
        for (const [argument, recorded] of [
          ['fixture-source-journal', recordedScope.fixtureSourceJournal],
          [
            'fixture-publication-journal',
            recordedScope.fixturePublicationJournal,
          ],
        ] as const) {
          if (recorded) {
            if (values[argument])
              assert.equal(resolve(values[argument]), recorded);
            values[argument] = recorded;
          }
        }
        socialOnly = true;
      } else
        assert(
          !authorizationOnly && !socialOnly,
          'Cleanup must retain the recorded run scope.'
        );
    } catch (error) {
      if (
        authorizationOnly ||
        socialOnly ||
        (error as NodeJS.ErrnoException).code !== 'ENOENT'
      )
        throw error;
    }
  }
  assert(
    !(socialOnly && (authorizationOnly || values['defer-bluesky'])),
    'Social-only is a separate limited scope.'
  );
  assert(
    !values['social-runtime-revision'] || socialOnly,
    '--social-runtime-revision is only valid with social-only.'
  );
  assert(
    !socialOnly ||
      socialRevision === legacySocialRevision ||
      socialRevision === currentSocialRevision ||
      socialRevision === hlsSocialRevision,
    'Social-only accepts only the exact owned fixture runtimes.'
  );
  assert(
    !values['fixture-publication-journal'] || socialOnly,
    'An external fixture publication journal is only valid with social-only.'
  );
  const fixturePublicationJournal = resolve(
    values['fixture-publication-journal'] ??
      resolve(values.output!, 'fixture-publication-journal.json')
  );
  const currentSocialFixture =
    socialOnly &&
    (socialRevision === currentSocialRevision ||
      socialRevision === hlsSocialRevision);
  assert(
    !currentSocialFixture ||
      values['cleanup-only'] ||
      values['fixture-publication-journal'],
    'The current fixture requires the actual parent publication journal.'
  );
  const existingOnly = authorizationOnly || socialOnly;
  const runtimeRevision = socialOnly ? socialRevision : authorizationRevision;
  assert(
    !socialOnly || values['cleanup-only'] || values['fixture-source-journal'],
    'Social-only requires the exact owned fixture source journal.'
  );
  assert(
    !(authorizationOnly && values['defer-bluesky']),
    '--authorization-only has its own limited scope; do not combine it with --defer-bluesky.'
  );
  assert(
    !values['cookie-delivery-failure'] || authorizationOnly,
    'The cookie delivery probe requires --authorization-only.'
  );
  assert(
    values.workspace,
    'Pass the isolated acceptance checkout with --workspace.'
  );
  assert(
    authorizationOnly ||
      (values.slug && /^[a-z0-9][a-z0-9-]{0,199}$/.test(values.slug)),
    'Pass its published fixture slug with --slug.'
  );
  const workspace = resolve(values.workspace);
  if (socialOnly && !values['cleanup-only'])
    assert.equal(
      resolve(process.cwd()),
      workspace,
      'Run the absolute capture script from the acceptance checkout because writing imports bind process.cwd().'
    );
  assert(
    /^codex\/publishing-compatibility-acceptance(?:-\d{8})?$/.test(
      execFileSync('git', ['branch', '--show-current'], {
        cwd: workspace,
        encoding: 'utf8',
      }).trim()
    ),
    'The checkout must use an acceptance branch.'
  );
  try {
    const project = JSON.parse(
      await readFile(resolve(workspace, '.vercel/project.json'), 'utf8')
    ) as { projectId: string };
    assert.equal(
      project.projectId,
      'prj_rurUFlQ4YKYKoMxGCaAyL6ASijHm',
      'Reject a checkout linked to another project.'
    );
  } catch (error) {
    if (existingOnly && (error as NodeJS.ErrnoException).code === 'ENOENT')
      throw new Error(
        'Authorization-only requires the existing verified acceptance project link.',
        { cause: error }
      );
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  async function run(
    command: string,
    args: string[],
    cwd: string,
    env = process.env
  ) {
    await new Promise<void>((finish, reject) => {
      const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
      child.on('error', reject);
      child.on('exit', (code) =>
        code === 0 ? finish() : reject(new Error(`${command} exited ${code}.`))
      );
    });
  }
  phase = 'credential setup';
  console.log('Step 1: Check the isolated checkout and existing credentials.');
  let settings: Record<string, string> = {};
  try {
    settings = Object.fromEntries(
      Object.entries(parseEnv(await readFile(values.env!, 'utf8'))).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (
    !values['cleanup-only'] &&
    !existingOnly &&
    (!settings.ATPROTO_APP_PASSWORD ||
      !settings.NEXT_PUBLIC_ATPROTO_DID ||
      settings.NEXT_PUBLIC_ATPROTO_DID === OWNER)
  ) {
    console.log(
      'Step 2: Provision the two owned acceptance identities and configure their publishing credential.'
    );
    await run(
      'pnpm',
      [
        'exec',
        'tsx',
        resolve(root, 'scripts/publishing-acceptance-setup.mts'),
        '--env',
        values.env!,
      ],
      root
    );
    settings = Object.fromEntries(
      Object.entries(parseEnv(await readFile(values.env!, 'utf8'))).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
    );
  } else
    console.log('Step 2: Reuse the existing isolated publishing credential.');
  assert(
    settings.NEXT_PUBLIC_ATPROTO_DID &&
      settings.NEXT_PUBLIC_ATPROTO_DID !== OWNER
  );
  assert.equal(settings.NEXT_PUBLIC_SITE_ORIGIN, ORIGIN);
  assert(
    settings.POSTGRES_URL && settings.ATPROTO_OAUTH_STORAGE_KEY,
    'Root must configure the matching isolated database and OAuth storage key before this run.'
  );
  if (!values['cleanup-only']) assert(settings.ATPROTO_APP_PASSWORD);
  const signingKey = JSON.parse(settings.ATPROTO_OAUTH_JWK);
  assert(
    signingKey.kty === 'EC' &&
      signingKey.crv === 'P-256' &&
      signingKey.kid &&
      signingKey.d,
    'The local signing key must be a valid private ES256 JWK.'
  );
  assert(
    /^ep-winter-wind-b5iiaxe7(?:-pooler)?\.c-7\.us-east-2\.aws\.neon\.tech$/.test(
      new URL(settings.POSTGRES_URL).hostname
    ),
    'Only the verified isolated acceptance Neon host is permitted.'
  );
  if (!values['cleanup-only'] && settings.ATPROTO_ACCEPTANCE_PROVIDER_ORIGIN)
    assert(
      settings.ATPROTO_ACCEPTANCE_IDENTITIES_JOURNAL,
      'A generated provider requires its private identity ownership journal.'
    );
  if (existingOnly)
    assert(
      settings.ATPROTO_ACCEPTANCE_IDENTITIES_JOURNAL &&
        settings.ATPROTO_ACCEPTANCE_PROVIDER_ORIGIN,
      'Authorization-only uses only the two existing journaled acceptance identities.'
    );
  Object.assign(process.env, settings);
  await recoverSocialFailures(
    values.output!,
    settings.ATPROTO_ACCEPTANCE_IDENTITIES_JOURNAL,
    settings.NEXT_PUBLIC_ATPROTO_DID
  );
  const ownedIdentities =
    !values['cleanup-only'] && settings.ATPROTO_ACCEPTANCE_IDENTITIES_JOURNAL
      ? await loadOwnedAcceptanceIdentities(
          settings.ATPROTO_ACCEPTANCE_IDENTITIES_JOURNAL,
          settings.NEXT_PUBLIC_ATPROTO_DID
        )
      : undefined;
  if (ownedIdentities) {
    assert.equal(
      ownedIdentities.origin,
      settings.ATPROTO_ACCEPTANCE_PROVIDER_ORIGIN
    );
    assert.equal(
      ownedIdentities.publisher.did,
      settings.NEXT_PUBLIC_ATPROTO_DID
    );
    assert.notEqual(ownedIdentities.visitor.did, ownedIdentities.publisher.did);
    assert.notEqual(ownedIdentities.visitor.did, OWNER);
  }
  const env = { ...process.env, ...settings };
  Object.assign(process.env, settings);
  async function verifyExistingRuntime() {
    const { resolvePds } = await import('../lib/atproto/identity');
    const { documentIsVerified, publicationIsVerified } =
      await import('../lib/atproto/verification');
    const publication = `at://${settings.NEXT_PUBLIC_ATPROTO_DID}/site.standard.publication/${settings.ATPROTO_PUBLICATION_RKEY}`;
    const pds = await resolvePds(settings.NEXT_PUBLIC_ATPROTO_DID as Did);
    assert.equal(
      new URL(pds).origin,
      settings.ATPROTO_ACCEPTANCE_PROVIDER_ORIGIN
    );
    const recordUrl = new URL('/xrpc/com.atproto.repo.getRecord', pds);
    recordUrl.search = new URLSearchParams({
      repo: settings.NEXT_PUBLIC_ATPROTO_DID,
      collection: 'site.standard.publication',
      rkey: settings.ATPROTO_PUBLICATION_RKEY,
    }).toString();
    const responses = await Promise.all([
      fetch(`${ORIGIN}/api/indieweb/revision`, {
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      }),
      fetch(`${ORIGIN}/api/atproto/social`, {
        redirect: 'error',
        signal: AbortSignal.timeout(60000),
      }),
      fetch(`${ORIGIN}/.well-known/site.standard.publication`, {
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      }),
      fetch(recordUrl, {
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      }),
    ]);
    for (const response of responses) assert.equal(response.status, 200);
    assert.equal((await responses[0].json()).sha, runtimeRevision);
    const status = await responses[1].json();
    assert(status.enabled && status.ready && !status.signedIn);
    const endpoint = await responses[2].text();
    const record = await responses[3].json();
    assert.equal(record.uri, publication);
    assert(publicationIsVerified(record.value, ORIGIN, publication, endpoint));
    let document:
      | {
          uri: string;
          cid: string;
          sourceHash: string;
          dirtyFixtureOverlay?: true;
        }
      | undefined;
    if (socialOnly) {
      assert.equal(
        values.slug,
        currentSocialFixture
          ? 'atproto-acceptance-20261009'
          : 'atproto-acceptance-20261008'
      );
      const source = JSON.parse(
        await readFile(values['fixture-source-journal']!, 'utf8')
      ) as {
        version: number;
        workspace: string;
        slug: string;
        sha256: string;
        original: string;
        removed?: boolean;
        cleanup?: string;
      };
      assert.equal(source.version, 1);
      assert.equal(source.workspace, workspace);
      assert.equal(source.slug, values.slug);
      assert.equal(
        source.sha256,
        currentSocialFixture
          ? '5a77d47542803e78d087a1e745a279b5c04ef7d1a03a7ff96009208c83ae4ba1'
          : '612bf6a27d93954fbbeea9c7ebb2b18dd83908e2278190ea8a4e79aa0732cd42'
      );
      assert.equal(
        createHash('sha256').update(source.original).digest('hex'),
        source.sha256
      );
      assert.equal(
        await readFile(
          resolve(workspace, 'content/writings', `${values.slug}.mdx`),
          'utf8'
        ),
        source.original
      );
      if (currentSocialFixture) {
        assert(source.removed === false && source.cleanup === 'pending');
        assert.equal(
          execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: workspace,
            encoding: 'utf8',
          }).trim(),
          socialRevision
        );
        for (const directory of [workspace, root]) {
          assert.equal(
            execFileSync(
              'git',
              ['diff', socialRevision, '--', 'app', 'components', 'lib'],
              {
                cwd: directory,
                encoding: 'utf8',
              }
            ),
            '',
            'The deployed runtime and both working sources must match exactly.'
          );
          assert.equal(
            execFileSync(
              'git',
              [
                'ls-files',
                '--others',
                '--exclude-standard',
                '--',
                'app',
                'components',
                'lib',
              ],
              {
                cwd: directory,
                encoding: 'utf8',
              }
            ),
            '',
            'Untracked runtime source cannot be verified against the deployment.'
          );
        }
      }
      const metadata = matter(source.original).data;
      if (currentSocialFixture)
        assert.equal(
          new Date(metadata.published).toISOString(),
          '2026-10-09T09:22:45.696Z'
        );
      assert.equal(metadata.draft, false);
      assert(!metadata.syndicateTo?.length && !metadata.syndication?.length);
      const { documentRkey } = await import('../lib/atproto/keys');
      const path = `/writings/${values.slug}`;
      const rkey = documentRkey(path, new Date(metadata.published));
      if (currentSocialFixture) assert.equal(rkey, '3mxgnm42kk26a');
      const uri = `at://${settings.NEXT_PUBLIC_ATPROTO_DID}/site.standard.document/${rkey}`;
      const url = new URL(recordUrl);
      url.searchParams.set('collection', 'site.standard.document');
      url.searchParams.set('rkey', rkey);
      const [recordResponse, pageResponse] = await Promise.all([
        fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) }),
        fetch(ORIGIN + path, {
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        }),
      ]);
      assert.equal(recordResponse.status, 200);
      assert.equal(pageResponse.status, 200);
      const writing = await recordResponse.json();
      const html = await pageResponse.text();
      assert.equal(writing.uri, uri);
      assert(
        html.includes(
          currentSocialFixture
            ? '4038d95d-3c92-408b-a144-38ecf1db490d'
            : 'c494f7f1-49f6-4e9b-ac52-7eed1fe3ecf9'
        )
      );
      assert(documentIsVerified(writing.value, publication, path, uri, html));
      if (currentSocialFixture) {
        const publishedAt = new Date(metadata.published).toISOString();
        assert.equal(writing.value.publishedAt, publishedAt);
        const { parse } = await import('parse5');
        interface HtmlNode {
          tagName?: string;
          attrs?: { name: string; value: string }[];
          childNodes?: HtmlNode[];
        }
        function hasPublishedTime(node: HtmlNode): boolean {
          const attributes = Object.fromEntries(
            (node.attrs ?? []).map((attribute) => [
              attribute.name,
              attribute.value,
            ])
          );
          return (
            (node.tagName === 'time' &&
              attributes.class?.split(/\s+/).includes('dt-published') &&
              attributes.datetime === publishedAt) ||
            (node.childNodes?.some(hasPublishedTime) ?? false)
          );
        }
        assert(
          hasPublishedTime(parse(html) as HtmlNode),
          'The hosted fixture must retain its exact published time.'
        );
      }
      const fixture = JSON.parse(
        await readFile(fixturePublicationJournal, 'utf8')
      ) as {
        version: number;
        did: string;
        publicationUri: string;
        publicationRkey: string;
        slug: string;
        publishedAt: string;
        documentRkey: string;
        expectedPath: string;
        inventoryComplete: boolean;
        cleanup: string;
        documentRemoved?: boolean;
        publicationRestored?: boolean;
        syncedPublication?: { cid: string; value: unknown };
        syncedDocument?: { cid: string; value: unknown };
      };
      assert.equal(fixture.version, 1);
      assert.equal(fixture.did, settings.NEXT_PUBLIC_ATPROTO_DID);
      assert.equal(fixture.publicationUri, publication);
      assert.equal(fixture.publicationRkey, settings.ATPROTO_PUBLICATION_RKEY);
      assert.equal(fixture.slug, values.slug);
      assert.equal(
        fixture.publishedAt,
        new Date(metadata.published).toISOString()
      );
      assert.equal(fixture.documentRkey, rkey);
      assert.equal(fixture.expectedPath, path);
      assert(fixture.inventoryComplete && fixture.cleanup === 'pending');
      assert(!fixture.documentRemoved && !fixture.publicationRestored);
      assert.equal(fixture.syncedPublication?.cid, record.cid);
      assert(isDeepStrictEqual(fixture.syncedPublication?.value, record.value));
      assert.equal(fixture.syncedDocument?.cid, writing.cid);
      assert(isDeepStrictEqual(fixture.syncedDocument?.value, writing.value));
      document = {
        uri,
        cid: writing.cid as string,
        sourceHash: source.sha256,
        ...(currentSocialFixture && { dirtyFixtureOverlay: true as const }),
      };
    }
    return {
      revision: runtimeRevision,
      ...(currentSocialFixture && { dirtyFixtureOverlay: true }),
      publication,
      cid: record.cid as string,
      ...(document && { document }),
    };
  }
  const existingRuntime =
    existingOnly && !values['cleanup-only']
      ? await verifyExistingRuntime()
      : undefined;
  const verifierPaths =
    existingOnly && !values['cleanup-only']
      ? [
          'scripts/atproto-social-capture.mts',
          'scripts/atproto-social-failures.mts',
          'scripts/atproto-acceptance-identities.mts',
          'scripts/atproto-callback-proof.mts',
          'scripts/atproto-refresh-acceptance.mts',
          'lib/site.ts',
          'lib/writings/index.ts',
          ...(await readdir(resolve(root, 'lib/atproto')))
            .filter((name) => name.endsWith('.ts'))
            .map((name) => `lib/atproto/${name}`),
        ]
      : [];
  async function verifierHashes() {
    return Object.fromEntries(
      await Promise.all(
        verifierPaths.map(async (path) => [
          path,
          createHash('sha256')
            .update(await readFile(resolve(root, path)))
            .digest('hex'),
        ])
      )
    );
  }
  const localVerifier = existingRuntime
    ? {
        revision: execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: root,
          encoding: 'utf8',
        }).trim(),
        sourceHashes: await verifierHashes(),
        deployedCode: false,
      }
    : undefined;
  // Publishing configuration reads its environment when the module loads.
  const { fixtureJournal } = await import('./atproto-fixture-journal.mts');
  async function deployAcceptance() {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: workspace,
      encoding: 'utf8',
    }).trim();
    assert(/^[a-f0-9]{40}$/.test(sha));
    await run(
      'vercel',
      [
        'deploy',
        '--prod',
        '--yes',
        '--scope',
        'williecubed-projects',
        '--project',
        'prj_rurUFlQ4YKYKoMxGCaAyL6ASijHm',
        // Direct CLI uploads do not populate the Git integration's revision.
        '--env',
        `VERCEL_GIT_COMMIT_SHA=${sha}`,
        '--build-env',
        `VERCEL_GIT_COMMIT_SHA=${sha}`,
      ],
      workspace,
      env
    );
    const revision = await fetch(`${ORIGIN}/api/indieweb/revision`, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    assert(
      revision.ok && (await revision.json()).sha === sha,
      'The CLI deployment must serve the actual acceptance checkout revision.'
    );
  }
  if (!values['cleanup-only'] && !existingOnly)
    await verifyAcceptanceVideoAccount();
  await mkdir(values.output!, { recursive: true, mode: 0o700 });
  await chmod(values.output!, 0o700);
  if (!values['cleanup-only']) {
    const scopePath = resolve(values.output!, 'run-scope.json');
    await writeFile(
      scopePath,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          origin: ORIGIN,
          publisher: settings.NEXT_PUBLIC_ATPROTO_DID,
          scope: socialOnly
            ? 'real-social-only'
            : authorizationOnly
              ? 'atproto-authorization-and-subscription'
              : values['defer-bluesky']
                ? 'standard-site-and-atproto-social'
                : 'full',
          fullVerification: 'pending',
          ...(values['cookie-delivery-failure'] && {
            probe: 'real-callback-browser-delivery-failure',
          }),
          ...(existingOnly && { runtimeRevision }),
          ...(currentSocialFixture && { dirtyFixtureOverlay: true }),
          ...(socialOnly && {
            fixtureSourceJournal: resolve(values['fixture-source-journal']!),
            fixturePublicationJournal,
          }),
          ...(localVerifier && { localVerifier }),
          checks: {
            ...(existingOnly && {
              recommendations: { status: 'pending', deferred: !socialOnly },
              socialFailureStates: { status: 'pending', deferred: !socialOnly },
              standardLifecycle: { status: 'pending', deferred: true },
              hostedRendering: { status: 'pending', deferred: true },
              independentValidation: { status: 'pending', deferred: true },
            }),
            blueskyLifecycle: {
              status: 'pending',
              deferred: existingOnly || values['defer-bluesky'],
            },
            hostedAtmosphereResponses: {
              status: 'pending',
              deferred: existingOnly || values['defer-bluesky'],
            },
          },
        },
        null,
        2
      ) + '\n',
      { mode: 0o600, flag: 'wx' }
    );
    await chmod(scopePath, 0o600);
    if (values['defer-bluesky'])
      console.log(
        'Deferred: Bluesky lifecycle and hosted Atmosphere response checks remain pending. A full run without --defer-bluesky is still required.'
      );
  }
  if (!existingOnly)
    notificationCleanup = async () => {
      await recoverNotificationWorkflow(values.output!, workspace);
      await recoverNotificationWorkflow(
        values.output!,
        workspace,
        'final-notification-workflow.json'
      );
    };
  if (!existingOnly)
    finalNotification = () =>
      checkNotificationWorkflow(
        values.output!,
        workspace,
        'final-notification-workflow.json'
      );
  const lifecycleNames = ['standard-site', 'bluesky', 'hosted-atmosphere'];
  let hasLifecycleReceipt = false;
  for (const name of lifecycleNames) {
    try {
      await readFile(resolve(values.output!, `${name}-receipt.json`), 'utf8');
      hasLifecycleReceipt = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  if (!existingOnly)
    lifecycleCleanup = async () => {
      for (const name of lifecycleNames) {
        let receipt: { cleanup: string };
        try {
          receipt = JSON.parse(
            await readFile(
              resolve(values.output!, `${name}-receipt.json`),
              'utf8'
            )
          ) as { cleanup: string };
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
          throw error;
        }
        if (receipt.cleanup === 'passed') continue;
        await run(
          'pnpm',
          [
            'exec',
            'tsx',
            resolve(
              root,
              name === 'hosted-atmosphere'
                ? 'scripts/atproto-hosted-responses.mts'
                : `scripts/${name}-acceptance.mts`
            ),
            ...(name === 'hosted-atmosphere' ? ['--slug', values.slug!] : []),
            '--env',
            values.env!,
            '--receipt',
            resolve(values.output!, `${name}-receipt.json`),
            '--cleanup',
          ],
          workspace,
          env
        );
        const cleaned = JSON.parse(
          await readFile(
            resolve(values.output!, `${name}-receipt.json`),
            'utf8'
          )
        ) as { cleanup: string };
        assert(
          cleaned.cleanup === 'passed',
          'Pending lifecycle cleanup must finish before source removal.'
        );
      }
    };
  const ownedSource = existingOnly
    ? undefined
    : await fixtureSource(
        values.output!,
        workspace,
        values.slug!,
        values['cleanup-only']
      );
  if (ownedSource)
    sourceCleanup = () =>
      ownedSource.cleanup(async () => {
        await deployAcceptance();
        const removed = await fetch(`${ORIGIN}/writings/${values.slug}`, {
          redirect: 'manual',
          signal: AbortSignal.timeout(15000),
        });
        assert(
          removed.status === 404,
          'The owned fixture must be absent from the clean acceptance deployment.'
        );
      });
  if (!values['cleanup-only'] && !existingOnly) {
    phase = 'isolated publishing lifecycle';
    console.log(
      values['defer-bluesky']
        ? 'Step 3: Verify the isolated Standard.site lifecycle and extension round trips. Bluesky lifecycle checks remain deferred and pending.'
        : 'Step 3: Verify the isolated Standard.site lifecycle and extension round trips, then real Bluesky syndication and responses.'
    );
    assert(
      /^[a-z0-9-]*acceptance[a-z0-9-]*$/.test(values.slug!),
      'Only a named disposable acceptance fixture can be temporarily excluded.'
    );
    const directory = resolve(workspace, 'content/writings');
    const fixture = resolve(directory, `${values.slug}.mdx`);
    const original = await readFile(fixture, 'utf8');
    assert(matter(original).data.draft === false);
    for (const filename of await readdir(directory)) {
      if (
        !filename.endsWith('.mdx') ||
        filename.startsWith('_') ||
        filename === `${values.slug}.mdx`
      )
        continue;
      assert(
        matter(await readFile(resolve(directory, filename), 'utf8')).data
          .draft === true,
        'Other published content exists. Refuse destructive lifecycle tests.'
      );
    }
    const temporary = original.replace(/^(draft:\s*)false\s*$/m, '$1true');
    assert(temporary !== original && matter(temporary).data.draft === true);
    await writeFile(
      resolve(values.output!, 'fixture-source-original.mdx'),
      original,
      { mode: 0o600 }
    );
    await writeFile(fixture, temporary);
    try {
      const selectedLifecycles = values['defer-bluesky']
        ? ['standard-site']
        : ['standard-site', 'bluesky'];
      for (const name of selectedLifecycles) {
        await run(
          'pnpm',
          [
            'exec',
            'tsx',
            resolve(root, `scripts/${name}-acceptance.mts`),
            '--env',
            values.env!,
            '--receipt',
            resolve(values.output!, `${name}-receipt.json`),
            '--write',
          ],
          workspace,
          env
        );
        const receipt = JSON.parse(
          await readFile(
            resolve(values.output!, `${name}-receipt.json`),
            'utf8'
          )
        ) as { cleanup: string; error?: string };
        assert(
          receipt.cleanup === 'passed' && !receipt.error,
          'Real publishing checks and exact cleanup must succeed before fixture publication.'
        );
      }
    } finally {
      assert(
        (await readFile(fixture, 'utf8')) === temporary,
        'The acceptance fixture changed during verification. Refuse to overwrite another change.'
      );
      await writeFile(fixture, original);
    }
    phase = 'acceptance deployment';
    console.log(
      'Step 4: Deploy only the isolated acceptance project with its restored fixture and current credentials.'
    );
    await deployAcceptance();
    console.log(
      'Step 5: Publish and verify the isolated fixture records after deployment.'
    );
    const fixtureMetadata = matter(
      await readFile(
        resolve(workspace, 'content/writings', `${values.slug}.mdx`),
        'utf8'
      )
    ).data;
    assert(
      !fixtureMetadata.syndicateTo?.length &&
        !fixtureMetadata.syndication?.length,
      'The social fixture must not request another public copy.'
    );
    publicationCleanupVerified = false;
    const publishing = await fixtureJournal(
      values.output!,
      values.slug!,
      new Date(fixtureMetadata.published)
    );
    fixtureCleanup = async () => {
      await publishing.observe();
      await publishing.cleanup();
    };
    try {
      await run(
        'pnpm',
        [
          'exec',
          'tsx',
          `--env-file=${values.env}`,
          resolve(root, 'scripts/atproto-sync.mts'),
          '--write',
        ],
        workspace,
        env
      );
    } finally {
      await publishing.observe();
    }
    const verification = await fetch(
      `${ORIGIN}/.well-known/site.standard.publication`,
      { redirect: 'error', signal: AbortSignal.timeout(15000) }
    );
    assert.equal(verification.status, 200);
    assert.equal(
      (await verification.text()).trim(),
      `at://${settings.NEXT_PUBLIC_ATPROTO_DID}/site.standard.publication/${settings.ATPROTO_PUBLICATION_RKEY}`
    );
    await run(
      'pnpm',
      [
        'exec',
        'tsx',
        resolve(root, 'scripts/standard-site-acceptance.mts'),
        '--env',
        values.env!,
        '--verify',
        values.slug!,
        '--receipt',
        resolve(values.output!, 'standard-site-verification.json'),
      ],
      workspace,
      env
    );
    if (!values['defer-bluesky']) {
      phase = 'hosted Atmosphere response verification';
      console.log(
        'Step 6: Publish actual Atmosphere replies and media, verify the hosted page in both themes and sizes, and prove edit, hide, restore, and deletion refresh.'
      );
      try {
        await run(
          'pnpm',
          [
            'exec',
            'tsx',
            resolve(root, 'scripts/atproto-hosted-responses.mts'),
            '--env',
            values.env!,
            '--slug',
            values.slug!,
            '--receipt',
            resolve(values.output!, 'hosted-atmosphere-receipt.json'),
          ],
          workspace,
          env
        );
        const hosted = JSON.parse(
          await readFile(
            resolve(values.output!, 'hosted-atmosphere-receipt.json'),
            'utf8'
          )
        ) as { cleanup: string; error?: string };
        assert(
          hosted.cleanup === 'passed' && !hosted.error,
          'Actual hosted response checks and cleanup must pass.'
        );
      } finally {
        const hosted = JSON.parse(
          await readFile(
            resolve(values.output!, 'hosted-atmosphere-receipt.json'),
            'utf8'
          )
        ) as { cleanup: string };
        if (hosted.cleanup === 'passed') await publishing.observe();
      }
    } else {
      console.log(
        'Step 6: Hosted Atmosphere response checks remain deferred and pending. Standard.site validation and notification workflow checks still run.'
      );
    }
    phase = 'independent validation and branch workflow';
    try {
      await externalChecks(
        values.output!,
        workspace,
        `${ORIGIN}/writings/${values.slug}`
      );
    } finally {
      await publishing.observe();
    }
  }
  if (values['cleanup-only'] && !existingOnly) {
    try {
      await readFile(
        resolve(values.output!, 'fixture-publication-journal.json'),
        'utf8'
      );
      publicationCleanupVerified = false;
      const publishing = await fixtureJournal(
        values.output!,
        values.slug!,
        undefined,
        true
      );
      fixtureCleanup = async () => {
        await publishing.observe();
        await publishing.cleanup();
      };
      try {
        await readFile(
          resolve(values.output!, 'cleanup-ownership.json'),
          'utf8'
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw error;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  if (
    values['cleanup-only'] &&
    (sourceCleanup || fixtureCleanup || hasLifecycleReceipt)
  ) {
    try {
      await readFile(resolve(values.output!, 'cleanup-ownership.json'), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
  }
  if (values['cleanup-only']) {
    browserCleanupSucceeded = false;
    let completed:
      | {
          status: string;
          pending: string[];
          owned: OwnedBrowser[];
        }
      | undefined;
    try {
      completed = JSON.parse(
        await readFile(resolve(values.output!, 'capture-cleanup.json'), 'utf8')
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (completed?.status === 'passed' && completed.pending.length === 0) {
      const journal = JSON.parse(
        await readFile(
          resolve(values.output!, 'cleanup-ownership.json'),
          'utf8'
        )
      ) as { origin: string; publisher: string; owned: typeof completed.owned };
      assert(
        journal.origin === ORIGIN &&
          journal.publisher === settings.NEXT_PUBLIC_ATPROTO_DID
      );
      assert.deepEqual(completed.owned, journal.owned);
      const terminalDb = createPool({
        connectionString: settings.POSTGRES_URL,
        max: 1,
      });
      try {
        if (existingOnly) {
          const baseline = JSON.parse(
            await readFile(
              resolve(values.output!, 'authorization-baseline.json'),
              'utf8'
            )
          ) as AuthorizationBaseline;
          assert.equal(baseline.origin, ORIGIN);
          assert.equal(baseline.publisher, settings.NEXT_PUBLIC_ATPROTO_DID);
          assert.equal(baseline.runtimeRevision, runtimeRevision);
          await assertBaselineDatabase(baseline, terminalDb);
          assert.deepEqual(await visitorGraphs(), baseline.graphs);
        }
        const { resolvePds } = await import('../lib/atproto/identity');
        for (const owner of journal.owned) {
          assert(
            owner.did !== OWNER && /^[a-f0-9]{64}$/.test(owner.sessionHash)
          );
          assert(
            owner.inventoryComplete &&
              owner.recordsClean &&
              (!owner.grantCreated || owner.grantRevoked)
          );
          assert(
            (
              await terminalDb.sql`SELECT token_hash FROM atproto_browser_sessions WHERE token_hash = ${owner.sessionHash}`
            ).rows.length === 0
          );
          const pds = await resolvePds(owner.did as Did);
          for (const record of owner.records) {
            const uri =
              /^at:\/\/(did:[^/]+)\/(site\.standard\.graph\.(subscription|recommend))\/([^/]+)$/.exec(
                record.uri
              );
            assert(uri && uri[1] === owner.did);
            const url = new URL('/xrpc/com.atproto.repo.getRecord', pds);
            url.search = new URLSearchParams({
              repo: owner.did,
              collection: uri[2],
              rkey: uri[4],
            }).toString();
            const response = await fetch(url, {
              redirect: 'error',
              signal: AbortSignal.timeout(15000),
            });
            assert(
              response.status === 400 &&
                (await response.json()).error === 'RecordNotFound'
            );
          }
        }
      } finally {
        await terminalDb.end();
      }
      const { unlink } = await import('node:fs/promises');
      const completedPending: {
        stateHash: string;
        responseSessionHash?: string;
        did: string;
        dpopSpkiSha256: string;
      }[] = [];
      try {
        const ledger = JSON.parse(
          await readFile(resolve(values.output!, 'pending-grants.json'), 'utf8')
        );
        assert(
          ledger.origin === ORIGIN &&
            ledger.publisher === settings.NEXT_PUBLIC_ATPROTO_DID &&
            Array.isArray(ledger.pending)
        );
        for (const intent of ledger.pending) {
          assert(/^[a-f0-9]{64}$/.test(intent.stateHash));
          assert(
            journal.owned.some(
              (owner) =>
                owner.did === intent.did &&
                owner.sessionHash === intent.responseSessionHash &&
                owner.dpopSpkiSha256 === intent.dpopSpkiSha256 &&
                owner.grantRevoked &&
                owner.inventoryComplete &&
                owner.recordsClean
            )
          );
          completedPending.push(intent);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      for (const name of [
        ...completedPending.map(
          (intent) => `pending-callback-${intent.stateHash}.json`
        ),
        ...journal.owned
          .filter((owner) => owner.grantRevoked && !owner.dpopSpkiSha256)
          .map(
            (owner) =>
              `provider-grant-${createHash('sha256').update(owner.did).digest('hex')}.json`
          ),
        'cleanup-credentials.json',
        'cookies-primary.json',
        'cookies-second.json',
        'callback-primary.json',
        'callback-second.json',
        'callback-cancelled.json',
        'callback-cancelled-signed-out.json',
        'callback-expired.json',
      ])
        await unlink(resolve(values.output!, name)).catch(
          (error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
          }
        );
      if (completedPending.length) {
        try {
          const probe = JSON.parse(
            await readFile(
              resolve(values.output!, 'cookie-delivery-receipt.json'),
              'utf8'
            )
          );
          assert(
            probe.scope === 'real-callback-browser-delivery-failure' &&
              probe.actualCallbackStatus === 303 &&
              probe.browserSessionAbsent &&
              probe.providerGrantBoundToIssuedState &&
              probe.browserRowBoundToActualResponse &&
              probe.actualSubscriptionPresent &&
              completedPending.some(
                (intent) =>
                  intent.did === probe.did &&
                  intent.stateHash === probe.stateHash &&
                  intent.dpopSpkiSha256 === probe.dpopSpkiSha256
              )
          );
          await save('cookie-delivery-receipt.json', {
            ...probe,
            status: 'passed',
            exactLocalCleanup: true,
            providerRevocation: 'External provider inventory remains required.',
          });
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }
      browserCleanupSucceeded = true;
      return;
    }
  }
  phase = 'browser authorization';
  console.log(
    values['cleanup-only']
      ? 'Step 9: Recover only records and grants in the private ownership ledger.'
      : ownedIdentities
        ? 'Step 9: Open isolated browsers and authorize only the journaled generated accounts on their official PDS.'
        : 'Step 9: Open an isolated browser and complete authorization manually for the existing test provider.'
  );
  await mkdir(values.output!, { recursive: true, mode: 0o700 });
  await chmod(values.output!, 0o700);
  const browser = await chromium.launch({
    headless: values['cleanup-only'] || Boolean(ownedIdentities),
  });
  browserCleanupSucceeded = false;
  const { first, second, db, decryptOAuthValue, terminal } =
    await (async () => {
      let setupDb: ReturnType<typeof createPool> | undefined;
      let setupTerminal: ReturnType<typeof createInterface> | undefined;
      try {
        const first = await browser.newContext({
          viewport: { width: 1440, height: 1000 },
        });
        const second = await browser.newContext({
          viewport: { width: 1440, height: 1000 },
        });
        setupDb = createPool({
          connectionString: settings.POSTGRES_URL,
          max: 2,
        });
        const { decryptOAuthValue } =
          await import('../lib/atproto/oauth-crypto');
        setupTerminal = createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        return {
          first,
          second,
          db: setupDb,
          decryptOAuthValue,
          terminal: setupTerminal,
        };
      } catch (error) {
        setupTerminal?.close();
        const cleanup = await Promise.allSettled([
          browser.close(),
          ...(setupDb ? [setupDb.end()] : []),
        ]);
        browserCleanupSucceeded = cleanup.every(
          (result) => result.status === 'fulfilled'
        );
        const path = resolve(values.output!, 'browser-setup-cleanup.json');
        await writeFile(
          path,
          JSON.stringify(
            {
              observedAt: new Date().toISOString(),
              phase: 'browser setup',
              status: browserCleanupSucceeded ? 'passed' : 'pending',
              resources: cleanup.map((result, index) => ({
                name: index === 0 ? 'browser' : 'database pool',
                status: result.status,
              })),
              authorizationStarted: false,
            },
            null,
            2
          ) + '\n',
          { mode: 0o600 }
        );
        await chmod(path, 0o600);
        throw error;
      }
    })();
  const hash = (value: string) =>
    createHash('sha256').update(value).digest('hex');
  async function save(name: string, value: unknown) {
    const path = resolve(values.output!, name);
    await writeFile(path, JSON.stringify(value, null, 2) + '\n', {
      mode: 0o600,
    });
    await chmod(path, 0o600);
    return path;
  }
  async function recordOperationFailure(error: unknown) {
    try {
      await writeFile(
        resolve(values.output!, 'capture-operation-failure.json'),
        JSON.stringify(
          {
            phase,
            observedAt: new Date().toISOString(),
            name: error instanceof Error ? error.name : 'UnknownError',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          null,
          2
        ) + '\n',
        { mode: 0o600, flag: 'wx' }
      );
    } catch (failure) {
      if ((failure as NodeJS.ErrnoException).code !== 'EEXIST') throw failure;
    }
  }
  async function resolveHandle(handle: string) {
    if (ownedIdentities) {
      const verified = await loadOwnedAcceptanceIdentities(
        ownedIdentities.journalPath,
        settings.NEXT_PUBLIC_ATPROTO_DID
      );
      const account = [verified.publisher, verified.visitor].find(
        (account) => account.handle === handle
      );
      assert(
        account,
        'Only a bidirectionally verified owned handle is permitted.'
      );
      return account.did;
    }
    const response = await fetch(
      `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
      { signal: AbortSignal.timeout(15000) }
    );
    assert(response.ok, 'Account handle could not be resolved.');
    const record = (await response.json()) as { did: string };
    assert(
      record.did && record.did !== OWNER,
      'Never authorize the production owner.'
    );
    return record.did;
  }
  async function graphFor(
    did: string,
    action: 'subscription' | 'recommendation' = 'subscription',
    targetOnly = true
  ) {
    const { resolvePds } = await import('../lib/atproto/identity');
    const url = new URL(
      '/xrpc/com.atproto.repo.listRecords',
      await resolvePds(did as import('@atcute/lexicons').Did)
    );
    const collection =
      action === 'subscription'
        ? 'site.standard.graph.subscription'
        : 'site.standard.graph.recommend';
    const field = action === 'subscription' ? 'publication' : 'document';
    let target = `at://${settings.NEXT_PUBLIC_ATPROTO_DID}/site.standard.publication/${settings.ATPROTO_PUBLICATION_RKEY}`;
    if (action === 'recommendation' && targetOnly) {
      const { loadWriting } = await import('../lib/writings');
      const { documentRkey } = await import('../lib/atproto/keys');
      const { writing } = await loadWriting(values.slug!);
      assert(!writing.draft);
      target = `at://${settings.NEXT_PUBLIC_ATPROTO_DID}/site.standard.document/${documentRkey(`/writings/${values.slug}`, writing.published)}`;
    }
    const records: {
      uri: string;
      cid: string;
      value: Record<string, unknown>;
    }[] = [];
    let cursor: string | undefined;
    const cursors = new Set<string>();
    do {
      url.search = new URLSearchParams({
        repo: did,
        collection,
        limit: '100',
        ...(cursor && { cursor }),
      }).toString();
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        redirect: 'error',
      });
      assert(response.ok);
      const page = (await response.json()) as {
        records: typeof records;
        cursor?: string;
      };
      records.push(
        ...page.records.filter(
          (record) => !targetOnly || record.value[field] === target
        )
      );
      cursor = page.cursor;
      if (cursor) {
        assert(
          !cursors.has(cursor),
          'Public PDS pagination repeated its cursor.'
        );
        cursors.add(cursor);
      }
    } while (cursor);
    return records;
  }
  interface OwnedBrowser {
    did: string;
    sessionHash: string;
    grantCreated: boolean;
    inventoryComplete: boolean;
    pendingMutation?: {
      kind: 'subscription' | 'recommendation';
      before: { uri: string; cid: string }[];
      dispatchedAt?: string;
      responseCompletedAt?: string;
      quiescedAt?: string;
      target: string;
    };
    recordsClean?: boolean;
    grantRevoked?: boolean;
    dpopSpkiSha256?: string;
    sessionSource?: 'callback-response';
    records: {
      uri: string;
      cid: string;
      kind: 'subscription' | 'recommendation';
      target: string;
    }[];
  }
  const ownership: OwnedBrowser[] = [];
  const browserTokens = new Map<string, string>();
  async function settleUiMutation(owner: OwnedBrowser) {
    const intent = owner.pendingMutation;
    assert(
      intent &&
        intent.target.startsWith(
          `at://${settings.NEXT_PUBLIC_ATPROTO_DID}/site.standard.`
        )
    );
    if (!intent.dispatchedAt || intent.responseCompletedAt) return;
    assert.equal(
      new Date(intent.dispatchedAt).toISOString(),
      intent.dispatchedAt
    );
    // A client timeout does not cancel the deployed 60-second mutation handler.
    const until = Date.parse(intent.dispatchedAt) + 130000;
    while (Date.now() < until)
      await new Promise<void>((done) =>
        setTimeout(done, Math.min(10000, until - Date.now()))
      );
    const { withOAuthLock } = await import('../lib/atproto/oauth-storage');
    await withOAuthLock(
      `social:${owner.did}:${intent.kind}:${intent.target}`,
      async () => {
        const current = await graphFor(owner.did, intent.kind);
        assert(
          current.length <= 1,
          'Ambiguous matching records require manual recovery.'
        );
        for (const before of intent.before) {
          const record = current.find((value) => value.uri === before.uri);
          if (record)
            assert.equal(
              record.cid,
              before.cid,
              'A prior record changed outside the owned mutation.'
            );
        }
        for (const record of current) {
          const known = owner.records.find((value) => value.uri === record.uri);
          if (known)
            assert.equal(
              record.cid,
              known.cid,
              'An owned record changed outside this run.'
            );
          else
            throw new Error(
              'A timed-out mutation produced an unjournaled matching record. Preserve the intent and credentials; refuse adoption or revocation.'
            );
        }
      }
    );
    intent.quiescedAt = new Date().toISOString();
    await journalOwnership();
  }

  type PendingGrant = {
    did: string;
    stateHash: string;
    flowHash: string;
    encryptedStateHash: string;
    dpopSpkiSha256: string;
    issuer: string;
    audience: string;
    kind: 'subscription' | 'recommendation';
    beforeRecords: { uri: string; cid: string }[];
    beforeBrowsers: string[];
    priorGrantKeys: string[];
    callbackCompleted?: boolean;
    responseSessionHash?: string;
  };
  const pendingGrants: PendingGrant[] = [];
  const deliveryWithheld = new Error(
    'The real callback response was withheld.'
  );
  let deliveryFailureObserved = false;
  const publicDpopHash = (key: StoredState['dpopKey']) =>
    createHash('sha256')
      .update(
        createPublicKey({ key, format: 'jwk' }).export({
          format: 'der',
          type: 'spki',
        })
      )
      .digest('hex');
  async function journalPendingGrants() {
    await save('pending-grants.json', {
      origin: ORIGIN,
      publisher: settings.NEXT_PUBLIC_ATPROTO_DID,
      pending: pendingGrants,
    });
  }
  function assertGrantBinding(intent: PendingGrant, stored: StoredSession) {
    assert.equal(stored.tokenSet.sub, intent.did);
    assert.equal(stored.tokenSet.iss, intent.issuer);
    assert.equal(new URL(stored.tokenSet.aud).href, intent.audience);
    assert.equal(publicDpopHash(stored.dpopKey), intent.dpopSpkiSha256);
  }
  async function recoverPendingGrant(intent: PendingGrant) {
    const identities =
      ownedIdentities ??
      (await loadOwnedAcceptanceIdentities(
        settings.ATPROTO_ACCEPTANCE_IDENTITIES_JOURNAL,
        settings.NEXT_PUBLIC_ATPROTO_DID
      ));
    assert.deepEqual(intent.priorGrantKeys, []);
    assert(
      intent.kind === 'subscription' &&
        intent.did === identities.publisher.did &&
        intent.issuer === identities.origin &&
        intent.audience === new URL(identities.origin).href &&
        [
          intent.stateHash,
          intent.flowHash,
          intent.encryptedStateHash,
          intent.dpopSpkiSha256,
        ].every((value) => /^[a-f0-9]{64}$/.test(value)) &&
        intent.beforeRecords.length === 0 &&
        authorizationStates.some(
          (state) =>
            state.key === intent.stateHash &&
            state.did === intent.did &&
            state.flowHash === intent.flowHash &&
            state.encryptedHash === intent.encryptedStateHash
        ),
      'Pending grant must match this run’s preexchange state and isolated provider.'
    );
    const terminal = ownership.find(
      (owner) => owner.sessionHash === intent.responseSessionHash
    );
    if (terminal?.grantRevoked) {
      assert(
        terminal.recordsClean &&
          terminal.inventoryComplete &&
          terminal.dpopSpkiSha256 === intent.dpopSpkiSha256
      );
      return;
    }
    assert(
      [identities.publisher.did, identities.visitor.did].includes(intent.did)
    );
    if (authorizationBaseline)
      assert(
        !authorizationBaseline.database.grants.some(
          (row) => row.key === hash(intent.did)
        )
      );
    if (!intent.callbackCompleted) {
      const completed = JSON.parse(
        await readFile(
          resolve(values.output!, `pending-callback-${intent.stateHash}.json`),
          'utf8'
        )
      ) as {
        callbackCompleted: boolean;
        stateHash: string;
        actualStatus: number;
        setCookie: string;
      };
      assert(
        completed.callbackCompleted &&
          completed.stateHash === intent.stateHash &&
          completed.actualStatus === 303
      );
      const token = completed.setCookie.match(
        /^atproto_session=([a-f0-9]{64})(?:;|$)/
      )?.[1];
      assert(token);
      intent.callbackCompleted = true;
      intent.responseSessionHash = hash(token);
      await journalPendingGrants();
    }
    const stored =
      await db.sql`SELECT encrypted_value FROM atproto_oauth_sessions WHERE key_hash = ${hash(intent.did)}`;
    assert(stored.rows.length <= 1);
    if (stored.rows.length)
      assertGrantBinding(
        intent,
        decryptOAuthValue<StoredSession>(
          stored.rows[0].encrypted_value as string,
          settings.ATPROTO_OAUTH_STORAGE_KEY
        )
      );
    assert(
      intent.callbackCompleted && intent.responseSessionHash,
      'An unfinished callback or missing server response cannot authorize browser/record cleanup.'
    );
    const known = ownership.find(
      (owner) => owner.sessionHash === intent.responseSessionHash
    );
    if (known) assert.equal(known.dpopSpkiSha256, intent.dpopSpkiSha256);
    if (known?.inventoryComplete && stored.rows.length) return;
    const actual = JSON.parse(
      await readFile(
        resolve(values.output!, `pending-callback-${intent.stateHash}.json`),
        'utf8'
      )
    ) as { setCookie: string };
    const token = actual.setCookie.match(
      /^atproto_session=([a-f0-9]{64})(?:;|$)/
    )?.[1];
    assert(token && hash(token) === intent.responseSessionHash);
    assert(!intent.beforeBrowsers.includes(intent.responseSessionHash));
    const browserRow =
      await db.sql`SELECT did FROM atproto_browser_sessions WHERE token_hash = ${intent.responseSessionHash}`;
    assert(
      browserRow.rows.length === 1 || (known && browserRow.rows.length === 0)
    );
    if (browserRow.rows.length)
      assert.equal(browserRow.rows[0].did, intent.did);
    const owner: OwnedBrowser = known ?? {
      did: intent.did,
      sessionHash: intent.responseSessionHash,
      grantCreated: true,
      dpopSpkiSha256: intent.dpopSpkiSha256,
      sessionSource: 'callback-response',
      inventoryComplete: false,
      records: [],
    };
    if (!known) ownership.push(owner);
    browserTokens.set(owner.sessionHash, token);
    await journalOwnership();
    owner.records = (await graphFor(intent.did, intent.kind))
      .filter(
        (record) =>
          !intent.beforeRecords.some((before) => before.uri === record.uri)
      )
      .map((record) => ({
        uri: record.uri,
        cid: record.cid,
        kind: intent.kind,
        target: record.value[
          intent.kind === 'subscription' ? 'publication' : 'document'
        ] as string,
      }));
    owner.inventoryComplete = true;
    await journalOwnership();
  }
  async function databaseInventory(pool = db) {
    const rows = await Promise.all([
      pool.sql`SELECT * FROM atproto_oauth_states`,
      pool.sql`SELECT * FROM atproto_oauth_sessions`,
      pool.sql`SELECT * FROM atproto_browser_sessions`,
    ]);
    return Object.fromEntries(
      rows.map((result, index) => [
        ['states', 'grants', 'browsers'][index],
        result.rows
          .map((row) => ({
            key: (row.key_hash ?? row.token_hash) as string,
            rowHash: createHash('sha256')
              .update(
                JSON.stringify(
                  Object.fromEntries(
                    Object.entries(row).sort(([a], [b]) => a.localeCompare(b))
                  )
                )
              )
              .digest('hex'),
          }))
          .sort((a, b) => a.key.localeCompare(b.key)),
      ])
    );
  }
  async function visitorGraphs() {
    const { publisher, visitor } = await loadOwnedAcceptanceIdentities(
      settings.ATPROTO_ACCEPTANCE_IDENTITIES_JOURNAL,
      settings.NEXT_PUBLIC_ATPROTO_DID
    );
    return (
      await Promise.all(
        [publisher.did, visitor.did].flatMap((did) =>
          (['subscription', 'recommendation'] as const).map((kind) =>
            graphFor(did, kind, false)
          )
        )
      )
    )
      .flat()
      .sort((a, b) => a.uri.localeCompare(b.uri));
  }
  type AuthorizationBaseline = {
    origin: string;
    publisher: string;
    runtimeRevision: string;
    database: Awaited<ReturnType<typeof databaseInventory>>;
    graphs: Awaited<ReturnType<typeof visitorGraphs>>;
    expiredStates: { key: string; expiresAt: string; rowHash: string }[];
  };
  async function assertBaselineDatabase(
    baseline: AuthorizationBaseline,
    pool = db
  ) {
    const current = await databaseInventory(pool);
    const expected = {
      ...baseline.database,
      states: baseline.database.states.filter(
        (row) =>
          !baseline.expiredStates.some((expired) => expired.key === row.key) ||
          current.states.some((present) => present.key === row.key)
      ),
    };
    assert.deepEqual(current, expected);
    return baseline.expiredStates.filter(
      (row) => !current.states.some((present) => present.key === row.key)
    );
  }
  let authorizationBaseline: AuthorizationBaseline | undefined;
  const authorizationStates: {
    key: string;
    did: string;
    encryptedHash: string;
    flowHash: string;
  }[] = [];
  async function verifyAuthorizationOnly(
    granted: Awaited<ReturnType<typeof flow>>,
    grantedSecond: Awaited<ReturnType<typeof flow>>,
    cancelled: Awaited<ReturnType<typeof flow>>,
    expired: Awaited<ReturnType<typeof flow>>,
    signedOutCancellation: Awaited<ReturnType<typeof flow>>
  ) {
    assert(existingRuntime && localVerifier && authorizationBaseline);
    const receipt = {
      scope: 'atproto-authorization-and-subscription',
      started: new Date().toISOString(),
      runtime: existingRuntime,
      localVerifier,
      status: 'running',
      fullVerification: 'pending',
      pending: [
        'Recommendation writes, undo and failure states require a published disposable writing.',
        'The complete social failure, expired-browser-session and lost-response suite remains pending.',
        'Hosted Atmosphere response rendering and the full combined verification remain pending.',
      ],
      checks: [] as { name: string; details?: unknown }[],
    };
    const receiptName = 'authorization-receipt.json';
    async function checked(name: string, details?: unknown) {
      receipt.checks.push({ name, details });
      await save(receiptName, receipt);
      console.log(`Passed: ${name}.`);
    }
    await save(receiptName, receipt);
    const contexts = [first, second];
    const grants = [granted, grantedSecond];
    const visitors: string[] = [];
    for (const [index, result] of grants.entries()) {
      const cookies = await contexts[index].cookies(ORIGIN);
      const cookie = cookies.find((entry) => entry.name === 'atproto_session');
      assert(cookie && /^[a-f0-9]{64}$/.test(cookie.value));
      assert(cookie.secure && cookie.httpOnly && cookie.sameSite === 'Lax');
      assert.equal(cookie.path, '/');
      assert.equal(cookie.domain.replace(/^\./, ''), new URL(ORIGIN).hostname);
      assert.equal(hash(cookie.value), result.grant.sessionHash);
      const browserRow =
        await db.sql`SELECT did FROM atproto_browser_sessions WHERE token_hash = ${hash(cookie.value)} AND expires_at > NOW()`;
      assert.equal(browserRow.rows.length, 1);
      assert.equal(browserRow.rows[0].did, result.grant.did);
      visitors.push(result.grant.did);
      const stored =
        await db.sql`SELECT encrypted_value FROM atproto_oauth_sessions WHERE key_hash = ${hash(result.grant.did)} AND expires_at > NOW()`;
      assert.equal(stored.rows.length, 1);
      const tokens = decryptOAuthValue<StoredSession>(
        stored.rows[0].encrypted_value as string,
        settings.ATPROTO_OAUTH_STORAGE_KEY
      ).tokenSet;
      assert.equal(tokens.sub, result.grant.did);
      assert.equal(tokens.token_type, 'DPoP');
      assert.equal(tokens.iss, settings.ATPROTO_ACCEPTANCE_PROVIDER_ORIGIN);
      const { resolvePds } = await import('../lib/atproto/identity');
      assert.equal(
        new URL(tokens.aud).href,
        new URL(await resolvePds(result.grant.did as Did)).href
      );
      assert(tokens.scope.split(/\s+/).includes('atproto'));
      const scopes = tokens.scope.split(/\s+/);
      const graphScope = scopes.find((scope) => scope.startsWith('repo?'));
      const grantedCollections = graphScope
        ? new URLSearchParams(graphScope.slice('repo?'.length))
            .getAll('collection')
            .sort()
        : [];
      assert(
        scopes.includes('include:site.standard.authSocial') ||
          JSON.stringify(grantedCollections) ===
            JSON.stringify([
              'site.standard.graph.recommend',
              'site.standard.graph.subscription',
            ]),
        'The provider must grant both Standard.site social collections.'
      );
      const records = await graphFor(result.grant.did);
      assert.equal(records.length, 1);
      assert.equal(records[0].uri, result.ownedSocialRecords[0].uri);
      assert.equal(records[0].cid, result.ownedSocialRecords[0].cid);
      const state = await contexts[index].request.get(
        `${ORIGIN}/api/atproto/social`
      );
      assert.equal(state.status(), 200);
      const status = await state.json();
      assert(
        status.enabled && status.ready && status.signedIn && status.subscribed
      );
      await checked(
        'Normal Subscribe UI authorization creates the expected visitor subscription and real DPoP grant',
        {
          visitor: result.grant.did,
          uri: records[0].uri,
          cid: records[0].cid,
          issuer: tokens.iss,
          audience: tokens.aud,
          scope: tokens.scope,
        }
      );
    }
    assert.notEqual(visitors[0], visitors[1]);
    assert.notEqual(granted.grant.sessionHash, grantedSecond.grant.sessionHash);
    const metadata = await fetch(`${ORIGIN}/oauth-client-metadata.json`, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(metadata.status, 200);
    assert.equal(
      (await metadata.json()).scope,
      'atproto include:site.standard.authSocial'
    );
    for (const result of [
      granted,
      grantedSecond,
      cancelled,
      expired,
      signedOutCancellation,
    ]) {
      const proof = JSON.parse(
        await readFile(result.file, 'utf8')
      ) as CapturedCallback;
      verifyCallbackSignature(proof, settings.ATPROTO_OAUTH_STORAGE_KEY);
      assert.equal(proof.visitor, result.grant.did);
      assert.equal(proof.sessionHash, result.grant.sessionHash);
      assert.equal(
        (
          await db.sql`SELECT key_hash FROM atproto_oauth_states WHERE key_hash = ${proof.stateHash}`
        ).rows.length,
        0
      );
      await checked(
        'The genuine provider flow passes its callback, browser-binding, session and graph assertions',
        {
          visitor: proof.visitor,
          expectation: proof.expectation,
          outcome: proof.outcome,
          stateHash: proof.stateHash,
          wrongBrowserRejected: proof.wrongBrowserRejected,
          sessionCookie:
            result === signedOutCancellation ? 'absent' : 'present',
          expirySource: proof.expirySource,
        }
      );
    }
    const proof = JSON.parse(
      await readFile(granted.file, 'utf8')
    ) as CapturedCallback;
    const beforeDatabase = await databaseInventory();
    const beforeGraphs = await visitorGraphs();
    const replay = await fetch(proof.url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(60000),
      headers: { cookie: `atproto_flow=${proof.flowCookie}` },
    });
    assert.equal(replay.status, 303);
    assert.equal(
      replay.headers.get('location'),
      ORIGIN + '/writings?atprotoError=1'
    );
    assert(
      !replay.headers
        .getSetCookie()
        .some((entry) => entry.startsWith('atproto_session='))
    );
    assert.deepEqual(await databaseInventory(), beforeDatabase);
    assert.deepEqual(await visitorGraphs(), beforeGraphs);
    await checked(
      'The consumed real grant callback rejects replay without changing either visitor graph or database inventory'
    );
    async function refreshInstance() {
      return new Promise<Record<string, unknown>>((finish, reject) => {
        let stdout = '';
        let timedOut = false;
        const child = spawn(
          process.execPath,
          [
            resolve(root, 'node_modules/tsx/dist/cli.mjs'),
            resolve(root, 'scripts/atproto-refresh-acceptance.mts'),
            '--env',
            resolve(values.env!),
            '--visitor',
            visitors[0],
          ],
          { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] }
        );
        child.stdout.on('data', (chunk: Buffer) => {
          stdout += chunk.toString();
        });
        child.stderr.on('data', () => {});
        const timeout = setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
        }, 120000);
        const killTimeout = setTimeout(() => {
          timedOut = true;
          child.kill('SIGKILL');
        }, 125000);
        child.on('error', (error) => {
          clearTimeout(timeout);
          clearTimeout(killTimeout);
          reject(error);
        });
        child.on('close', (code) => {
          clearTimeout(timeout);
          clearTimeout(killTimeout);
          if (timedOut || code !== 0)
            return reject(
              new Error(
                'A real refresh process failed or exceeded its deadline; credentials remain private.'
              )
            );
          try {
            const result = JSON.parse(stdout.trim()) as Record<string, unknown>;
            assert.equal(result.status, 'passed');
            assert.equal(result.visitor, visitors[0]);
            assert(
              result.providerRefresh &&
                result.authenticatedPdsRead &&
                result.accessGenerationChanged
            );
            finish(result);
          } catch (error) {
            reject(error);
          }
        });
      });
    }
    const refreshes = await Promise.allSettled([
      refreshInstance(),
      refreshInstance(),
    ]);
    const instances = refreshes.map((result) => {
      if (result.status === 'rejected') throw result.reason;
      return result.value;
    });
    assert.notEqual(instances[0].pid, instances[1].pid);
    await checked(
      'Two independent processes force real provider refresh and authenticate a PDS read under distributed locks',
      { instances, forcedRefresh: true, naturalExpiry: false }
    );
    const secondBefore = await visitorGraphs();
    const undo = await first.request.delete(
      `${ORIGIN}/api/atproto/subscription`,
      { headers: { origin: ORIGIN }, data: {} }
    );
    assert.equal(undo.status(), 200);
    assert.equal((await undo.json()).active, false);
    assert.equal((await graphFor(visitors[0])).length, 0);
    assert.deepEqual(
      (await visitorGraphs()).filter((record) =>
        record.uri.startsWith(`at://${visitors[1]}/`)
      ),
      secondBefore.filter((record) =>
        record.uri.startsWith(`at://${visitors[1]}/`)
      )
    );
    const secondStatus = await second.request.get(
      `${ORIGIN}/api/atproto/social`
    );
    assert.equal(secondStatus.status(), 200);
    assert((await secondStatus.json()).subscribed);
    await checked(
      'Primary subscription undo is confirmed on its real PDS and preserves the second visitor graph'
    );
    for (const [index, context] of contexts.entries()) {
      if (index === 1) {
        const response = await context.request.delete(
          `${ORIGIN}/api/atproto/subscription`,
          { headers: { origin: ORIGIN }, data: {} }
        );
        assert.equal(response.status(), 200);
        assert.equal((await response.json()).active, false);
        assert.equal((await graphFor(visitors[index])).length, 0);
      }
      await grants[index].page.reload();
      await grants[index].page
        .getByRole('button', { name: 'Subscribe', exact: true })
        .waitFor();
      await captureSocialState(
        grants[index].page,
        values.output!,
        `subscription-undone-${index + 1}`
      );
      const ended = await context.request.post(`${ORIGIN}/api/atproto/logout`, {
        headers: { origin: ORIGIN },
        data: {},
      });
      assert.equal(ended.status(), 200);
      assert(
        !(await context.cookies(ORIGIN)).some(
          (cookie) => cookie.name === 'atproto_session'
        )
      );
      const status = await context.request.get(`${ORIGIN}/api/atproto/social`);
      assert.equal(status.status(), 200);
      assert.equal((await status.json()).signedIn, false);
      if (index === 0) {
        const isolated = await second.request.get(
          `${ORIGIN}/api/atproto/social`
        );
        assert.equal(isolated.status(), 200);
        const other = await isolated.json();
        assert(other.signedIn && other.subscribed);
      }
      await grants[index].page.reload();
      await grants[index].page
        .getByRole('button', { name: 'Subscribe', exact: true })
        .waitFor();
      await captureSocialState(
        grants[index].page,
        values.output!,
        `signed-out-subscription-${index + 1}`
      );
    }
    assert.deepEqual(await visitorGraphs(), authorizationBaseline.graphs);
    assert.deepEqual(await verifyExistingRuntime(), existingRuntime);
    assert.deepEqual(await verifierHashes(), localVerifier.sourceHashes);
    await checked(
      'Both real subscriptions are undone and isolated browser sign-out preserves the other account'
    );
    receipt.status = 'passed';
    await save(receiptName, receipt);
    console.log(
      'Limited authorization and subscription checks passed. Recommendations, hosted rendering and full verification remain pending. Exact owned cleanup follows.'
    );
  }
  async function journalOwnership() {
    await save('cleanup-ownership.json', {
      origin: ORIGIN,
      publisher: settings.NEXT_PUBLIC_ATPROTO_DID,
      owned: ownership,
    });
    await save('cleanup-credentials.json', {
      browserTokens: Object.fromEntries(browserTokens),
    });
  }
  async function authorizeOwnedProvider(
    page: Awaited<ReturnType<typeof first.newPage>>,
    identity: NonNullable<typeof ownedIdentities>['publisher'],
    providerOrigin: string,
    expectation: 'grant' | 'cancel' | 'expired'
  ) {
    assert(identity.did !== OWNER && identity.password);
    const deadline = Date.now() + 120000;
    let submittedCredentials = false;
    while (Date.now() < deadline) {
      if (new URL(page.url()).origin === ORIGIN) return;
      await page.waitForFunction(
        `((siteOrigin) => {
          if (location.origin === siteOrigin) return true;
          return [...document.querySelectorAll('input[type="password"]')].some(
            (element) => element.getClientRects().length > 0
          ) || [...document.querySelectorAll('button')].some(
            (button) => button.getClientRects().length > 0 &&
              /^(?:authorize|accept|allow access|deny access|cancel|sign in as .+)$/i.test(
                button.getAttribute('aria-label') ?? button.textContent?.trim() ?? ''
              )
          );
        })(${JSON.stringify(ORIGIN)})`,
        undefined,
        { timeout: Math.max(1, deadline - Date.now()) }
      );
      if (new URL(page.url()).origin === ORIGIN) return;
      assert.equal(new URL(page.url()).origin, providerOrigin);
      const deny = page.getByRole('button', {
        name: /^(?:Deny access|Cancel)$/i,
      });
      if (
        expectation === 'cancel' &&
        (await deny.count()) === 1 &&
        (await deny.isVisible())
      ) {
        await deny.click();
        return;
      }
      const password = page.locator('input[type="password"]');
      if (await password.isVisible()) {
        assert(
          !submittedCredentials,
          'The owned provider did not accept its generated credentials.'
        );
        const identifier = page.locator(
          'input[name="username"], input[name="identifier"]'
        );
        assert.equal(await identifier.count(), 1);
        if ((await identifier.getAttribute('readonly')) !== null)
          assert(
            [identity.handle, identity.did, identity.email].includes(
              await identifier.inputValue()
            )
          );
        else await identifier.fill(identity.handle);
        assert.equal(new URL(page.url()).origin, providerOrigin);
        await password.fill(identity.password);
        await page.getByRole('button', { name: /^Sign in$/i }).click();
        submittedCredentials = true;
        await password.waitFor({ state: 'hidden', timeout: 60000 });
        continue;
      }
      const account = page.getByRole('button', {
        name: `Sign in as ${identity.handle}`,
        exact: true,
      });
      if (await account.isVisible()) {
        await account.click();
        continue;
      }
      const approve = page.getByRole('button', {
        name: /^(?:Authorize|Accept|Allow access)$/i,
      });
      if (
        expectation !== 'cancel' &&
        (await approve.count()) === 1 &&
        (await approve.isVisible())
      ) {
        assert.equal(new URL(page.url()).origin, providerOrigin);
        const consentText = await page.locator('body').innerText();
        assert(
          consentText.includes(identity.handle) ||
            consentText.includes(identity.did),
          'The provider consent page must identify the journaled account.'
        );
        await approve.click();
        return;
      }
      throw new Error(
        'The owned official provider needs an unsupported interactive step. No grant was synthesized.'
      );
    }
    throw new Error(
      'The owned provider authorization UI did not complete before its deadline.'
    );
  }
  async function flow(
    context: typeof first,
    handle: string,
    expectation: 'grant' | 'cancel' | 'expired',
    filename: string,
    action: 'subscription' | 'recommendation' = 'subscription',
    withholdDelivery = false
  ) {
    const visitor = await resolveHandle(handle);
    const automatedIdentity = ownedIdentities
      ? [ownedIdentities.publisher, ownedIdentities.visitor].find(
          (identity) => identity.handle === handle
        )
      : undefined;
    if (ownedIdentities) {
      assert(
        automatedIdentity,
        'Only journaled handles may use generated credentials.'
      );
      assert.equal(automatedIdentity.did, visitor);
      if (expectation === 'cancel')
        await context.clearCookies({
          domain: new URL(ownedIdentities.origin).hostname,
        });
    }
    const existingGrant =
      await db.sql`SELECT key_hash FROM atproto_oauth_sessions WHERE key_hash = ${hash(visitor)}`;
    const beforeRecords = await graphFor(visitor, action);
    if (expectation === 'grant')
      assert.equal(
        beforeRecords.length,
        0,
        'Preexisting subscription belongs to another flow. Use a fresh acceptance publication or clean its recorded prior run first.'
      );
    const page = await context.newPage();
    const existingSession = (await context.cookies(ORIGIN)).find(
      (entry) => entry.name === 'atproto_session'
    )?.value;
    const returnTo =
      action === 'recommendation' ? `/writings/${values.slug}` : '/writings';
    const startedInPage =
      (expectation === 'grant' &&
        (action === 'recommendation' || authorizationOnly)) ||
      (expectation === 'cancel' && !existingSession);
    const sessionsBefore =
      expectation === 'cancel' && !existingSession
        ? (
            await db.sql`SELECT token_hash FROM atproto_browser_sessions WHERE did = ${visitor}`
          ).rows
            .map((row) => row.token_hash)
            .sort()
        : undefined;
    let login:
      | Awaited<ReturnType<typeof context.request.post>>
      | Awaited<ReturnType<typeof page.waitForResponse>>;
    let loginPayload: { url: string } | undefined;
    if (startedInPage) {
      assert(!existingSession, 'The pending action must begin signed out.');
      await captureSocialLoading(
        page,
        values.output!,
        `${filename.replace('.json', '')}-loading`,
        ORIGIN + returnTo
      );
      await page
        .getByRole('button', {
          name: action === 'recommendation' ? 'Recommend' : 'Subscribe',
          exact: true,
        })
        .waitFor();
      await captureSocialState(
        page,
        values.output!,
        `${filename.replace('.json', '')}-signed-out`
      );
      await page
        .getByRole('button', {
          name: action === 'recommendation' ? 'Recommend' : 'Subscribe',
          exact: true,
        })
        .click();
      await captureSocialState(
        page,
        values.output!,
        `${filename.replace('.json', '')}-sign-in`
      );
      await page
        .getByLabel('Your handle', { exact: true })
        .fill('acceptance-invalid-handle');
      const invalidLogin = page.waitForResponse(
        (response) =>
          response.url() === `${ORIGIN}/api/atproto/login` &&
          response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      assert.equal((await invalidLogin).status(), 400);
      await page
        .getByRole('alert')
        .filter({ hasText: 'Check your handle and try again.' })
        .waitFor();
      await captureSocialState(
        page,
        values.output!,
        `${filename.replace('.json', '')}-invalid-handle`
      );
      await page.getByLabel('Your handle', { exact: true }).fill(handle);
      const started = page.waitForResponse(
        (response) =>
          response.url() === `${ORIGIN}/api/atproto/login` &&
          response.request().method() === 'POST'
      );
      void started.catch(() => {});
      let releaseLogin!: () => void;
      const heldLogin = new Promise<void>((done) => {
        releaseLogin = done;
      });
      let handlerStarted = false;
      let dispatched = false;
      let cancelled = false;
      let completed!: () => void;
      let failed!: (error: unknown) => void;
      const completion = new Promise<void>((done, reject) => {
        completed = done;
        failed = reject;
      });
      void completion.catch(() => {});
      const loginRoute = async (route: import('@playwright/test').Route) => {
        handlerStarted = true;
        await heldLogin;
        try {
          if (cancelled) await route.abort('failed');
          else {
            const response = await route.fetch({
              timeout: 60000,
              maxRedirects: 0,
            });
            // Navigation discards Chromium's response body after fulfillment.
            loginPayload = (await response.json()) as { url: string };
            if (cancelled) await route.abort('failed');
            else await route.fulfill({ response });
          }
          completed();
        } catch (error) {
          await route.abort('failed').catch(() => {});
          failed(error);
        }
      };
      await page.route(`${ORIGIN}/api/atproto/login`, loginRoute, { times: 1 });
      try {
        await page
          .getByRole('button', { name: 'Continue', exact: true })
          .click();
        await page
          .getByRole('button', { name: 'Connecting…', exact: true })
          .waitFor();
        await captureSocialState(
          page,
          values.output!,
          `${filename.replace('.json', '')}-sign-in-pending`
        );
        dispatched = true;
        releaseLogin();
        await completion;
        login = await started;
      } catch (error) {
        await recordOperationFailure(error).catch(() => {});
        throw error;
      } finally {
        if (!dispatched) cancelled = true;
        releaseLogin();
        // Disabling interception during the provider redirect can stall Chromium.
        // The one-use route removes itself after its handler completes.
        if (handlerStarted) await completion.catch(() => {});
      }
    } else
      login = await context.request.post(`${ORIGIN}/api/atproto/login`, {
        headers: { origin: ORIGIN },
        data: {
          handle,
          action,
          ...(action === 'recommendation' && { slug: values.slug }),
        },
      });
    if ('finished' in login) assert.equal(await login.finished(), null);
    assert.equal(
      login.status(),
      200,
      'The deployed target must be verified before authorization begins.'
    );
    const issuedCookie = (await login.headersArray())
      .find(
        (entry) =>
          entry.name.toLowerCase() === 'set-cookie' &&
          entry.value.startsWith('atproto_flow=')
      )
      ?.value.match(/^atproto_flow=([a-f0-9]{64})(?:;|$)/)?.[1];
    const flowCookie =
      issuedCookie ??
      (await context.cookies(ORIGIN)).find(
        (entry) => entry.name === 'atproto_flow'
      )?.value;
    assert(flowCookie && /^[a-f0-9]{64}$/.test(flowCookie));
    if (authorizationOnly)
      await save('authorization-flow-cookie.json', {
        flowHash: hash(flowCookie),
        visitor,
      });
    const rows =
      await db.sql`SELECT key_hash, encrypted_value FROM atproto_oauth_states WHERE expires_at > NOW()`;
    const own = rows.rows.filter((row) => {
      const stored = decryptOAuthValue<StoredState>(
        row.encrypted_value as string,
        settings.ATPROTO_OAUTH_STORAGE_KEY
      );
      return (
        (stored.userState as { browserHash?: string })?.browserHash ===
        hash(flowCookie)
      );
    });
    assert.equal(
      own.length,
      1,
      'Exactly one genuine provider authorization must belong to this browser flow.'
    );
    const issuedStateHash = own[0].key_hash as string;
    const issuedState = decryptOAuthValue<StoredState>(
      own[0].encrypted_value as string,
      settings.ATPROTO_OAUTH_STORAGE_KEY
    );
    if (existingOnly) {
      assert(authorizationBaseline);
      assert(
        !authorizationBaseline.database.states.some(
          (row) => row.key === issuedStateHash
        )
      );
      authorizationStates.push({
        key: issuedStateHash,
        did: visitor,
        encryptedHash: hash(own[0].encrypted_value as string),
        flowHash: hash(flowCookie),
      });
      await save('authorization-states.json', authorizationStates);
    }
    const cookieDeadline = Date.now() + 5000;
    while (
      !(await context.cookies(ORIGIN)).some(
        (entry) => entry.name === 'atproto_flow' && entry.value === flowCookie
      )
    ) {
      assert(
        Date.now() < cookieDeadline,
        'The actual login response cookie was not installed in its browser context.'
      );
      await new Promise((done) => setTimeout(done, 25));
    }
    const { url } = loginPayload ?? ((await login.json()) as { url: string });
    const intent = issuedState.userState as {
      action?: string;
      slug?: string;
      returnTo?: string;
    };
    assert.equal(intent.action, action);
    assert.equal(intent.returnTo, returnTo);
    assert.equal(
      intent.slug,
      action === 'recommendation' ? values.slug : undefined
    );
    assert.equal(issuedState.sub, visitor);
    assert.equal(issuedState.redirectUri, `${ORIGIN}/atproto/callback`);
    let pendingGrant: PendingGrant | undefined;
    if (
      withholdDelivery &&
      expectation === 'grant' &&
      existingGrant.rows.length === 0 &&
      ownedIdentities
    ) {
      const { resolvePds } = await import('../lib/atproto/identity');
      pendingGrant = {
        did: visitor,
        stateHash: issuedStateHash,
        flowHash: hash(flowCookie),
        encryptedStateHash: hash(own[0].encrypted_value as string),
        dpopSpkiSha256: publicDpopHash(issuedState.dpopKey),
        issuer: issuedState.issuer,
        audience: new URL(await resolvePds(visitor as Did)).href,
        kind: action,
        beforeRecords: beforeRecords.map(({ uri, cid }) => ({ uri, cid })),
        beforeBrowsers: (
          await db.sql`SELECT token_hash FROM atproto_browser_sessions WHERE did = ${visitor}`
        ).rows.map((row) => row.token_hash as string),
        priorGrantKeys: existingGrant.rows.map((row) => row.key_hash as string),
      };
      pendingGrants.push(pendingGrant);
      // The SDK carries this exact DPoP key from state into its stored grant.
      await journalPendingGrants();
    }
    async function rememberCallback(response: {
      status(): number;
      headersArray(): Promise<{ name: string; value: string }[]>;
    }) {
      if (!pendingGrant) return;
      const header = (await response.headersArray()).find(
        (entry) =>
          entry.name.toLowerCase() === 'set-cookie' &&
          entry.value.startsWith('atproto_session=')
      )?.value;
      const token = header?.match(
        /^atproto_session=([a-f0-9]{64})(?:;|$)/
      )?.[1];
      {
        assert(
          token,
          'A completed grant callback must return its real session cookie.'
        );
        assert.equal(response.status(), 303);
        await save(`pending-callback-${issuedStateHash}.json`, {
          setCookie: header,
          callbackCompleted: true,
          stateHash: issuedStateHash,
          actualStatus: response.status(),
        });
        pendingGrant.responseSessionHash = hash(token);
      }
      pendingGrant.callbackCompleted = true;
      await journalPendingGrants();
    }
    let wrongBrowserRejected = false;
    if (automatedIdentity) {
      assert(ownedIdentities);
      assert.equal(issuedState.issuer, ownedIdentities.origin);
      assert.equal(new URL(url).origin, ownedIdentities.origin);
      await page.route('**/*', async (route) => {
        const request = route.request();
        if (
          request.isNavigationRequest() &&
          request.frame() === page.mainFrame()
        ) {
          const destination = new URL(request.url());
          if (
            destination.origin !== ownedIdentities.origin &&
            destination.origin !== ORIGIN
          ) {
            await route.abort('blockedbyclient');
            return;
          }
        }
        await route.continue();
      });
    }
    let expiredKey: string | undefined;
    if (expectation === 'expired') {
      expiredKey = issuedStateHash;
      await db.sql`UPDATE atproto_oauth_states SET expires_at = NOW() - INTERVAL '1 second' WHERE key_hash = ${expiredKey}`;
    }
    const responsePromise = page.waitForResponse(
      (response) => {
        const callback = new URL(response.url());
        return (
          callback.origin === ORIGIN &&
          callback.pathname === '/atproto/callback'
        );
      },
      { timeout: automatedIdentity ? 120000 : 600000 }
    );
    void responsePromise.catch(() => {});
    if (!automatedIdentity)
      console.log(
        expectation === 'cancel'
          ? 'Decline this authorization in the provider browser. Do not approve it.'
          : expectation === 'expired'
            ? 'Approve this already expired test authorization. The site must reject its callback.'
            : 'Sign in with this acceptance account and approve the site request in the browser.'
      );
    async function captureSession() {
      const currentSession = (await context.cookies(ORIGIN)).find(
        (entry) => entry.name === 'atproto_session'
      )?.value;
      if (
        currentSession &&
        currentSession !== existingSession &&
        !ownership.some((entry) => entry.sessionHash === hash(currentSession))
      ) {
        const owned: OwnedBrowser = {
          did: visitor,
          sessionHash: hash(currentSession),
          grantCreated: existingGrant.rows.length === 0,
          ...(pendingGrant && { dpopSpkiSha256: pendingGrant.dpopSpkiSha256 }),
          inventoryComplete: false,
          records: [],
        };
        ownership.push(owned);
        browserTokens.set(owned.sessionHash, currentSession);
        await journalOwnership();
        const records = await graphFor(visitor, action);
        owned.records = records
          .filter(
            (record) =>
              !beforeRecords.some((before) => before.uri === record.uri)
          )
          .map((record) => ({
            uri: record.uri,
            cid: record.cid,
            kind: action,
            target: record.value[
              action === 'subscription' ? 'publication' : 'document'
            ] as string,
          }));
        owned.inventoryComplete = true;
        await journalOwnership();
      }
      return currentSession;
    }
    let response: Awaited<typeof responsePromise>;
    const originalFlowCookie = (await context.cookies(ORIGIN)).find(
      (cookie) => cookie.name === 'atproto_flow' && cookie.value === flowCookie
    );
    assert(originalFlowCookie);
    if (expectation === 'grant')
      await context.addCookies([
        { ...originalFlowCookie, value: '0'.repeat(64) },
      ]);
    try {
      if (!startedInPage) await page.goto(url);
      else
        await page.waitForURL(
          (destination) => destination.origin === new URL(url).origin
        );
      if (automatedIdentity) {
        assert(ownedIdentities);
        await authorizeOwnedProvider(
          page,
          automatedIdentity,
          ownedIdentities.origin,
          expectation
        );
      }
      response = await responsePromise;
      if (expectation === 'grant') {
        const rejectedCallback = new URL(response.url());
        assert(rejectedCallback.searchParams.has('code'));
        assert.equal(
          hash(rejectedCallback.searchParams.get('state')!),
          issuedStateHash
        );
        assert.equal(response.status(), 303);
        const rejectedHeaders = await response.allHeaders();
        assert.equal(
          rejectedHeaders.location,
          ORIGIN + '/writings?atprotoError=1'
        );
        assert(
          !(await response.headersArray()).some(
            (header) =>
              header.name.toLowerCase() === 'set-cookie' &&
              header.value.startsWith('atproto_session=')
          )
        );
        const retained =
          await db.sql`SELECT encrypted_value FROM atproto_oauth_states WHERE key_hash = ${issuedStateHash}`;
        assert.equal(retained.rows.length, 1);
        assert.equal(
          hash(retained.rows[0].encrypted_value as string),
          hash(own[0].encrypted_value as string)
        );
        assert.equal(
          (
            await db.sql`SELECT key_hash FROM atproto_oauth_sessions WHERE key_hash = ${hash(visitor)}`
          ).rows.length,
          existingGrant.rows.length
        );
        assert.deepEqual(await graphFor(visitor, action), beforeRecords);
        await page.waitForURL(
          (location) =>
            location.origin === ORIGIN && location.pathname === '/writings',
          { waitUntil: 'domcontentloaded', timeout: 60000 }
        );
        await context.addCookies([originalFlowCookie]);
        if (withholdDelivery) {
          assert(pendingGrant && !existingSession);
          let handlerStarted = false;
          let completed!: () => void;
          let failed!: (error: unknown) => void;
          const completion = new Promise<void>((done, reject) => {
            completed = done;
            failed = reject;
          });
          void completion.catch(() => {});
          const controller = new AbortController();
          const heldCallback = async (
            route: import('@playwright/test').Route
          ) => {
            handlerStarted = true;
            try {
              // route.fetch installs Set-Cookie before route.abort can withhold it.
              const upstream = await fetch(rejectedCallback.href, {
                redirect: 'manual',
                headers: { cookie: `atproto_flow=${flowCookie}` },
                signal: AbortSignal.any([
                  controller.signal,
                  AbortSignal.timeout(60000),
                ]),
              });
              await upstream.arrayBuffer();
              await rememberCallback({
                status: () => upstream.status,
                headersArray: async () =>
                  upstream.headers
                    .getSetCookie()
                    .map((value) => ({ name: 'set-cookie', value })),
              });
              assert.equal(upstream.status, 303);
              assert.equal(upstream.headers.get('location'), ORIGIN + returnTo);
              assert(pendingGrant!.responseSessionHash);
              await route.abort('failed');
              completed();
            } catch (error) {
              await route.abort('failed').catch(() => {});
              failed(error);
            }
          };
          await page.route(rejectedCallback.href, heldCallback, { times: 1 });
          try {
            await page.goto(rejectedCallback.href, { timeout: 70000 }).then(
              () => {
                throw new Error('The callback response reached the browser.');
              },
              (error: Error) => {
                assert.match(error.message, /ERR_FAILED/);
              }
            );
            await completion;
          } finally {
            controller.abort();
            if (handlerStarted) await completion.catch(() => {});
            await page.unroute(rejectedCallback.href, heldCallback);
          }
          assert(
            !(await context.cookies(ORIGIN)).some(
              (cookie) => cookie.name === 'atproto_session'
            )
          );
          assert.equal(
            (
              await (
                await context.request.get(`${ORIGIN}/api/atproto/social`)
              ).json()
            ).signedIn,
            false
          );
          const { withOAuthLock } =
            await import('../lib/atproto/oauth-storage');
          await withOAuthLock(`oauth-session-${visitor}`, async () => {
            const current =
              await db.sql`SELECT encrypted_value FROM atproto_oauth_sessions WHERE key_hash = ${hash(visitor)}`;
            assert.equal(
              current.rows.length,
              1,
              'The real callback must have stored its new provider grant before browser delivery was lost.'
            );
            assertGrantBinding(
              pendingGrant!,
              decryptOAuthValue<StoredSession>(
                current.rows[0].encrypted_value as string,
                settings.ATPROTO_OAUTH_STORAGE_KEY
              )
            );
            await recoverPendingGrant(pendingGrant!);
          });
          assert.equal((await graphFor(visitor, action)).length, 1);
          assert.equal(
            (
              await db.sql`SELECT key_hash FROM atproto_oauth_states WHERE key_hash = ${issuedStateHash}`
            ).rows.length,
            0
          );
          await page.goto(ORIGIN + returnTo);
          await page
            .getByRole('button', { name: 'Subscribe', exact: true })
            .waitFor();
          await captureSocialState(
            page,
            values.output!,
            'callback-delivery-withheld'
          );
          deliveryFailureObserved = true;
          await save('cookie-delivery-receipt.json', {
            status: 'observed',
            scope: 'real-callback-browser-delivery-failure',
            probeSourceSha256: hash(
              await readFile(fileURLToPath(import.meta.url), 'utf8')
            ),
            runtimeRevision: authorizationRevision,
            localVerifier,
            fullVerification: 'pending',
            did: visitor,
            stateHash: issuedStateHash,
            dpopSpkiSha256: pendingGrant.dpopSpkiSha256,
            actualCallbackStatus: 303,
            browserSessionAbsent: true,
            providerGrantBoundToIssuedState: true,
            browserRowBoundToActualResponse: true,
            actualSubscriptionPresent: true,
          });
          throw deliveryWithheld;
        }
        const authorized = page.waitForResponse(
          (candidate) => candidate.url() === rejectedCallback.href,
          { timeout: 120000 }
        );
        void authorized.catch(() => {});
        await page.goto(rejectedCallback.href);
        response = await authorized;
        assert.equal(await response.finished(), null);
        await rememberCallback(response);
        wrongBrowserRejected = true;
      }
    } catch (error) {
      if (error !== deliveryWithheld)
        await recordOperationFailure(error).catch(() => {});
      throw error;
    } finally {
      await captureSession();
    }
    const currentSession = await captureSession();
    const callback = new URL(response.url());
    const headers = await response.allHeaders();
    assert.equal(response.status(), 303);
    const location = headers.location;
    assert(location?.startsWith(ORIGIN));
    const status = await context.request.get(`${ORIGIN}/api/atproto/social`);
    assert.equal(status.status(), 200);
    if (expectation === 'grant') {
      assert(callback.searchParams.has('code'));
      assert.equal(location, ORIGIN + returnTo);
      assert(currentSession && currentSession !== existingSession);
      assert((await status.json()).signedIn);
      assert(
        wrongBrowserRejected,
        'Wrong-browser binding rejection was not exercised.'
      );
    } else {
      assert(location.includes('atprotoError=1'));
      assert(
        currentSession === existingSession,
        'A failed authorization cannot issue or replace a session.'
      );
      if (expectation === 'cancel')
        assert.equal(callback.searchParams.get('error'), 'access_denied');
      else
        assert(
          callback.searchParams.has('code'),
          'Expired-state proof requires a real code from the provider.'
        );
    }
    const ownedSocialRecords =
      expectation === 'grant'
        ? (await graphFor(visitor, action)).map((record) => ({
            uri: record.uri,
            cid: record.cid,
            kind: action,
            target:
              record.value[
                action === 'subscription' ? 'publication' : 'document'
              ],
          }))
        : [];
    const owner = ownership.find(
      (entry) =>
        entry.sessionHash ===
        (currentSession ? hash(currentSession) : undefined)
    );
    if (owner && expectation === 'grant') {
      owner.records = ownedSocialRecords.map((record) => ({
        ...record,
        kind: action,
        target: record.target as string,
      }));
      owner.inventoryComplete = true;
      await journalOwnership();
    }
    if (expectation !== 'grant')
      assert.deepEqual(await graphFor(visitor, action), beforeRecords);
    if (sessionsBefore) {
      assert(
        !(await context.cookies(ORIGIN)).some(
          (entry) => entry.name === 'atproto_session'
        )
      );
      const signedOutStatus = await context.request.get(
        `${ORIGIN}/api/atproto/social`
      );
      assert.equal(signedOutStatus.status(), 200);
      assert.equal((await signedOutStatus.json()).signedIn, false);
      assert.deepEqual(
        (
          await db.sql`SELECT token_hash FROM atproto_browser_sessions WHERE did = ${visitor}`
        ).rows
          .map((row) => row.token_hash)
          .sort(),
        sessionsBefore
      );
    }
    // A signed hash of the observed absent cookie denotes no session. It is never accepted as an authenticated session.
    const sessionHash = hash(currentSession ?? '');
    const stateHash = hash(callback.searchParams.get('state')!);
    assert.equal(
      stateHash,
      issuedStateHash,
      'The observed callback must belong to the actual issued state.'
    );
    if (callback.searchParams.has('iss'))
      assert.equal(callback.searchParams.get('iss'), issuedState.issuer);
    if (expectation === 'grant') {
      const session =
        await db.sql`SELECT did FROM atproto_browser_sessions WHERE token_hash = ${sessionHash!} AND expires_at > NOW()`;
      assert.equal(session.rows.length, 1);
      assert.equal(session.rows[0].did, visitor);
      assert.equal(ownedSocialRecords.length, 1);
      assert.equal(
        (
          await db.sql`SELECT key_hash FROM atproto_oauth_states WHERE key_hash = ${stateHash}`
        ).rows.length,
        0
      );
    }
    const proof = {
      visitor,
      sessionHash: sessionHash!,
      stateHash,
      issuedStateHash,
      issuedStateExpiresAt: issuedState.expiresAt,
      issuedStateIssuer: issuedState.issuer,
      outcome:
        expectation === 'grant'
          ? ('authorized' as const)
          : ('rejected' as const),
      url: callback.href,
      flowCookie,
      status: response.status(),
      location,
      wrongBrowserRejected,
      expectation,
      sessionReplaced: currentSession !== existingSession,
      ...(expectation === 'expired' && {
        expirySource:
          'Only this genuine authorization state database deadline was moved into the past; the provider code was real.',
      }),
    };
    const file = await save(filename, {
      ...proof,
      signature: callbackSignature(proof, settings.ATPROTO_OAUTH_STORAGE_KEY),
      ownedSocialRecords,
      observedAt: new Date().toISOString(),
      ...(sessionsBefore && {
        absentSession: {
          cookieBefore: false,
          cookieAfter: false,
          databaseSessionInventoryUnchanged: true,
        },
      }),
    });
    if (expiredKey)
      await db.sql`DELETE FROM atproto_oauth_states WHERE key_hash = ${expiredKey}`;
    await page.waitForURL(`${ORIGIN}${returnTo}**`);
    assert.equal(new URL(page.url()).pathname, returnTo);
    if (expectation === 'grant' && action === 'recommendation')
      await page
        .getByRole('button', { name: 'Recommended', exact: true })
        .waitFor({ state: 'visible' });
    if (expectation === 'grant' && authorizationOnly)
      await page
        .getByRole('button', { name: 'Subscribed', exact: true })
        .waitFor({ state: 'visible' });
    await page
      .locator(`[data-standard-social="${action}"]`)
      .waitFor({ state: 'visible' });
    await captureSocialState(
      page,
      values.output!,
      `${filename.replace('.json', '')}-returned`
    );
    return {
      file,
      page,
      ownedSocialRecords,
      grant: {
        did: visitor,
        sessionHash: sessionHash!,
        callbackStateHash: stateHash,
        outcome: expectation === 'grant' ? 'authorized' : 'rejected',
      },
    };
  }
  let recoveryVerified = !values['cleanup-only'];
  let captureFailurePhase: string | undefined;
  try {
    if (existingOnly) {
      if (values['cleanup-only']) {
        authorizationBaseline = JSON.parse(
          await readFile(
            resolve(values.output!, 'authorization-baseline.json'),
            'utf8'
          )
        ) as AuthorizationBaseline;
        authorizationStates.push(
          ...JSON.parse(
            await readFile(
              resolve(values.output!, 'authorization-states.json'),
              'utf8'
            )
          )
        );
      } else {
        const baselineAt = Date.now();
        const states =
          await db.sql`SELECT key_hash, expires_at FROM atproto_oauth_states`;
        const database = await databaseInventory();
        authorizationBaseline = {
          origin: ORIGIN,
          publisher: settings.NEXT_PUBLIC_ATPROTO_DID,
          runtimeRevision: runtimeRevision,
          database,
          graphs: await visitorGraphs(),
          expiredStates: states.rows
            .filter((row) => new Date(row.expires_at).getTime() <= baselineAt)
            .map((row) => ({
              key: row.key_hash as string,
              expiresAt: new Date(row.expires_at).toISOString(),
              rowHash: database.states.find(
                (entry) => entry.key === row.key_hash
              )!.rowHash,
            })),
        };
        assert(ownedIdentities);
        assert(
          [ownedIdentities.publisher.did, ownedIdentities.visitor.did].every(
            (did) =>
              !authorizationBaseline!.database.grants.some(
                (row) => row.key === hash(did)
              )
          ),
          'Use fresh owned provider grants so cleanup never rotates or revokes an unrelated grant.'
        );
        await save('authorization-baseline.json', authorizationBaseline);
        await save('authorization-states.json', authorizationStates);
      }
      assert.equal(authorizationBaseline.origin, ORIGIN);
      assert.equal(
        authorizationBaseline.publisher,
        settings.NEXT_PUBLIC_ATPROTO_DID
      );
      assert.equal(authorizationBaseline.runtimeRevision, runtimeRevision);
    }
    if (!values['cleanup-only']) await journalOwnership();
    if (values['cleanup-only']) {
      try {
        const ledger = JSON.parse(
          await readFile(resolve(values.output!, 'pending-grants.json'), 'utf8')
        ) as {
          origin: string;
          publisher: string;
          pending: PendingGrant[];
        };
        assert.equal(ledger.origin, ORIGIN);
        assert.equal(ledger.publisher, settings.NEXT_PUBLIC_ATPROTO_DID);
        assert(Array.isArray(ledger.pending));
        pendingGrants.push(...ledger.pending);
        if (pendingGrants.length) {
          const probe = JSON.parse(
            await readFile(
              resolve(values.output!, 'cookie-delivery-receipt.json'),
              'utf8'
            )
          );
          assert(
            probe.scope === 'real-callback-browser-delivery-failure' &&
              probe.actualCallbackStatus === 303 &&
              probe.browserSessionAbsent &&
              probe.providerGrantBoundToIssuedState &&
              probe.browserRowBoundToActualResponse &&
              probe.actualSubscriptionPresent &&
              pendingGrants.some(
                (intent) =>
                  intent.did === probe.did &&
                  intent.stateHash === probe.stateHash &&
                  intent.dpopSpkiSha256 === probe.dpopSpkiSha256
              )
          );
          deliveryFailureObserved = true;
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      const journal = JSON.parse(
        await readFile(
          resolve(values.output!, 'cleanup-ownership.json'),
          'utf8'
        )
      ) as {
        origin: string;
        publisher: string;
        owned: OwnedBrowser[];
      };
      assert(
        journal.origin === ORIGIN &&
          journal.publisher === settings.NEXT_PUBLIC_ATPROTO_DID
      );
      const credentials = JSON.parse(
        await readFile(
          resolve(values.output!, 'cleanup-credentials.json'),
          'utf8'
        )
      ) as {
        browserTokens: Record<string, string>;
      };
      for (const owner of journal.owned) {
        assert(owner.did !== OWNER && /^[a-f0-9]{64}$/.test(owner.sessionHash));
        const token = credentials.browserTokens[owner.sessionHash];
        assert(token && hash(token) === owner.sessionHash);
        ownership.push(owner);
        browserTokens.set(owner.sessionHash, token);
      }
      recoveryVerified = true;
    }
    if (!values['cleanup-only']) {
      if (values['cookie-delivery-failure']) {
        assert(ownedIdentities && authorizationOnly);
        await flow(
          first,
          ownedIdentities.publisher.handle,
          'grant',
          'callback-delivery.json',
          'subscription',
          true
        );
        throw new Error(
          'The delivery probe must stop before normal authorization checks.'
        );
      }
      let signedOutCancellation: Awaited<ReturnType<typeof flow>> | undefined;
      if (ownedIdentities) {
        const fresh = await browser.newContext({
          viewport: { width: 1440, height: 1000 },
        });
        try {
          assert(
            !(await fresh.cookies(ORIGIN)).some(
              (cookie) => cookie.name === 'atproto_session'
            )
          );
          signedOutCancellation = await flow(
            fresh,
            ownedIdentities.visitor.handle,
            'cancel',
            'callback-cancelled-signed-out.json'
          );
        } finally {
          await fresh.close();
        }
      }
      console.log(
        'Step 10: Authorize the first acceptance visitor in the first browser context.'
      );
      const primaryHandle =
        ownedIdentities?.publisher.handle ??
        ((
          await terminal.question(
            'First visitor handle (Enter uses the isolated publishing account): '
          )
        )
          .replace(/^@/, '')
          .trim() ||
          settings.NEXT_PUBLIC_BLUESKY_HANDLE);
      const primaryDid = await resolveHandle(primaryHandle);
      assert.equal(
        primaryDid,
        settings.NEXT_PUBLIC_ATPROTO_DID,
        'Use the isolated publisher as the first visitor so a second publishing client can verify matching social records.'
      );
      const granted = await flow(
        first,
        primaryHandle,
        'grant',
        'callback-primary.json',
        authorizationOnly ? 'subscription' : 'recommendation'
      );
      await save('cookies-primary.json', {
        cookies: await first.cookies(ORIGIN),
        ownedSocialRecords: granted.ownedSocialRecords,
        grant: granted.grant,
      });
      await captureSocialState(
        granted.page,
        values.output!,
        'signed-in-primary'
      );
      console.log(
        'Step 11: Authorize a different test account in the second browser context.'
      );
      const secondHandle =
        ownedIdentities?.visitor.handle ??
        (
          await terminal.question(
            'Second visitor handle (must be an existing different test account): '
          )
        )
          .replace(/^@/, '')
          .trim();
      assert.notEqual(
        await resolveHandle(secondHandle),
        primaryDid,
        'The second visitor must be a different account.'
      );
      const grantedSecond = await flow(
        second,
        secondHandle,
        'grant',
        'callback-second.json'
      );
      await save('cookies-second.json', {
        cookies: await second.cookies(ORIGIN),
        ownedSocialRecords: grantedSecond.ownedSocialRecords,
        grant: grantedSecond.grant,
      });
      await captureSocialState(
        grantedSecond.page,
        values.output!,
        'signed-in-second'
      );
      console.log(
        'Step 12: Decline a fresh provider authorization to prove cancellation.'
      );
      const cancelled = await flow(
        second,
        secondHandle,
        'cancel',
        'callback-cancelled.json'
      );
      console.log(
        'Step 13: Complete a real provider callback after expiring only its isolated state deadline.'
      );
      const expired = await flow(
        second,
        secondHandle,
        'expired',
        'callback-expired.json'
      );
      if (authorizationOnly) {
        assert(signedOutCancellation && ownedIdentities);
        await verifyAuthorizationOnly(
          granted,
          grantedSecond,
          cancelled,
          expired,
          signedOutCancellation
        );
        return;
      }
      if (ownedIdentities) {
        const owner = ownership.find(
          (entry) => entry.sessionHash === granted.grant.sessionHash
        );
        assert(owner);
        async function finishUiMutation(
          kind: 'subscription' | 'recommendation'
        ) {
          assert(owner);
          await settleUiMutation(owner);
          const records = await graphFor(owner.did, kind);
          for (const record of records) {
            const known: OwnedBrowser['records'][number] | undefined =
              owner.records.find((entry) => entry.uri === record.uri);
            if (known)
              assert.equal(
                known.cid,
                record.cid,
                'An owned graph record changed outside this run.'
              );
            else
              owner.records.push({
                uri: record.uri,
                cid: record.cid,
                kind,
                target: record.value[
                  kind === 'subscription' ? 'publication' : 'document'
                ] as string,
              });
          }
          owner.pendingMutation = undefined;
          owner.inventoryComplete = true;
          await journalOwnership();
        }
        try {
          await socialUiFailures({
            context: first,
            output: values.output!,
            identityJournal: ownedIdentities.journalPath,
            publisher: primaryDid,
            slug: values.slug!,
            ...(socialOnly && { fixturePublicationJournal }),
            beforeMutation: async (kind) => {
              const before = await graphFor(owner.did, kind);
              assert(
                before.every((record) =>
                  owner.records.some(
                    (known) =>
                      known.uri === record.uri && known.cid === record.cid
                  )
                )
              );
              const { loadWriting } = await import('../lib/writings');
              const { documentRkey } = await import('../lib/atproto/keys');
              const { writing } = await loadWriting(values.slug!);
              owner.pendingMutation = {
                kind,
                before: before.map(({ uri, cid }) => ({ uri, cid })),
                target:
                  kind === 'subscription'
                    ? `at://${settings.NEXT_PUBLIC_ATPROTO_DID}/site.standard.publication/${settings.ATPROTO_PUBLICATION_RKEY}`
                    : `at://${settings.NEXT_PUBLIC_ATPROTO_DID}/site.standard.document/${documentRkey(`/writings/${values.slug}`, writing.published)}`,
              };
              owner.inventoryComplete = false;
              await journalOwnership();
            },
            dispatchedMutation: async (kind) => {
              assert(owner.pendingMutation?.kind === kind);
              owner.pendingMutation.dispatchedAt = new Date().toISOString();
              await journalOwnership();
            },
            afterMutation: async (kind) => {
              assert(owner.pendingMutation?.kind === kind);
              owner.pendingMutation.responseCompletedAt =
                new Date().toISOString();
              await journalOwnership();
              await finishUiMutation(kind);
            },
          });
        } finally {
          await recoverSocialFailures(
            values.output!,
            ownedIdentities.journalPath,
            primaryDid
          );
          if (owner.pendingMutation)
            await finishUiMutation(owner.pendingMutation.kind);
        }
        await save('cookies-primary.json', {
          cookies: await first.cookies(ORIGIN),
          ownedSocialRecords: owner.records,
          grant: granted.grant,
        });
      }
      console.log(
        'Step 14: Run real writes, undo, refresh, replay, isolation and sign-out. Cookie and callback values stay private.'
      );
      await run(
        'pnpm',
        [
          'exec',
          'tsx',
          resolve(root, 'scripts/atproto-social-acceptance.mts'),
          '--env',
          values.env!,
          '--slug',
          values.slug!,
          '--cookie-file',
          resolve(values.output!, 'cookies-primary.json'),
          '--second-cookie-file',
          resolve(values.output!, 'cookies-second.json'),
          '--callback-file',
          granted.file,
          '--cancelled-callback-file',
          cancelled.file,
          '--expired-callback-file',
          expired.file,
          ...(signedOutCancellation
            ? [
                '--signed-out-cancelled-callback-file',
                signedOutCancellation.file,
              ]
            : []),
          '--refresh-wait-seconds',
          values['refresh-wait-seconds']!,
          '--receipt',
          resolve(values.output!, 'social-receipt.json'),
          '--write',
        ],
        workspace,
        env
      );
      await granted.page.reload();
      await granted.page
        .getByRole('button', { name: 'Recommend', exact: true })
        .waitFor();
      await captureSocialState(
        granted.page,
        values.output!,
        'signed-out-primary'
      );
      console.log(
        'Step 15: End the second browser session, then run owned-record, grant and browser cleanup.'
      );
      const remaining = await graphFor(await resolveHandle(secondHandle));
      assert(
        remaining.every((record) =>
          grantedSecond.ownedSocialRecords.some(
            (owned) => owned.uri === record.uri
          )
        ),
        'Never remove a second visitor record created outside this capture.'
      );
      if (remaining.length) {
        const undo = await second.request.delete(
          `${ORIGIN}/api/atproto/subscription`,
          { headers: { origin: ORIGIN }, data: {} }
        );
        assert.equal(undo.status(), 200);
        assert.equal(
          (await graphFor(await resolveHandle(secondHandle))).length,
          0
        );
      }
      await captureSocialLogout(second, values.output!);
      const ended = await second.request.post(`${ORIGIN}/api/atproto/logout`, {
        headers: { origin: ORIGIN },
        data: {},
      });
      assert.equal(ended.status(), 200);
      if (socialOnly) {
        assert(existingRuntime && localVerifier);
        assert.deepEqual(await verifyExistingRuntime(), existingRuntime);
        assert.deepEqual(await verifierHashes(), localVerifier.sourceHashes);
        const social = JSON.parse(
          await readFile(resolve(values.output!, 'social-receipt.json'), 'utf8')
        ) as {
          pending: string[];
          cleanup: string;
          error?: string;
        };
        assert.equal(social.cleanup, 'passed');
        assert(!social.error);
        await save('social-only-receipt.json', {
          scope: 'real-social-only',
          status: social.pending.length ? 'pending' : 'checks-passed',
          runtime: existingRuntime,
          localVerifier,
          fullVerification: 'pending',
          parentOwnsFixtureAndAliasRecovery: true,
          socialReceipt: 'social-receipt.json',
          ownedCleanupReceipt: 'capture-cleanup.json',
          pending: [
            ...social.pending,
            'Publishing lifecycles, hosted Atmosphere responses, independent validation and full release verification did not run in this scope.',
          ],
        });
      }
      console.log(
        socialOnly
          ? `Real social checks finished. Publishing lifecycles, hosted responses, independent validation and full verification remain pending. Owned social cleanup follows. Parent-owned fixture and alias recovery remain separate. Evidence remains at ${values.output}.`
          : values['defer-bluesky']
            ? `Real account checks finished. Bluesky lifecycle and hosted Atmosphere response checks remain pending, so full verification is incomplete. Owned cleanup follows. Evidence and screenshots remain at ${values.output}.`
            : `Real account checks finished. Owned cleanup follows before private captures are removed. Evidence and screenshots remain at ${values.output}.`
      );
    }
  } catch (error) {
    if (error === deliveryWithheld) return;
    captureFailurePhase = phase;
    await recordOperationFailure(error).catch(() => {});
    throw error;
  } finally {
    phase = captureFailurePhase ?? 'owned capture cleanup';
    terminal.close();
    const pending: string[] = [];
    let ownershipVerified = true;
    try {
      await recoverSocialFailures(
        values.output!,
        settings.ATPROTO_ACCEPTANCE_IDENTITIES_JOURNAL,
        settings.NEXT_PUBLIC_ATPROTO_DID
      );
      if (!recoveryVerified) {
        pending.push(
          'Recovery inventory was not fully validated. Private ownership and credential files remain unchanged.'
        );
        await save('capture-recovery-failed.json', {
          checkedAt: new Date().toISOString(),
          status: 'pending',
          pending,
        });
      } else {
        try {
          const runner = JSON.parse(
            await readFile(
              resolve(values.output!, 'social-receipt.json'),
              'utf8'
            )
          ) as { visitor: string; owned: OwnedBrowser['records'] };
          const owner = ownership.find((entry) => entry.did === runner.visitor);
          if (owner) {
            for (const record of runner.owned ?? []) {
              assert(
                record.uri.startsWith(`at://${owner.did}/site.standard.graph.`)
              );
              assert(['subscription', 'recommendation'].includes(record.kind));
              if (!owner.records.some((known) => known.uri === record.uri))
                owner.records.push(record);
            }
            await journalOwnership();
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            ownershipVerified = false;
            pending.push(
              'Runner ownership receipt was unavailable or invalid.'
            );
          }
        }
        const { oauthClient } = await import('../lib/atproto/oauth');
        const { withOAuthLock } = await import('../lib/atproto/oauth-storage');
        for (const intent of pendingGrants) {
          try {
            await withOAuthLock(`oauth-session-${intent.did}`, () =>
              recoverPendingGrant(intent)
            );
          } catch {
            pending.push(
              `Pending grant/browser/record ownership needs recovery for ${intent.did}.`
            );
          }
        }
        const revoked = new Set<string>();
        for (const owner of ownership) {
          assert(owner.did !== OWNER);
          const grantIntent = pendingGrants.find(
            (intent) =>
              intent.did === owner.did &&
              intent.dpopSpkiSha256 === owner.dpopSpkiSha256
          );
          if (owner.dpopSpkiSha256 && !owner.grantRevoked) {
            try {
              assert(grantIntent?.callbackCompleted);
              const current =
                await db.sql`SELECT encrypted_value FROM atproto_oauth_sessions WHERE key_hash = ${hash(owner.did)}`;
              assert(current.rows.length <= 1);
              if (current.rows.length)
                assertGrantBinding(
                  grantIntent,
                  decryptOAuthValue<StoredSession>(
                    current.rows[0].encrypted_value as string,
                    settings.ATPROTO_OAUTH_STORAGE_KEY
                  )
                );
            } catch {
              pending.push(
                `Provider grant identity changed for ${owner.did}. Refuse cleanup.`
              );
              continue;
            }
          }
          if (owner.pendingMutation) {
            try {
              await settleUiMutation(owner);
              const intent = owner.pendingMutation;
              assert(
                intent.before.every((record) =>
                  owner.records.some(
                    (known) =>
                      known.uri === record.uri && known.cid === record.cid
                  )
                )
              );
              const records = await graphFor(owner.did, intent.kind);
              for (const record of records) {
                const known: OwnedBrowser['records'][number] | undefined =
                  owner.records.find((entry) => entry.uri === record.uri);
                if (known) assert.equal(known.cid, record.cid);
                else
                  owner.records.push({
                    uri: record.uri,
                    cid: record.cid,
                    kind: intent.kind,
                    target: record.value[
                      intent.kind === 'subscription'
                        ? 'publication'
                        : 'document'
                    ] as string,
                  });
              }
              owner.inventoryComplete = true;
              owner.pendingMutation = undefined;
              await journalOwnership();
            } catch {
              pending.push(
                `An in-flight mutation needs owned recovery for ${owner.did}. Credentials remain private.`
              );
              continue;
            }
          }
          let recordsClean = ownershipVerified && owner.inventoryComplete;
          if (!owner.inventoryComplete)
            pending.push(
              `Callback-owned record inventory needs recovery for ${owner.did}.`
            );
          try {
            if (owner.grantRevoked) {
              assert(owner.recordsClean && owner.inventoryComplete);
              const { resolvePds } = await import('../lib/atproto/identity');
              const pds = await resolvePds(owner.did as Did);
              for (const record of owner.records) {
                const uri =
                  /^at:\/\/(did:[^/]+)\/(site\.standard\.graph\.(subscription|recommend))\/([^/]+)$/.exec(
                    record.uri
                  );
                assert(uri && uri[1] === owner.did);
                const url = new URL('/xrpc/com.atproto.repo.getRecord', pds);
                url.search = new URLSearchParams({
                  repo: owner.did,
                  collection: uri[2],
                  rkey: uri[4],
                }).toString();
                const response = await fetch(url, {
                  redirect: 'error',
                  signal: AbortSignal.timeout(15000),
                });
                assert(
                  response.status === 400 &&
                    (await response.json()).error === 'RecordNotFound',
                  'A previously cleaned owned record must remain absent.'
                );
              }
            } else {
              const cleanRecords = async () => {
                const sessionRows =
                  await db.sql`SELECT key_hash FROM atproto_oauth_sessions WHERE key_hash = ${hash(owner.did)}`;
                if (
                  values['cleanup-only'] &&
                  owner.grantCreated &&
                  sessionRows.rows.length === 0
                ) {
                  const backup = JSON.parse(
                    await readFile(
                      resolve(
                        values.output!,
                        `provider-grant-${hash(owner.did)}.json`
                      ),
                      'utf8'
                    )
                  ) as {
                    did: string;
                    keyHash: string;
                    encryptedValue: string;
                    expiresAt: string;
                  };
                  assert(
                    backup.did === owner.did &&
                      backup.keyHash === hash(owner.did)
                  );
                  assert(
                    decryptOAuthValue<StoredSession>(
                      backup.encryptedValue,
                      settings.ATPROTO_OAUTH_STORAGE_KEY
                    ).tokenSet.sub === owner.did
                  );
                  if (owner.dpopSpkiSha256) {
                    assert(grantIntent);
                    assertGrantBinding(
                      grantIntent,
                      decryptOAuthValue<StoredSession>(
                        backup.encryptedValue,
                        settings.ATPROTO_OAUTH_STORAGE_KEY
                      )
                    );
                  }
                  assert(new Date(backup.expiresAt).getTime() > Date.now());
                  await db.sql`INSERT INTO atproto_oauth_sessions (key_hash, encrypted_value, expires_at) VALUES (${backup.keyHash}, ${backup.encryptedValue}, ${backup.expiresAt}) ON CONFLICT DO NOTHING`;
                }
                if (owner.dpopSpkiSha256) {
                  assert(grantIntent);
                  const current =
                    await db.sql`SELECT encrypted_value FROM atproto_oauth_sessions WHERE key_hash = ${hash(owner.did)}`;
                  assert.equal(current.rows.length, 1);
                  assertGrantBinding(
                    grantIntent,
                    decryptOAuthValue<StoredSession>(
                      current.rows[0].encrypted_value as string,
                      settings.ATPROTO_OAUTH_STORAGE_KEY
                    )
                  );
                }
                const session = await oauthClient().restore(owner.did as Did);
                const rpc = new Client({ handler: session });
                for (const record of owner.records) {
                  const match =
                    /^at:\/\/(did:[^/]+)\/(site\.standard\.graph\.(subscription|recommend))\/([^/]+)$/.exec(
                      record.uri
                    );
                  assert(match && match[1] === owner.did);
                  const current = await rpc.get('com.atproto.repo.getRecord', {
                    params: {
                      repo: owner.did as Did,
                      collection: match[2] as
                        | 'site.standard.graph.subscription'
                        | 'site.standard.graph.recommend',
                      rkey: match[4],
                    },
                  });
                  if (!current.ok && current.data.error === 'RecordNotFound')
                    continue;
                  const value = ok(current);
                  const field =
                    record.kind === 'subscription' ? 'publication' : 'document';
                  assert.equal(
                    (value.value as Record<string, unknown>)[field],
                    record.target,
                    'An owned key now targets another object. Refuse cleanup.'
                  );
                  if (record.cid)
                    assert.equal(
                      value.cid,
                      record.cid,
                      'An owned record was changed by another client. Refuse cleanup.'
                    );
                  await ok(
                    rpc.post('com.atproto.repo.deleteRecord', {
                      input: {
                        repo: owner.did as Did,
                        collection: match[2] as
                          | 'site.standard.graph.subscription'
                          | 'site.standard.graph.recommend',
                        rkey: match[4],
                        swapRecord: value.cid,
                      },
                    })
                  );
                  const absent = await rpc.get('com.atproto.repo.getRecord', {
                    params: {
                      repo: owner.did as Did,
                      collection: match[2] as
                        | 'site.standard.graph.subscription'
                        | 'site.standard.graph.recommend',
                      rkey: match[4],
                    },
                  });
                  assert(
                    !absent.ok && absent.data.error === 'RecordNotFound',
                    'An owned record must be confirmed absent before grant revocation.'
                  );
                }
              };
              if (owner.dpopSpkiSha256)
                await withOAuthLock(`oauth-session-${owner.did}`, cleanRecords);
              else await cleanRecords();
            }
          } catch {
            recordsClean = false;
            pending.push(
              `Owned record cleanup needs recovery for ${owner.did}.`
            );
          }
          owner.recordsClean = recordsClean;
          await journalOwnership();
          const token = browserTokens.get(owner.sessionHash);
          if (token) {
            try {
              const ended = await fetch(`${ORIGIN}/api/atproto/logout`, {
                method: 'POST',
                headers: {
                  origin: ORIGIN,
                  'content-type': 'application/json',
                  cookie: `atproto_session=${token}`,
                },
                body: '{}',
                signal: AbortSignal.timeout(60000),
              });
              assert.equal(ended.status, 200);
              assert.equal(
                (
                  await db.sql`SELECT token_hash FROM atproto_browser_sessions WHERE token_hash = ${owner.sessionHash}`
                ).rows.length,
                0
              );
            } catch {
              pending.push(
                `Owned browser session cleanup needs recovery for ${owner.did}.`
              );
            }
          }
          if (
            owner.grantCreated &&
            !owner.grantRevoked &&
            recordsClean &&
            !revoked.has(owner.did)
          ) {
            try {
              await withOAuthLock(`oauth-session-${owner.did}`, async () => {
                const stored =
                  await db.sql`SELECT key_hash, encrypted_value, expires_at FROM atproto_oauth_sessions WHERE key_hash = ${hash(owner.did)}`;
                assert(stored.rows.length === 1);
                if (owner.dpopSpkiSha256) {
                  assert(grantIntent?.callbackCompleted);
                  assertGrantBinding(
                    grantIntent,
                    decryptOAuthValue<StoredSession>(
                      stored.rows[0].encrypted_value as string,
                      settings.ATPROTO_OAUTH_STORAGE_KEY
                    )
                  );
                }
                const backupName = `provider-grant-${hash(owner.did)}.json`;
                await save(backupName, {
                  did: owner.did,
                  keyHash: stored.rows[0].key_hash,
                  encryptedValue: stored.rows[0].encrypted_value,
                  expiresAt: new Date(stored.rows[0].expires_at).toISOString(),
                });
                await oauthClient().revoke(owner.did as Did);
                revoked.add(owner.did);
                owner.grantRevoked = true;
                await journalOwnership();
                const { unlink } = await import('node:fs/promises');
                if (!owner.dpopSpkiSha256)
                  await unlink(resolve(values.output!, backupName));
              });
            } catch {
              pending.push(
                `New test provider grant revocation needs recovery for ${owner.did}.`
              );
            }
          }
        }
        if (existingOnly) {
          try {
            assert(authorizationBaseline);
            const identities = await loadOwnedAcceptanceIdentities(
              settings.ATPROTO_ACCEPTANCE_IDENTITIES_JOURNAL,
              settings.NEXT_PUBLIC_ATPROTO_DID
            );
            for (const state of authorizationStates) {
              assert(/^[a-f0-9]{64}$/.test(state.key));
              assert(
                [identities.publisher.did, identities.visitor.did].includes(
                  state.did
                )
              );
              assert(
                !authorizationBaseline.database.states.some(
                  (row) => row.key === state.key
                )
              );
              const rows =
                await db.sql`SELECT encrypted_value FROM atproto_oauth_states WHERE key_hash = ${state.key}`;
              if (rows.rows.length) {
                assert.equal(rows.rows.length, 1);
                assert.equal(
                  hash(rows.rows[0].encrypted_value as string),
                  state.encryptedHash
                );
                assert.equal(
                  decryptOAuthValue<StoredState>(
                    rows.rows[0].encrypted_value as string,
                    settings.ATPROTO_OAUTH_STORAGE_KEY
                  ).sub,
                  state.did
                );
                assert.equal(
                  (
                    decryptOAuthValue<StoredState>(
                      rows.rows[0].encrypted_value as string,
                      settings.ATPROTO_OAUTH_STORAGE_KEY
                    ).userState as { browserHash?: string }
                  ).browserHash,
                  state.flowHash
                );
                await db.sql`DELETE FROM atproto_oauth_states WHERE key_hash = ${state.key} AND encrypted_value = ${rows.rows[0].encrypted_value}`;
              }
            }
            const expiredStatesPrunedByRuntime = await assertBaselineDatabase(
              authorizationBaseline
            );
            assert.deepEqual(
              await visitorGraphs(),
              authorizationBaseline.graphs
            );
            await save('authorization-cleanup.json', {
              checkedAt: new Date().toISOString(),
              status: 'passed',
              runtimeRevision: runtimeRevision,
              unexpiredDatabaseRowsPreserved: true,
              expiredStatesPrunedByRuntime,
              visitorGraphsRestored: true,
              baselineCounts: Object.fromEntries(
                Object.entries(authorizationBaseline.database).map(
                  ([name, rows]) => [name, rows.length]
                )
              ),
            });
          } catch {
            pending.push(
              'Limited authorization cleanup has not proven the exact baseline database and visitor graph inventories. Preserve its private journals.'
            );
          }
        }
        await save('capture-cleanup.json', {
          checkedAt: new Date().toISOString(),
          status: pending.length ? 'pending' : 'passed',
          pending,
          owned: ownership,
          providerRevocation:
            'SDK request and local deletion; independent owned-provider inventory must confirm remote invalidation.',
        });
      }
    } finally {
      const names = ['browser', 'database pool', 'shared database pool'];
      const cleanup = await Promise.allSettled([
        browser.close(),
        db.end(),
        sql.end(),
      ]);
      const failed = cleanup.flatMap((result, index) =>
        result.status === 'rejected' ? [names[index]] : []
      );
      if (failed.length) {
        pending.push(
          ...failed.map((name) => `The ${name} still needs resource cleanup.`)
        );
        await save('browser-resource-cleanup.json', {
          checkedAt: new Date().toISOString(),
          status: 'pending',
          failed,
        });
        if (recoveryVerified && ownershipVerified)
          await save('capture-cleanup.json', {
            checkedAt: new Date().toISOString(),
            status: 'pending',
            pending,
            owned: ownership,
          });
      }
    }
    const { unlink } = await import('node:fs/promises');
    if (pending.length === 0)
      for (const name of [
        ...pendingGrants
          .filter((intent) =>
            ownership.some(
              (owner) =>
                owner.sessionHash === intent.responseSessionHash &&
                owner.grantRevoked &&
                owner.recordsClean &&
                owner.inventoryComplete
            )
          )
          .map((intent) => `pending-callback-${intent.stateHash}.json`),
        ...ownership
          .filter((owner) => owner.grantRevoked && !owner.dpopSpkiSha256)
          .map((owner) => `provider-grant-${hash(owner.did)}.json`),
        'cleanup-credentials.json',
        'cookies-primary.json',
        'cookies-second.json',
        'callback-primary.json',
        'callback-second.json',
        'callback-cancelled.json',
        'callback-cancelled-signed-out.json',
        'callback-expired.json',
      ]) {
        await unlink(resolve(values.output!, name)).catch(
          (error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
          }
        );
      }
    browserCleanupSucceeded = pending.length === 0;
    if (pending.length === 0 && deliveryFailureObserved) {
      const receipt = JSON.parse(
        await readFile(
          resolve(values.output!, 'cookie-delivery-receipt.json'),
          'utf8'
        )
      );
      await save('cookie-delivery-receipt.json', {
        ...receipt,
        status: 'passed',
        exactLocalCleanup: true,
        providerRevocation: 'External provider inventory remains required.',
      });
    }
    assert(
      pending.length === 0,
      'Owned capture cleanup is incomplete. The private ownership and cleanup receipts identify recovery work.'
    );
  }
}
await main()
  .catch(async (error: unknown) => {
    try {
      const failurePath = resolve(recoveryPath, 'capture-failure.json');
      await writeFile(
        failurePath,
        JSON.stringify(
          {
            phase,
            name: error instanceof Error ? error.name : 'UnknownError',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          null,
          2
        ) + '\n',
        { mode: 0o600 }
      );
      await chmod(failurePath, 0o600);
    } catch {
      // A setup failure may precede creation of the private recovery directory.
    }
    console.error(
      `Acceptance capture failed during ${phase}. Private recovery receipts are in ${recoveryPath}. Provider URLs, credentials, and cookie values are withheld.`
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    let notificationClean = true;
    if (notificationCleanup) {
      try {
        await notificationCleanup();
      } catch {
        notificationClean = false;
        process.exitCode = 1;
        console.error(
          `Notification workflow cleanup remains pending. Preserve the fixture and use the private recovery directory ${recoveryPath}.`
        );
      }
    }
    let lifecycleClean = notificationClean;
    if (lifecycleCleanup && notificationClean) {
      try {
        await lifecycleCleanup();
      } catch {
        lifecycleClean = false;
        console.error(
          `Lifecycle PDS cleanup remains pending. Its private receipts are in ${recoveryPath}.`
        );
        process.exitCode = 1;
      }
    }
    let sourceClean = true;
    if (
      sourceCleanup &&
      lifecycleClean &&
      browserCleanupSucceeded &&
      (publicationCleanupVerified || fixtureCleanup)
    ) {
      try {
        await sourceCleanup();
        console.log(
          'The unchanged owned source is removed, and the clean acceptance deployment returns 404.'
        );
      } catch {
        sourceClean = false;
        process.exitCode = 1;
        console.error(
          `Owned source/deployment cleanup remains pending in ${recoveryPath}.`
        );
      }
    } else if (sourceCleanup) sourceClean = false;
    let finalNotificationClean = notificationClean;
    if (
      fixtureCleanup &&
      lifecycleClean &&
      sourceClean &&
      browserCleanupSucceeded &&
      finalNotification
    ) {
      try {
        await finalNotification();
      } catch {
        process.exitCode = 1;
        try {
          await notificationCleanup!();
        } catch {
          finalNotificationClean = false;
        }
        console.error(
          `The final notification check did not pass. Its private run/drain journal is in ${recoveryPath}.`
        );
      }
    }
    if (
      fixtureCleanup &&
      lifecycleClean &&
      sourceClean &&
      browserCleanupSucceeded &&
      finalNotificationClean
    ) {
      try {
        await fixtureCleanup();
        publicationCleanupVerified = true;
        console.log(
          'Final notification handlers are drained. The owned document is absent, and the publication is removed or restored. Foreign records remain unchanged.'
        );
      } catch {
        process.exitCode = 1;
        console.error(`Final PDS cleanup remains pending in ${recoveryPath}.`);
      }
    }
  });
