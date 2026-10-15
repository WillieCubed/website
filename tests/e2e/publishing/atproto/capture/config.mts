import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs, parseEnv } from 'node:util';

import { loadOwnedAcceptanceIdentities } from '../../../../support/publishing/identities/run.mts';
import { repositoryRoot } from '../../../../support/publishing/runtime.mts';
import { recoverSocialFailures } from '../../../../support/publishing/social-browser.mts';
import { run } from './process.mts';

export async function captureSetup(runState: {
  recoveryPath: string;
  phase: string;
}) {
  const ORIGIN = 'https://indieweb-acceptance.vercel.app';
  const OWNER = 'did:plc:iyn6nc3ffqm2e3555exyrgvv';
  const authorizationRevision = '3120ee12571e4b186ea85ddfd4a2862b669a396a';
  const legacySocialRevision = '9014e42aeb9c566d7952485fc40bf6137913fe5f';
  const currentSocialRevision = '7f71010c5cf37cb379681e8a0e982f159d6e2a0d';
  const hlsSocialRevision = '4d0ff1f9a76010ff429c84b9917fa6da4416297c';
  const root = repositoryRoot;
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
  runState.recoveryPath = values.output!;
  let authorizationOnly = values['authorization-only'];
  let socialOnly = values['social-only'];
  let socialRevision =
    values['social-runtime-revision'] ?? legacySocialRevision;
  await restoreCleanupScope();
  validateSocialRuntimeScope();
  const fixturePublicationJournal = resolve(
    values['fixture-publication-journal'] ??
      resolve(values.output!, 'fixture-publication-journal.json')
  );
  const currentSocialFixture =
    socialOnly &&
    (socialRevision === currentSocialRevision ||
      socialRevision === hlsSocialRevision);
  validateFixturePublicationScope();
  const existingOnly = authorizationOnly || socialOnly;
  const runtimeRevision = socialOnly ? socialRevision : authorizationRevision;
  validateScopeInputs();
  const workspace = resolve(values.workspace!);
  await validateAcceptanceCheckout();
  runState.phase = 'credential setup';
  console.log('Step 1: Check the isolated checkout and existing credentials.');
  let settings: Record<string, string> = {};
  await configureCredentials();
  validateCredentials();
  Object.assign(process.env, settings);
  await recoverSocialFailures(
    values.output!,
    settings.ATPROTO_ACCEPTANCE_IDENTITIES_JOURNAL,
    settings.NEXT_PUBLIC_ATPROTO_DID
  );
  const ownedIdentities = await captureOwnedIdentities();
  const env = { ...process.env, ...settings };
  Object.assign(process.env, settings);

  return {
    ORIGIN,
    OWNER,
    authorizationRevision,
    legacySocialRevision,
    currentSocialRevision,
    hlsSocialRevision,
    root,
    values,
    authorizationOnly,
    socialOnly,
    socialRevision,
    fixturePublicationJournal,
    currentSocialFixture,
    existingOnly,
    runtimeRevision,
    workspace,
    settings,
    ownedIdentities,
    env,
  };

  async function captureOwnedIdentities() {
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
      assert.notEqual(
        ownedIdentities.visitor.did,
        ownedIdentities.publisher.did
      );
      assert.notEqual(ownedIdentities.visitor.did, OWNER);
    }

    return ownedIdentities;
  }
  async function restoreCleanupScope() {
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
          restoreSocialScope(recordedScope);
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
  }
  function restoreSocialScope(recordedScope: {
    runtimeRevision?: string;
    fixtureSourceJournal?: string;
    fixturePublicationJournal?: string;
  }): void {
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
      ['fixture-publication-journal', recordedScope.fixturePublicationJournal],
    ] as const) {
      if (recorded) {
        if (values[argument]) assert.equal(resolve(values[argument]), recorded);
        values[argument] = recorded;
      }
    }
    socialOnly = true;
  }
  function validateSocialRuntimeScope() {
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
  }
  function validateFixturePublicationScope() {
    assert(
      !currentSocialFixture ||
        values['cleanup-only'] ||
        values['fixture-publication-journal'],
      'The current fixture requires the actual parent publication journal.'
    );
  }
  function validateScopeInputs() {
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
  }
  async function validateAcceptanceCheckout() {
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
  }
  async function configureCredentials() {
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
  }
  function validateSigningKey() {
    const signingKey = JSON.parse(settings.ATPROTO_OAUTH_JWK);
    assert(
      signingKey.kty === 'EC' &&
        signingKey.crv === 'P-256' &&
        signingKey.kid &&
        signingKey.d,
      'The local signing key must be a valid private ES256 JWK.'
    );
  }
  function validateCredentials() {
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
    validateSigningKey();
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
  }
}
