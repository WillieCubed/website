import type {} from '@atcute/atproto';
import { Client, ok } from '@atcute/client';
import type { Did } from '@atcute/lexicons';
import type { StoredSession, StoredState } from '@atcute/oauth-node-client';
import { type Page, chromium } from '@playwright/test';
import matter from 'gray-matter';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, createPublicKey } from 'node:crypto';
import { chmod, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

import {
  type PostgresPool,
  createPool,
  sql,
} from '../../../../../lib/db/postgres';
import {
  checkNotificationWorkflow,
  externalChecks,
  recoverNotificationWorkflow,
  verifyAcceptanceVideoAccount,
} from '../../../../support/publishing/external-checks.mts';
import { fixtureSource } from '../../../../support/publishing/fixture-source.mts';
import { loadOwnedAcceptanceIdentities } from '../../../../support/publishing/identities/run.mts';
import type { ProvisionedAccount } from '../../../../support/publishing/identities/types.mts';
import { isMain } from '../../../../support/publishing/runtime.mts';
import {
  captureSocialLogout,
  captureSocialState,
  recoverSocialFailures,
  socialUiFailures,
} from '../../../../support/publishing/social-browser.mts';
import { verifyAuthorizationOnly as verifyAuthorizationOnlyWithContext } from './authorization-proof.mts';
import { authorizeOwnedProvider as authorizeOwnedProviderWithContext } from './authorize-provider.mts';
import { captureSetup } from './config.mts';
import { assertDeliveryProbe } from './delivery-proof.mts';
import { finishCapture } from './finish.mts';
import { CallbackDeliveryWithheld, flow as flowWithContext } from './flow.mts';
import { graphFor as graphForWithContext } from './graphs.mts';
import { CaptureLedger } from './ledger.mts';
import { run } from './process.mts';
import { recoverPendingGrant as recoverPendingGrantWithContext } from './recover-grant.mts';
import { verifyExistingRuntime as verifyExistingRuntimeWithContext } from './runtime-proof.mts';
import { settleUiMutation as settleUiMutationWithContext } from './settle-mutation.mts';
import { captureSourceManifest } from './sources.mts';
import type {
  AuthorizationBaseline,
  CapturedFlow,
  OwnedBrowser,
  OwnedSocialRecord,
  PendingGrant,
  RunContext,
} from './types.mts';

export async function runSocialCapture() {
  const runState: RunContext = {
    notificationCleanup: undefined,
    finalNotification: undefined,
    fixtureCleanup: undefined,
    sourceCleanup: undefined,
    lifecycleCleanup: undefined,
    publicationCleanupVerified: true,
    browserCleanupSucceeded: true,
    phase: 'input validation',
    recoveryPath: 'the selected private output directory',
  };
  async function main(runState: RunContext) {
    const setup = await captureSetup(runState);
    const { settings, socialOnly, socialRevision, authorizationOnly } = setup;
    const {
      ORIGIN,
      OWNER,
      authorizationRevision,
      root,
      values,
      fixturePublicationJournal,
      currentSocialFixture,
      existingOnly,
      runtimeRevision,
      workspace,
      ownedIdentities,
      env,
    } = setup;
    async function verifyExistingRuntime() {
      return verifyExistingRuntimeWithContext({
        settings,
        ORIGIN,
        runtimeRevision,
        socialOnly,
        values,
        currentSocialFixture,
        workspace,
        socialRevision,
        root,
        fixturePublicationJournal,
      });
    }
    let verifierPaths: string[] = [];
    async function verifierHashes(): Promise<Record<string, string>> {
      const hashes = Object.fromEntries(
        await Promise.all(
          verifierPaths.map(async (path) => [
            path,
            createHash('sha256')
              .update(await readFile(resolve(root, path)))
              .digest('hex'),
          ])
        )
      );
      return {
        ...hashes,
        ...(await captureSourceManifest()),
      };
    }
    const { existingRuntime, localVerifier } = await prepareVerifier();
    // Publishing configuration reads its environment when the module loads.
    const { fixtureJournal } =
      await import('../../../../support/publishing/fixture-journal.mts');
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
    const hasLifecycleReceipt = await prepareRecoveryResources();
    await verifyPublishingLifecycle();
    if (await recoverPublicationOwnership()) return;
    if (await recoverCompletedBrowserCleanup()) return;
    runState.phase = 'browser authorization';
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
    runState.browserCleanupSucceeded = false;
    const { first, second, db, decryptOAuthValue, terminal } =
      await (async () => {
        let setupDb: PostgresPool | undefined;
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
            await import('../../../../../lib/atproto/oauth-crypto');
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
          runState.browserCleanupSucceeded = cleanup.every(
            (result) => result.status === 'fulfilled'
          );
          const path = resolve(values.output!, 'browser-setup-cleanup.json');
          await writeFile(
            path,
            JSON.stringify(
              {
                observedAt: new Date().toISOString(),
                phase: 'browser setup',
                status: runState.browserCleanupSucceeded ? 'passed' : 'pending',
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
              phase: runState.phase,
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
      return graphForWithContext(
        {
          settings,
          values,
        },
        did,
        action,
        targetOnly
      );
    }

    const ledger = new CaptureLedger({
      output: values.output!,
      origin: ORIGIN,
      publisher: settings.NEXT_PUBLIC_ATPROTO_DID,
      forbiddenOwner: OWNER,
      providerOrigin: settings.ATPROTO_ACCEPTANCE_PROVIDER_ORIGIN,
    });
    async function settleUiMutation(owner: OwnedBrowser) {
      return settleUiMutationWithContext(
        {
          settings,
          graphFor,
          ledger,
        },
        owner
      );
    }

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
    function assertGrantBinding(intent: PendingGrant, stored: StoredSession) {
      assert.equal(stored.tokenSet.sub, intent.did);
      assert.equal(stored.tokenSet.iss, intent.issuer);
      assert.equal(new URL(stored.tokenSet.aud).href, intent.audience);
      assert.equal(publicDpopHash(stored.dpopKey), intent.dpopSpkiSha256);
    }
    async function recoverPendingGrant(intent: PendingGrant) {
      return recoverPendingGrantWithContext(
        {
          ownedIdentities,
          settings,
          authorizationBaseline,
          hash,
          values,
          db,
          assertGrantBinding,
          decryptOAuthValue,
          graphFor,
          ledger,
        },
        intent
      );
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

    async function assertBaselineDatabase(
      baseline: AuthorizationBaseline,
      pool = db
    ) {
      const current = await databaseInventory(pool);
      const expected = {
        ...baseline.database,
        states: baseline.database.states.filter(
          (row) =>
            !baseline.expiredStates.some(
              (expired) => expired.key === row.key
            ) || current.states.some((present) => present.key === row.key)
        ),
      };
      assert.deepEqual(current, expected);
      return baseline.expiredStates.filter(
        (row) => !current.states.some((present) => present.key === row.key)
      );
    }
    let authorizationBaseline: AuthorizationBaseline | undefined;
    async function verifyAuthorizationOnly(
      granted: CapturedFlow,
      grantedSecond: CapturedFlow,
      cancelled: CapturedFlow,
      expired: CapturedFlow,
      signedOutCancellation: CapturedFlow
    ) {
      return verifyAuthorizationOnlyWithContext(
        {
          flow,
          existingRuntime,
          localVerifier,
          authorizationBaseline,
          save,
          first,
          second,
          ORIGIN,
          hash,
          db,
          decryptOAuthValue,
          settings,
          graphFor,
          databaseInventory,
          visitorGraphs,
          root,
          values,
          env,
          verifyExistingRuntime,
          verifierHashes,
        },
        granted,
        grantedSecond,
        cancelled,
        expired,
        signedOutCancellation
      );
    }
    async function authorizeOwnedProvider(
      page: Page,
      identity: ProvisionedAccount,
      providerOrigin: string,
      expectation: 'grant' | 'cancel' | 'expired'
    ) {
      return authorizeOwnedProviderWithContext(
        {
          first,
          ownedIdentities,
          OWNER,
          ORIGIN,
        },
        page,
        identity,
        providerOrigin,
        expectation
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
      return flowWithContext(
        {
          resolveHandle,
          ownedIdentities,
          db,
          hash,
          graphFor,
          ORIGIN,
          values,
          authorizationOnly,
          recordOperationFailure,
          save,
          decryptOAuthValue,
          settings,
          existingOnly,
          authorizationBaseline,
          publicDpopHash,
          authorizeOwnedProvider,
          assertGrantBinding,
          recoverPendingGrant,
          authorizationRevision,
          localVerifier,
          ledger,
        },
        context,
        handle,
        expectation,
        filename,
        action,
        withholdDelivery
      );
    }
    let recoveryVerified = !values['cleanup-only'];
    let captureFailurePhase: string | undefined;
    try {
      await prepareAuthorizationBaseline();
      if (!values['cleanup-only']) await ledger.initialize();
      await restoreCaptureOwnership();
      await captureAuthorizedVisitors();
    } catch (error) {
      if (error instanceof CallbackDeliveryWithheld) {
        deliveryFailureObserved = true;
        return;
      }
      captureFailurePhase = runState.phase;
      await recordOperationFailure(error).catch(() => {});
      throw error;
    } finally {
      await cleanupCapture();
    }
    async function prepareVerifier() {
      const existingRuntime =
        existingOnly && !values['cleanup-only']
          ? await verifyExistingRuntime()
          : undefined;
      verifierPaths =
        existingOnly && !values['cleanup-only']
          ? [
              'scripts/atproto-social-capture.mts',
              'scripts/atproto-social-failures.mts',
              'scripts/atproto-acceptance-identities.mts',
              'scripts/atproto-callback-proof.mts',
              'scripts/atproto-refresh-acceptance.mts',
              'lib/site/identity.ts',
              'lib/site/urls.ts',
              'lib/writings/load.ts',
              'lib/writings/index.ts',
              ...(await readdir(resolve(root, 'lib/atproto')))
                .filter((name) => name.endsWith('.ts'))
                .map((name) => `lib/atproto/${name}`),
            ]
          : [];
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

      return { existingRuntime, localVerifier };
    }
    async function prepareRecoveryResources(): Promise<boolean> {
      if (!values['cleanup-only'] && !existingOnly)
        await verifyAcceptanceVideoAccount();
      await mkdir(values.output!, { recursive: true, mode: 0o700 });
      await chmod(values.output!, 0o700);
      await recordRunScope();
      if (!existingOnly)
        runState.notificationCleanup = async () => {
          await recoverNotificationWorkflow(values.output!, workspace);
          await recoverNotificationWorkflow(
            values.output!,
            workspace,
            'final-notification-workflow.json'
          );
        };
      if (!existingOnly)
        runState.finalNotification = () =>
          checkNotificationWorkflow(
            values.output!,
            workspace,
            'final-notification-workflow.json'
          );
      const lifecycleNames = ['standard-site', 'bluesky', 'hosted-atmosphere'];
      const hasLifecycleReceipt = await lifecycleReceiptExists();
      if (!existingOnly)
        runState.lifecycleCleanup = async () => {
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
                ...(name === 'hosted-atmosphere'
                  ? ['--slug', values.slug!]
                  : []),
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
        runState.sourceCleanup = () =>
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

      return hasLifecycleReceipt;
    }
    async function lifecycleReceiptExists(): Promise<boolean> {
      const lifecycleNames = ['standard-site', 'bluesky', 'hosted-atmosphere'];
      let hasLifecycleReceipt = false;
      for (const name of lifecycleNames) {
        try {
          await readFile(
            resolve(values.output!, `${name}-receipt.json`),
            'utf8'
          );
          hasLifecycleReceipt = true;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }

      return hasLifecycleReceipt;
    }
    function captureScopeName(): string {
      return socialOnly
        ? 'real-social-only'
        : authorizationOnly
          ? 'atproto-authorization-and-subscription'
          : values['defer-bluesky']
            ? 'standard-site-and-atproto-social'
            : 'full';
    }
    function captureScopeChecks() {
      return {
        ...(existingOnly && {
          recommendations: { status: 'pending', deferred: !socialOnly },
          socialFailureStates: {
            status: 'pending',
            deferred: !socialOnly,
          },
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
      };
    }
    async function recordRunScope(): Promise<void> {
      if (!values['cleanup-only']) {
        const scopePath = resolve(values.output!, 'run-scope.json');
        await writeFile(
          scopePath,
          JSON.stringify(
            {
              createdAt: new Date().toISOString(),
              origin: ORIGIN,
              publisher: settings.NEXT_PUBLIC_ATPROTO_DID,
              scope: captureScopeName(),
              fullVerification: 'pending',
              ...(values['cookie-delivery-failure'] && {
                probe: 'real-callback-browser-delivery-failure',
              }),
              ...(existingOnly && { runtimeRevision }),
              ...(currentSocialFixture && { dirtyFixtureOverlay: true }),
              ...(socialOnly && {
                fixtureSourceJournal: resolve(
                  values['fixture-source-journal']!
                ),
                fixturePublicationJournal,
              }),
              ...(localVerifier && { localVerifier }),
              checks: captureScopeChecks(),
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
    }
    async function verifyPublishingLifecycle(): Promise<void> {
      if (values['cleanup-only'] || existingOnly) return;
      runState.phase = 'isolated publishing lifecycle';
      console.log(
        values['defer-bluesky']
          ? 'Step 3: Verify the isolated Standard.site lifecycle and extension round trips. Bluesky lifecycle checks remain deferred and pending.'
          : 'Step 3: Verify the isolated Standard.site lifecycle and extension round trips, then real Bluesky syndication and responses.'
      );
      const { fixture, original, temporary } = await prepareLifecycleFixture();
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
      const publishing = await publishFixture();
      if (!values['defer-bluesky']) {
        runState.phase = 'hosted Atmosphere response verification';
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
      runState.phase = 'independent validation and branch workflow';
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
    async function prepareLifecycleFixture() {
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

      return { fixture, original, temporary };
    }
    async function publishFixture() {
      runState.phase = 'acceptance deployment';
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
      runState.publicationCleanupVerified = false;
      const publishing = await fixtureJournal(
        values.output!,
        values.slug!,
        new Date(fixtureMetadata.published)
      );
      runState.fixtureCleanup = async () => {
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

      return publishing;
    }
    async function recoverPublicationOwnership(): Promise<boolean> {
      if (await recoverFixturePublication()) return true;
      if (
        values['cleanup-only'] &&
        (runState.sourceCleanup ||
          runState.fixtureCleanup ||
          hasLifecycleReceipt)
      ) {
        try {
          await readFile(
            resolve(values.output!, 'cleanup-ownership.json'),
            'utf8'
          );
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
          throw error;
        }
      }

      return false;
    }
    async function recoverFixturePublication(): Promise<boolean> {
      if (values['cleanup-only'] && !existingOnly) {
        try {
          await readFile(
            resolve(values.output!, 'fixture-publication-journal.json'),
            'utf8'
          );
          runState.publicationCleanupVerified = false;
          const publishing = await fixtureJournal(
            values.output!,
            values.slug!,
            undefined,
            true
          );
          runState.fixtureCleanup = async () => {
            await publishing.observe();
            await publishing.cleanup();
          };
          try {
            await readFile(
              resolve(values.output!, 'cleanup-ownership.json'),
              'utf8'
            );
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
            throw error;
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }

      return false;
    }
    async function recoverCompletedBrowserCleanup(): Promise<boolean> {
      if (values['cleanup-only']) {
        runState.browserCleanupSucceeded = false;
        let completed:
          | {
              status: string;
              pending: string[];
              owned: OwnedBrowser[];
            }
          | undefined;
        try {
          completed = JSON.parse(
            await readFile(
              resolve(values.output!, 'capture-cleanup.json'),
              'utf8'
            )
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
          ) as {
            origin: string;
            publisher: string;
            owned: typeof completed.owned;
          };
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
            await verifyCompletedDatabase();
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
          await readCompletedPendingGrants();
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
          await recordCompletedDeliveryProbe();
          runState.browserCleanupSucceeded = true;
          return true;
          async function verifyCompletedDatabase(): Promise<void> {
            if (existingOnly) {
              const baseline = JSON.parse(
                await readFile(
                  resolve(values.output!, 'authorization-baseline.json'),
                  'utf8'
                )
              ) as AuthorizationBaseline;
              assert.equal(baseline.origin, ORIGIN);
              assert.equal(
                baseline.publisher,
                settings.NEXT_PUBLIC_ATPROTO_DID
              );
              assert.equal(baseline.runtimeRevision, runtimeRevision);
              await assertBaselineDatabase(baseline, terminalDb);
              assert.deepEqual(await visitorGraphs(), baseline.graphs);
            }
            for (const owner of journal.owned)
              await verifyCompletedOwner(owner);
          }
          async function verifyCompletedOwner(
            owner: OwnedBrowser
          ): Promise<void> {
            const { resolvePds } =
              await import('../../../../../lib/atproto/identity');

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
          async function readCompletedPendingGrants(): Promise<void> {
            try {
              const ledger = JSON.parse(
                await readFile(
                  resolve(values.output!, 'pending-grants.json'),
                  'utf8'
                )
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
              if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
                throw error;
            }
          }
          async function recordCompletedDeliveryProbe(): Promise<void> {
            if (completedPending.length) {
              try {
                const probe = JSON.parse(
                  await readFile(
                    resolve(values.output!, 'cookie-delivery-receipt.json'),
                    'utf8'
                  )
                );
                assertDeliveryProbe(probe, completedPending);
                await save('cookie-delivery-receipt.json', {
                  ...probe,
                  status: 'passed',
                  exactLocalCleanup: true,
                  providerRevocation:
                    'External provider inventory remains required.',
                });
              } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
                  throw error;
              }
            }
          }
        }
      }

      return false;
    }
    async function prepareAuthorizationBaseline(): Promise<void> {
      if (existingOnly) {
        if (values['cleanup-only']) {
          authorizationBaseline = JSON.parse(
            await readFile(
              resolve(values.output!, 'authorization-baseline.json'),
              'utf8'
            )
          ) as AuthorizationBaseline;
          await ledger.restoreIssuedStates();
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
          await save('authorization-states.json', ledger.issuedStates());
        }
        assert.equal(authorizationBaseline.origin, ORIGIN);
        assert.equal(
          authorizationBaseline.publisher,
          settings.NEXT_PUBLIC_ATPROTO_DID
        );
        assert.equal(authorizationBaseline.runtimeRevision, runtimeRevision);
      }
    }
    async function restoreCaptureOwnership(): Promise<void> {
      if (!values['cleanup-only']) return;
      try {
        await ledger.restorePendingGrants();
        if (ledger.pendingGrants().length > 0) {
          const probe = JSON.parse(
            await readFile(
              resolve(values.output!, 'cookie-delivery-receipt.json'),
              'utf8'
            )
          );
          assertDeliveryProbe(probe, ledger.pendingGrants());
          deliveryFailureObserved = true;
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      await ledger.restoreBrowsers();
      recoveryVerified = true;
    }
    async function captureAuthorizedVisitors(): Promise<void> {
      if (values['cleanup-only']) return;
      await probeCallbackDelivery();
      let signedOutCancellation: CapturedFlow | undefined;
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
      const { primaryDid, granted } = await authorizePrimaryVisitor();
      const { secondHandle, grantedSecond } =
        await authorizeSecondVisitor(primaryDid);
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
      await verifySocialUiMutations(granted, primaryDid);
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
      await recordSocialOnlyResult();
      console.log(
        socialOnly
          ? `Real social checks finished. Publishing lifecycles, hosted responses, independent validation and full verification remain pending. Owned social cleanup follows. Parent-owned fixture and alias recovery remain separate. Evidence remains at ${values.output}.`
          : values['defer-bluesky']
            ? `Real account checks finished. Bluesky lifecycle and hosted Atmosphere response checks remain pending, so full verification is incomplete. Owned cleanup follows. Evidence and screenshots remain at ${values.output}.`
            : `Real account checks finished. Owned cleanup follows before private captures are removed. Evidence and screenshots remain at ${values.output}.`
      );
      async function probeCallbackDelivery(): Promise<void> {
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
      }
      async function authorizePrimaryVisitor() {
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

        return { primaryDid, granted };
      }
      async function authorizeSecondVisitor(primaryDid: string) {
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

        return { secondHandle, grantedSecond };
      }
      async function verifySocialUiMutations(
        granted: CapturedFlow,
        primaryDid: string
      ): Promise<void> {
        if (ownedIdentities) {
          const captured = ledger.browser(granted.grant.sessionHash);
          assert(captured);
          let owner = captured;
          async function finishUiMutation(
            kind: 'subscription' | 'recommendation'
          ) {
            assert(owner);
            await settleUiMutation(owner);
            const records = await graphFor(owner.did, kind);
            owner = await ledger.completeMutation(
              owner.sessionHash,
              records.map((record) => ({
                uri: record.uri,
                cid: record.cid,
                kind,
                target: record.value[
                  kind === 'subscription' ? 'publication' : 'document'
                ] as string,
              }))
            );
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
                const { loadWriting } =
                  await import('../../../../../lib/writings/load');
                const { documentRkey } =
                  await import('../../../../../lib/atproto/keys');
                const { writing } = await loadWriting(values.slug!);
                const target =
                  kind === 'subscription'
                    ? `at://${settings.NEXT_PUBLIC_ATPROTO_DID}/site.standard.publication/${settings.ATPROTO_PUBLICATION_RKEY}`
                    : `at://${settings.NEXT_PUBLIC_ATPROTO_DID}/site.standard.document/${documentRkey(`/writings/${values.slug}`, writing.published)}`;
                owner = await ledger.beginMutation(
                  owner.sessionHash,
                  kind,
                  target,
                  before.map(({ uri, cid }) => ({ uri, cid }))
                );
              },
              dispatchedMutation: async (kind) => {
                owner = await ledger.markMutationDispatched(
                  owner.sessionHash,
                  kind
                );
              },
              afterMutation: async (kind) => {
                owner = await ledger.markMutationResponse(
                  owner.sessionHash,
                  kind
                );
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
      }
      async function recordSocialOnlyResult(): Promise<void> {
        if (socialOnly) {
          assert(existingRuntime && localVerifier);
          assert.deepEqual(await verifyExistingRuntime(), existingRuntime);
          assert.deepEqual(await verifierHashes(), localVerifier.sourceHashes);
          const social = JSON.parse(
            await readFile(
              resolve(values.output!, 'social-receipt.json'),
              'utf8'
            )
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
      }
    }
    async function cleanupCapture(): Promise<void> {
      runState.phase = captureFailurePhase ?? 'owned capture cleanup';
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
          await reconcileRunnerOwnership();
          const { withOAuthLock } =
            await import('../../../../../lib/atproto/oauth-storage');
          for (const intent of ledger.pendingGrants()) {
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
          for (const owner of ledger.browsers())
            await cleanupOwner(owner, revoked);
          await restoreAuthorizationBaseline();
          await save('capture-cleanup.json', {
            checkedAt: new Date().toISOString(),
            status: pending.length ? 'pending' : 'passed',
            pending,
            owned: ledger.browsers(),
            providerRevocation:
              'SDK request and local deletion; independent owned-provider inventory must confirm remote invalidation.',
          });
        }
      } finally {
        await closeBrowserResources();
      }
      await removeCompletedCredentials();
      runState.browserCleanupSucceeded = pending.length === 0;
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
      async function closeBrowserResources(): Promise<void> {
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
              owned: ledger.browsers(),
            });
        }
      }
      async function removeCompletedCredentials(): Promise<void> {
        const { unlink } = await import('node:fs/promises');
        if (pending.length === 0)
          for (const name of [
            ...ledger
              .pendingGrants()
              .filter((intent) =>
                ledger
                  .browsers()
                  .some(
                    (owner) =>
                      owner.sessionHash === intent.responseSessionHash &&
                      owner.grantRevoked &&
                      owner.recordsClean &&
                      owner.inventoryComplete
                  )
              )
              .map((intent) => `pending-callback-${intent.stateHash}.json`),
            ...ledger
              .browsers()
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
      }
      async function cleanupOwner(
        owner: OwnedBrowser,
        revoked: Set<string>
      ): Promise<void> {
        const { oauthClient } =
          await import('../../../../../lib/atproto/oauth');
        const { withOAuthLock } =
          await import('../../../../../lib/atproto/oauth-storage');

        assert(owner.did !== OWNER);
        const grantIntent = ledger
          .pendingGrants()
          .find(
            (intent) =>
              intent.did === owner.did &&
              intent.dpopSpkiSha256 === owner.dpopSpkiSha256
          );
        if (!(await verifyGrantIdentity())) return;
        if (!(await recoverInFlightMutation())) return;
        const recordsClean = await cleanupOwnedRecords();
        owner = await ledger.markRecordsClean(owner.sessionHash, recordsClean);
        await logoutOwnedBrowser();
        await revokeOwnedGrant();
        async function verifyGrantIdentity(): Promise<boolean> {
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
              return false;
            }
          }

          return true;
        }
        async function recoverInFlightMutation(): Promise<boolean> {
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
              owner = await ledger.completeMutation(
                owner.sessionHash,
                records.map((record) => ({
                  uri: record.uri,
                  cid: record.cid,
                  kind: intent.kind,
                  target: record.value[
                    intent.kind === 'subscription' ? 'publication' : 'document'
                  ] as string,
                }))
              );
            } catch {
              pending.push(
                `An in-flight mutation needs owned recovery for ${owner.did}. Credentials remain private.`
              );
              return false;
            }
          }

          return true;
        }
        async function cleanupOwnedRecords(): Promise<boolean> {
          let recordsClean = ownershipVerified && owner.inventoryComplete;
          if (!owner.inventoryComplete)
            pending.push(
              `Callback-owned record inventory needs recovery for ${owner.did}.`
            );
          try {
            if (owner.grantRevoked) {
              await verifyRevokedRecordsAbsent();
            } else {
              const cleanRecords = async () => {
                await restoreGrantBackup();
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

          return recordsClean;
        }
        async function verifyRevokedRecordsAbsent(): Promise<void> {
          assert(owner.recordsClean && owner.inventoryComplete);
          const { resolvePds } =
            await import('../../../../../lib/atproto/identity');
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
        }
        async function restoreGrantBackup(): Promise<void> {
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
              backup.did === owner.did && backup.keyHash === hash(owner.did)
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
        }
        async function logoutOwnedBrowser(): Promise<void> {
          await ledger.withBrowserToken(owner.sessionHash, async (token) => {
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
          });
        }

        async function revokeOwnedGrant(): Promise<void> {
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
                owner = await ledger.markGrantRevoked(owner.sessionHash);
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
      }

      async function reconcileRunnerOwnership(): Promise<void> {
        try {
          const runner = JSON.parse(
            await readFile(
              resolve(values.output!, 'social-receipt.json'),
              'utf8'
            )
          ) as { visitor: string; owned: OwnedSocialRecord[] };
          const owner = ledger
            .browsers()
            .find((entry) => entry.did === runner.visitor);
          if (owner) {
            await ledger.mergeRecords(owner.sessionHash, runner.owned ?? []);
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            ownershipVerified = false;
            pending.push(
              'Runner ownership receipt was unavailable or invalid.'
            );
          }
        }
      }
      async function restoreAuthorizationBaseline(): Promise<void> {
        if (existingOnly) {
          try {
            assert(authorizationBaseline);
            const identities = await loadOwnedAcceptanceIdentities(
              settings.ATPROTO_ACCEPTANCE_IDENTITIES_JOURNAL,
              settings.NEXT_PUBLIC_ATPROTO_DID
            );
            for (const state of ledger.issuedStates()) {
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
      }
    }
  }

  await main(runState)
    .catch(async (error: unknown) => {
      try {
        const failurePath = resolve(
          runState.recoveryPath,
          'capture-failure.json'
        );
        await writeFile(
          failurePath,
          JSON.stringify(
            {
              phase: runState.phase,
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
        `Acceptance capture failed during ${runState.phase}. Private recovery receipts are in ${runState.recoveryPath}. Provider URLs, credentials, and cookie values are withheld.`
      );
      process.exitCode = 1;
    })
    .finally(() => finishCapture(runState));
}

if (isMain(import.meta.url)) await runSocialCapture();
