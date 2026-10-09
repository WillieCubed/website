import type { Did } from '@atcute/lexicons';
import type { BrowserContext, Page, Route } from '@playwright/test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import type { RepoClient } from '../lib/atproto/types';
import { themeSchemes } from '../lib/theme';

const ORIGIN = 'https://indieweb-acceptance.vercel.app';
const OWNER = 'did:plc:iyn6nc3ffqm2e3555exyrgvv';
const IMAGE =
  'ghcr.io/bluesky-social/pds@sha256:3a8feb3415e319dbcc13372293b7ef1fb05a318a6ff1d55968cf99ba6633c5d4';
type Snapshot = { uri: string; cid: string; value: Record<string, unknown> };
type Recovery = {
  version: 1;
  origin: string;
  publisher: string;
  identityJournal: string;
  outage?: {
    container: string;
    id: string;
    fingerprint: string;
    intent: boolean;
    recovered?: boolean;
  };
  publication?: {
    rkey: string;
    original: Snapshot;
    changed: Record<string, unknown>;
    intent: boolean;
    restored?: boolean;
  };
};
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
async function privateSave(path: string, value: unknown) {
  const temporary = `${path}.new`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', {
    mode: 0o600,
  });
  await chmod(temporary, 0o600);
  await rename(temporary, path);
}
function docker(args: string[]) {
  try {
    return execFileSync('docker', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error(
      'The owned PDS operation failed. Private Docker output is withheld.'
    );
  }
}
async function ownedContainer(path: string, publisher: string) {
  // Read ownership without a network identity probe so a paused container remains recoverable.
  const journal = JSON.parse(await readFile(path, 'utf8'));
  assert(
    journal.version === 1 &&
      journal.account === '18f90fa11cf0a87145be4a1517e41217'
  );
  assert(journal.domain === 'willieechalmers-18f.workers.dev');
  assert(
    /^[a-f0-9]{10}$/.test(journal.run) && /^[a-f0-9]{64}$/.test(journal.marker)
  );
  assert(
    journal.container === `dev-williecubed-website-pds-${journal.run}` &&
      journal.image === IMAGE
  );
  assert(
    journal.origin === `https://willie-pds-${journal.run}.${journal.domain}`
  );
  assert(
    journal.publisher.did === publisher &&
      publisher !== OWNER &&
      !journal.cleaned
  );
  assert(journal.visitor.did !== OWNER && journal.visitor.did !== publisher);
  assert(journal.data === resolve(dirname(path), 'pds'));
  const container = JSON.parse(docker(['inspect', journal.container]))[0];
  const image = JSON.parse(docker(['image', 'inspect', IMAGE]))[0];
  assert(container.Name === `/${journal.container}`);
  assert(
    container.Config.Labels?.['dev.williecubed.website.acceptance'] ===
      journal.marker
  );
  assert(container.Config.Image === IMAGE && container.Image === image.Id);
  const expected = new Map<string, string>(
    (image.Config.Env ?? []).map((entry: string) => {
      const i = entry.indexOf('=');
      return [entry.slice(0, i), entry.slice(i + 1)];
    })
  );
  for (const [key, value] of Object.entries({
    PDS_HOSTNAME: new URL(journal.origin).hostname,
    PDS_JWT_SECRET: journal.jwtSecret,
    PDS_ADMIN_PASSWORD: journal.adminPassword,
    PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX: journal.rotationKey,
    PDS_DATA_DIRECTORY: '/pds',
    PDS_BLOBSTORE_DISK_LOCATION: '/pds/blocks',
    PDS_BLOB_UPLOAD_LIMIT: '4194304',
    PDS_DID_PLC_URL: 'https://plc.directory',
    PDS_BSKY_APP_VIEW_URL: 'https://api.bsky.app',
    PDS_BSKY_APP_VIEW_DID: 'did:web:api.bsky.app',
    PDS_CRAWLERS: 'https://bsky.network',
    PDS_REPORT_SERVICE_URL: 'https://mod.bsky.app',
    PDS_REPORT_SERVICE_DID: 'did:plc:ar7c4by46qjdydhdevvrndac',
    PDS_RATE_LIMITS_ENABLED: 'true',
    PDS_INVITE_REQUIRED: 'true',
    PDS_SERVICE_HANDLE_DOMAINS: `.${journal.domain}`,
    PDS_EMAIL_SMTP_URL: 'smtp://127.0.0.1:2525',
    PDS_EMAIL_FROM_ADDRESS: 'acceptance@williecubed.dev',
    LOG_ENABLED: 'false',
  }))
    expected.set(key, value as string);
  const actual = new Map(
    container.Config.Env.map((entry: string) => {
      const i = entry.indexOf('=');
      return [entry.slice(0, i), entry.slice(i + 1)];
    })
  );
  // Avoid assertion diffs containing environment secrets.
  assert(
    isDeepStrictEqual(actual, expected),
    'The owned PDS environment changed.'
  );
  assert(
    isDeepStrictEqual(container.Config.Cmd, [
      'sh',
      '-c',
      'node /pds/acceptance-smtp.mjs & exec node --enable-source-maps index.ts',
    ])
  );
  assert(
    isDeepStrictEqual(container.Config.Entrypoint, image.Config.Entrypoint)
  );
  const mounts = container.Mounts.filter(
    (entry: { Destination: string }) => entry.Destination === '/pds'
  );
  assert(mounts.length === 1);
  assert(
    journal.storage?.active
      ? mounts[0].Type === 'volume' &&
          mounts[0].Name === `${journal.container}-data` &&
          mounts[0].Name === journal.storage.volume
      : mounts[0].Type === 'bind' && mounts[0].Source === journal.data
  );
  assert(
    isDeepStrictEqual(container.HostConfig.PortBindings['3000/tcp'], [
      { HostIp: '127.0.0.1', HostPort: String(journal.port) },
    ])
  );
  assert(
    container.HostConfig.Memory === 1073741824 &&
      container.HostConfig.MemorySwap === 1073741824 &&
      container.HostConfig.NanoCpus === 1000000000
  );
  assert(
    container.State.Running,
    'The owned PDS must remain running; recovery never restarts it.'
  );
  const fingerprint = digest(
    JSON.stringify([
      container.Id,
      container.Config,
      container.Image,
      container.Mounts,
      container.HostConfig,
    ])
  );
  return { container, fingerprint, journal };
}
async function restorePublication(recovery: Recovery, client: RepoClient) {
  const entry = recovery.publication;
  if (!entry?.intent) return;
  assert(client.getRecord && client.putRecord);
  const fixture = entry.original;
  assert(
    fixture.uri ===
      `at://${recovery.publisher}/site.standard.publication/${entry.rkey}`
  );
  const current = await client.getRecord(
    'site.standard.publication',
    entry.rkey
  );
  assert(current, 'Never recreate a target removed by another client.');
  if (!isDeepStrictEqual(current.value, fixture.value)) {
    assert(
      isDeepStrictEqual(current.value, entry.changed),
      'The target changed outside this run; refuse restoration.'
    );
    await client.putRecord(
      'site.standard.publication',
      entry.rkey,
      fixture.value,
      current.cid
    );
  }
  const restored = await client.getRecord(
    'site.standard.publication',
    entry.rkey
  );
  assert(
    restored &&
      restored.cid === fixture.cid &&
      isDeepStrictEqual(restored.value, fixture.value),
    'Exact publication value and CID restoration failed.'
  );
  entry.restored = true;
  entry.intent = false;
}
export async function recoverSocialFailures(
  output: string,
  identityJournal: string | undefined,
  publisher: string
) {
  const path = resolve(output, 'social-failure-recovery.json');
  let recovery: Recovery;
  try {
    recovery = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  assert(
    recovery.version === 1 &&
      recovery.origin === ORIGIN &&
      recovery.publisher === publisher &&
      publisher !== OWNER
  );
  assert(
    identityJournal && recovery.identityJournal === resolve(identityJournal)
  );
  if (recovery.outage?.intent) {
    const owned = await ownedContainer(recovery.identityJournal, publisher);
    assert(
      owned.container.Id === recovery.outage.id &&
        owned.fingerprint === recovery.outage.fingerprint &&
        owned.journal.container === recovery.outage.container
    );
    if (owned.container.State.Paused) docker(['unpause', recovery.outage.id]);
    const after = await ownedContainer(recovery.identityJournal, publisher);
    assert(!after.container.State.Paused);
    recovery.outage.intent = false;
    recovery.outage.recovered = true;
    await privateSave(path, recovery);
  }
  if (recovery.publication?.intent) {
    const { createRepoClient } = await import('../lib/atproto/client');
    assert(process.env.ATPROTO_APP_PASSWORD);
    const client = await createRepoClient(process.env.ATPROTO_APP_PASSWORD);
    try {
      await restorePublication(recovery, client);
      await privateSave(path, recovery);
    } finally {
      await client.close();
    }
  }
}
export async function captureSocialState(
  page: Page,
  output: string,
  name: string
) {
  const original = page.viewportSize();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.evaluate((scheme) => {
        document.documentElement.dataset.theme = scheme;
        localStorage.setItem('theme', scheme);
      }, theme);
      // tsx name helpers are unavailable inside Playwright's browser context.
      await page.evaluate(`(async () => {
        await document.fonts.ready;
        await new Promise((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done()))
        );
      })()`);
      // Reduced motion still creates finite color transitions; two frames can capture their old foregrounds.
      await page.waitForFunction(
        `(({ theme, colors }) => {
          const rgb = (hex) => 'rgb(' + [1, 3, 5].map(
            (index) => parseInt(hex.slice(index, index + 2), 16)
          ).join(', ') + ')';
          const root = document.documentElement;
          const body = getComputedStyle(document.body);
          const muted = [...document.querySelectorAll('time.dt-published, .text-muted')].filter(
            (element) => element.getClientRects().length > 0
          );
          const replySurface = document.querySelector('[data-reply-surface].bg-primary');
          const replyButton = replySurface?.querySelector('button[data-post-action]');
          return root.dataset.theme === theme &&
            getComputedStyle(root).colorScheme === theme &&
            body.backgroundColor === rgb(colors.surface) &&
            body.color === rgb(colors.onSurface) &&
            muted.every((element) => getComputedStyle(element).color === rgb(colors.onSurfaceVariant)) &&
            (!replySurface || getComputedStyle(replySurface).backgroundColor === rgb(colors.primary)) &&
            (!replyButton || getComputedStyle(replyButton).color === rgb(colors.onPrimary)) &&
            !document.getAnimations().some((animation) =>
              animation instanceof CSSTransition && animation.playState === 'running'
            );
        })(${JSON.stringify({ theme, colors: themeSchemes[theme] })})`,
        undefined,
        { timeout: 5000, polling: 'raf' }
      );
      assert.equal(
        await page.locator('html').getAttribute('data-theme'),
        theme
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1
        ),
        'The social page must fit the selected viewport.'
      );
      const screenshot = resolve(output, `${name}-${width}-${theme}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      await chmod(screenshot, 0o600);
    }
  }
  if (original) await page.setViewportSize(original);
}
export async function captureSocialLoading(
  page: Page,
  output: string,
  name: string,
  url: string
) {
  assert(new URL(url).origin === ORIGIN);
  const pattern = `${ORIGIN}/api/atproto/social*`;
  let release!: () => void;
  const held = new Promise<void>((done) => {
    release = done;
  });
  let ready!: () => void;
  let failed!: (error: unknown) => void;
  const fetched = new Promise<void>((done, reject) => {
    ready = done;
    failed = reject;
  });
  void fetched.catch(() => {});
  let handlerStarted = false;
  let readinessTimeout: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;
  let fulfilled = false;
  let complete!: () => void;
  const completion = new Promise<void>((done) => {
    complete = done;
  });
  const handler = async (route: Route) => {
    handlerStarted = true;
    try {
      const response = await route.fetch({ timeout: 60000 });
      assert.equal(response.status(), 200);
      ready();
      await held;
      if (cancelled) await route.abort('failed');
      else {
        await route.fulfill({ response });
        fulfilled = true;
      }
    } catch (error) {
      failed(error);
      await route.abort('failed').catch(() => {});
    } finally {
      complete();
    }
  };
  await page.route(pattern, handler);
  const arrival = page.waitForRequest(
    (request) =>
      request.url().startsWith(`${ORIGIN}/api/atproto/social`) &&
      request.method() === 'GET',
    { timeout: 15000 }
  );
  void arrival.catch(() => {});
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await arrival;
    await Promise.race([
      fetched,
      new Promise<never>((_, reject) => {
        readinessTimeout = setTimeout(
          () =>
            reject(
              new Error(
                'The actual loading response did not arrive before its deadline.'
              )
            ),
          60000
        );
      }),
    ]);
    if (readinessTimeout) clearTimeout(readinessTimeout);
    assert.equal(await page.locator('[data-standard-social]').count(), 0);
    await captureSocialState(page, output, name);
    release();
    await completion;
    assert(
      fulfilled,
      'The captured real loading response must reach the browser.'
    );
  } finally {
    if (readinessTimeout) clearTimeout(readinessTimeout);
    cancelled = true;
    release();
    if (handlerStarted) await completion;
    await page.unroute(pattern, handler);
  }
}

export async function socialUiFailures(options: {
  context: BrowserContext;
  output: string;
  identityJournal: string;
  publisher: string;
  slug: string;
  fixturePublicationJournal?: string;
  beforeMutation: (kind: 'subscription' | 'recommendation') => Promise<void>;
  dispatchedMutation: (
    kind: 'subscription' | 'recommendation'
  ) => Promise<void>;
  afterMutation: (kind: 'subscription' | 'recommendation') => Promise<void>;
}) {
  const { context, output, publisher, slug } = options;
  const path = resolve(output, 'social-failure-recovery.json');
  const recovery: Recovery = {
    version: 1,
    origin: ORIGIN,
    publisher,
    identityJournal: resolve(options.identityJournal),
  };
  const checks: { name: string; details?: unknown }[] = [];
  const saveChecks = () =>
    privateSave(resolve(output, 'social-ui-receipt.json'), {
      origin: ORIGIN,
      publisher,
      checks,
      cleanup: 'pending',
    });
  await privateSave(path, recovery);
  await saveChecks();
  const { createRepoClient } = await import('../lib/atproto/client');
  assert(process.env.ATPROTO_APP_PASSWORD);
  const client = await createRepoClient(process.env.ATPROTO_APP_PASSWORD);
  assert(client.getRecord && client.putRecord);
  const page = await context.newPage();
  let gate: (() => void) | undefined;
  // The primary callback performed one write. Reserve its slot and honor the deployed ten-write minute limit.
  const writeTimes = [Date.now()];
  async function writeSlot() {
    while (writeTimes.length && writeTimes[0] <= Date.now() - 61000)
      writeTimes.shift();
    if (writeTimes.length >= 9) {
      const wait = Math.max(1, writeTimes[0] + 61000 - Date.now());
      await new Promise<void>((done) =>
        setTimeout(done, Math.min(55000, wait))
      );
      return writeSlot();
    }
    writeTimes.push(Date.now());
  }
  async function confirmedGraph(kind: 'subscription' | 'recommendation') {
    const collection =
      kind === 'subscription'
        ? 'site.standard.graph.subscription'
        : 'site.standard.graph.recommend';
    const field = kind === 'subscription' ? 'publication' : 'document';
    const { publishingIdentity } = await import('../lib/atproto/config');
    const { documentRkey } = await import('../lib/atproto/keys');
    const { loadWriting } = await import('../lib/writings');
    const { writing } = await loadWriting(slug);
    assert(!writing.draft);
    const target =
      kind === 'subscription'
        ? publishingIdentity().publicationUri
        : `at://${publisher}/site.standard.document/${documentRkey(`/writings/${slug}`, writing.published)}`;
    const records = await client.listRecords(
      collection as Parameters<typeof client.listRecords>[0]
    );
    return records
      .filter((record) => record.value[field] === target)
      .map((record) => ({
        uri: `at://${publisher}/${collection}/${record.rkey}`,
        cid: record.cid,
        value: record.value,
      }));
  }
  async function load(kind: 'subscription' | 'recommendation') {
    await page.goto(
      ORIGIN + (kind === 'subscription' ? '/writings' : `/writings/${slug}`)
    );
    const control = page.locator(`[data-standard-social="${kind}"]`);
    await control.waitFor({ state: 'visible' });
    return control;
  }
  async function perform(
    kind: 'subscription' | 'recommendation',
    method: 'PUT' | 'DELETE',
    name: string,
    lost = false
  ) {
    const control = page.locator(`[data-standard-social="${kind}"]`);
    const url = `${ORIGIN}/api/atproto/${kind}`;
    const before = await confirmedGraph(kind);
    assert(method === 'PUT' ? before.length === 0 : before.length === 1);
    await options.beforeMutation(kind);
    let arrived!: () => void;
    const arrival = new Promise<void>((done) => {
      arrived = done;
    });
    const released = new Promise<void>((done) => {
      gate = done;
    });
    let routeStarted = false;
    let dispatched = false;
    let cancelled = false;
    let completed!: () => void;
    let failed!: (error: unknown) => void;
    const completion = new Promise<void>((done, reject) => {
      completed = done;
      failed = reject;
    });
    void completion.catch(() => {});
    const handler = async (route: Route) => {
      if (route.request().method() !== method) return route.continue();
      routeStarted = true;
      arrived();
      await released;
      try {
        if (cancelled) {
          await route.abort('failed');
          completed();
          return;
        }
        await writeSlot();
        await options.dispatchedMutation(kind);
        const response = await route.fetch({ timeout: 90000 });
        assert.equal(
          response.status(),
          200,
          'A real action must succeed before withholding its response.'
        );
        assert.equal((await response.json()).active, method === 'PUT');
        await options.afterMutation(kind);
        if (lost) await route.abort('failed');
        else await route.fulfill({ response });
        completed();
      } catch (error) {
        await route.abort('failed').catch(() => {});
        failed(error);
      }
    };
    await page.route(url, handler);
    try {
      await control.locator('button').first().click();
      await Promise.race([
        arrival,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('The actual UI did not issue its action.')),
            15000
          )
        ),
      ]);
      await control
        .getByRole('button', {
          name:
            method === 'PUT'
              ? kind === 'subscription'
                ? 'Subscribing…'
                : 'Recommending…'
              : kind === 'subscription'
                ? 'Unsubscribing…'
                : 'Withdrawing…',
          exact: true,
        })
        .waitFor();
      await captureSocialState(page, output, `${name}-pending`);
      dispatched = true;
      gate!();
      await completion;
      if (lost) {
        await control.getByRole('button', { name: /^Try again to / }).waitFor();
        assert.equal(
          await control.locator('button').first().getAttribute('aria-pressed'),
          method === 'DELETE' ? 'true' : 'false'
        );
        await captureSocialState(page, output, `${name}-lost-response`);
        const persisted = await confirmedGraph(kind);
        assert.equal(persisted.length, 1);
        await page.unroute(url, handler);
        await writeSlot();
        await control.getByRole('button', { name: /^Try again to / }).click();
        await control
          .getByRole('button', {
            name: kind === 'subscription' ? 'Subscribed' : 'Recommended',
            exact: true,
          })
          .waitFor();
        assert.deepEqual(
          await confirmedGraph(kind),
          persisted,
          'Retry must retain the same real record CID and value.'
        );
        checks.push({
          name: `A lost real ${kind} success response retains inactive UI until retry confirms the same PDS record`,
          details: {
            uri: persisted[0].uri,
            cid: persisted[0].cid,
            fault:
              'Only the browser delivery was aborted after a genuine deployed 200 and durable PDS inventory.',
          },
        });
      } else
        await control
          .getByRole('button', {
            name:
              method === 'PUT'
                ? kind === 'subscription'
                  ? 'Subscribed'
                  : 'Recommended'
                : kind === 'subscription'
                  ? 'Subscribe'
                  : 'Recommend',
            exact: true,
          })
          .waitFor();
      await captureSocialState(page, output, `${name}-confirmed`);
      await saveChecks();
    } finally {
      if (!dispatched) cancelled = true;
      gate?.();
      if (routeStarted) await completion.catch(() => {});
      gate = undefined;
      await page.unroute(url, handler);
    }
  }
  try {
    for (const kind of ['subscription', 'recommendation'] as const) {
      await load(kind);
      const existing = await confirmedGraph(kind);
      if (existing.length) {
        // The parent owns callback-created records and authorizes this narrow undo.
        await options.beforeMutation(kind);
        await writeSlot();
        await options.dispatchedMutation(kind);
        const response = await context.request.delete(
          `${ORIGIN}/api/atproto/${kind}`,
          {
            headers: { origin: ORIGIN },
            data: kind === 'recommendation' ? { slug } : {},
          }
        );
        assert.equal(response.status(), 200);
        await options.afterMutation(kind);
        await load(kind);
      }
      await captureSocialState(page, output, `${kind}-signed-in-inactive`);
      await perform(kind, 'PUT', kind, true);
      await perform(kind, 'DELETE', `${kind}-undo`);
    }
    const control = await load('recommendation');
    const owned = await ownedContainer(options.identityJournal, publisher);
    const secondVisitor = owned.journal.visitor.did as string;
    const { resolvePds } = await import('../lib/atproto/identity');
    const visitorServices = await Promise.all(
      [publisher, secondVisitor].map(async (did) => {
        const service = await resolvePds(did as Did);
        assert.equal(new URL(service).origin, owned.journal.origin);
        return { did, service };
      })
    );
    async function allVisitorGraphs() {
      const records: Snapshot[] = [];
      for (const { did, service } of visitorServices) {
        for (const collection of [
          'site.standard.graph.subscription',
          'site.standard.graph.recommend',
        ]) {
          let cursor: string | undefined;
          const seen = new Set<string>();
          do {
            if (cursor) {
              assert(!seen.has(cursor), 'The graph inventory cursor repeated.');
              seen.add(cursor);
            }
            const url = new URL('/xrpc/com.atproto.repo.listRecords', service);
            url.search = new URLSearchParams({
              repo: did,
              collection,
              limit: '100',
              ...(cursor && { cursor }),
            }).toString();
            const response = await fetch(url, {
              redirect: 'error',
              signal: AbortSignal.timeout(15000),
            });
            assert.equal(response.status, 200);
            const page = (await response.json()) as {
              records: Snapshot[];
              cursor?: string;
            };
            assert(Array.isArray(page.records));
            for (const record of page.records) {
              assert(record.uri.startsWith(`at://${did}/${collection}/`));
              assert(typeof record.cid === 'string' && record.cid);
              assert(record.value && typeof record.value === 'object');
              records.push({
                uri: record.uri,
                cid: record.cid,
                value: record.value,
              });
            }
            cursor = page.cursor;
          } while (cursor);
        }
      }
      return records.sort((a, b) => a.uri.localeCompare(b.uri));
    }
    const beforeMismatchGraphs = await allVisitorGraphs();
    const beforeGraph = {
      subscription: await confirmedGraph('subscription'),
      recommendation: await confirmedGraph('recommendation'),
    };
    const fixture = JSON.parse(
      await readFile(
        options.fixturePublicationJournal ??
          resolve(output, 'fixture-publication-journal.json'),
        'utf8'
      )
    );
    assert(
      fixture.did === publisher &&
        fixture.inventoryComplete &&
        fixture.syncedPublication
    );
    const original = await client.getRecord(
      'site.standard.publication',
      fixture.publicationRkey
    );
    assert(
      original &&
        original.cid === fixture.syncedPublication.cid &&
        isDeepStrictEqual(original.value, fixture.syncedPublication.value),
      'Only the exact parent-journaled publication may be changed.'
    );
    recovery.publication = {
      rkey: fixture.publicationRkey,
      original,
      changed: { ...original.value, url: `${ORIGIN}/acceptance-unverified` },
      intent: true,
    };
    await privateSave(path, recovery);
    try {
      await client.putRecord(
        'site.standard.publication',
        fixture.publicationRkey,
        recovery.publication.changed,
        original.cid
      );
      const modified = await client.getRecord(
        'site.standard.publication',
        fixture.publicationRkey
      );
      assert(
        modified &&
          isDeepStrictEqual(modified.value, recovery.publication.changed)
      );
      for (const kind of ['subscription', 'recommendation'] as const) {
        for (const method of ['PUT', 'DELETE'] as const) {
          await writeSlot();
          const response = await context.request.fetch(
            `${ORIGIN}/api/atproto/${kind}`,
            {
              method,
              headers: { origin: ORIGIN },
              data: kind === 'recommendation' ? { slug } : {},
            }
          );
          assert.equal(response.status(), 409);
        }
      }
      const result = await context.request.get(
        `${ORIGIN}/api/atproto/social?slug=${slug}`
      );
      assert.equal(result.status(), 200);
      const data = await result.json();
      assert(data.ready === false && data.signedIn === true);
      await writeSlot();
      const rejected = page.waitForResponse(
        (response) =>
          response.url() === `${ORIGIN}/api/atproto/recommendation` &&
          response.request().method() === 'PUT'
      );
      await control
        .getByRole('button', { name: 'Recommend', exact: true })
        .click();
      assert.equal((await rejected).status(), 409);
      const unavailable = control.getByRole('button', {
        name: 'Unavailable',
        exact: true,
      });
      await unavailable.waitFor();
      assert(await unavailable.isDisabled());
      assert.equal(await unavailable.getAttribute('aria-pressed'), 'false');
      await captureSocialState(
        page,
        output,
        'recommendation-unverified-action'
      );
      const unavailableStatus = page.waitForResponse((response) =>
        response.url().includes('/api/atproto/social')
      );
      await page.reload();
      await unavailableStatus;
      assert.equal(await page.locator('[data-standard-social]').count(), 0);
      await captureSocialState(page, output, 'unverified-controls-hidden');
      assert.deepEqual(
        {
          subscription: await confirmedGraph('subscription'),
          recommendation: await confirmedGraph('recommendation'),
        },
        beforeGraph
      );
      assert.deepEqual(
        await allVisitorGraphs(),
        beforeMismatchGraphs,
        'Target mismatch must preserve both visitors’ complete graph collections.'
      );
      checks.push({
        name: 'A real schema-valid publication with a mismatched URL rejects writes and undo, hides controls on load and preserves both visitors’ graph collections',
        details: { originalCid: original.cid, modifiedCid: modified.cid },
      });
    } finally {
      await restorePublication(recovery, client);
      await privateSave(path, recovery);
    }
    const ready = await load('recommendation');
    assert(
      !owned.container.State.Paused,
      'Never take ownership of an already paused PDS.'
    );
    const beforeOutageGraphs = await allVisitorGraphs();
    recovery.outage = {
      container: owned.journal.container,
      id: owned.container.Id,
      fingerprint: owned.fingerprint,
      intent: true,
    };
    await privateSave(path, recovery);
    await writeSlot();
    try {
      const beforePause = await ownedContainer(
        options.identityJournal,
        publisher
      );
      assert(
        beforePause.container.Id === owned.container.Id &&
          beforePause.fingerprint === owned.fingerprint &&
          !beforePause.container.State.Paused
      );
      docker(['pause', owned.container.Id]);
      assert(
        (await ownedContainer(options.identityJournal, publisher)).container
          .State.Paused
      );
      const health = await fetch(
        new URL('/xrpc/_health', owned.journal.origin),
        { signal: AbortSignal.timeout(12000) }
      )
        .then((response) => response.status)
        .catch(() => 0);
      assert(
        health === 0 || health >= 500,
        'The genuine owned PDS outage was not observed.'
      );
      const action = page.waitForResponse(
        (response) =>
          response.url() === `${ORIGIN}/api/atproto/recommendation` &&
          response.request().method() === 'PUT',
        { timeout: 90000 }
      );
      await ready
        .getByRole('button', { name: 'Recommend', exact: true })
        .click();
      const response = await action;
      assert(
        [409, 502].includes(response.status()),
        'An outage must never confirm a successful social action.'
      );
      const failure = ready.locator('button').first();
      await page.waitForFunction(() => {
        const button = document.querySelector(
          '[data-standard-social="recommendation"] button'
        );
        return (
          button?.textContent?.includes('Unavailable') ||
          button?.textContent?.includes('Try again')
        );
      });
      assert.equal(await failure.getAttribute('aria-pressed'), 'false');
      await captureSocialState(page, output, 'recommendation-owned-pds-outage');
      checks.push({
        name: 'A genuinely paused owned PDS rejects the action without successful UI state',
        details: {
          container: owned.journal.container,
          healthStatus: health,
          actionStatus: response.status(),
          coverage:
            response.status() === 409
              ? 'Shared publisher/visitor PDS was unavailable during target validation; authenticated visitor graph-write failure is not established.'
              : 'The deployed action returned a provider error; the shared outage does not independently locate the failure at visitor graph writes.',
        },
      });
    } finally {
      await recoverSocialFailures(output, options.identityJournal, publisher);
    }
    assert.deepEqual(
      {
        subscription: await confirmedGraph('subscription'),
        recommendation: await confirmedGraph('recommendation'),
      },
      beforeGraph
    );
    assert.deepEqual(
      await allVisitorGraphs(),
      beforeOutageGraphs,
      'Provider outage must preserve both visitors’ complete graph collections.'
    );
    await load('recommendation');
    await captureSocialState(
      page,
      output,
      'recommendation-after-provider-recovery'
    );
    // Abort the actual browser request to exercise local transport failure separately from the genuine PDS outage.
    const recommendation = page.locator(
      '[data-standard-social="recommendation"]'
    );
    const abort = (route: Route) => route.abort('failed');
    await page.route(`${ORIGIN}/api/atproto/recommendation`, abort);
    try {
      await recommendation
        .getByRole('button', { name: 'Recommend', exact: true })
        .click();
      await recommendation
        .getByRole('button', {
          name: 'Try again to recommend this writing',
          exact: true,
        })
        .waitFor();
      assert.equal(
        await recommendation
          .locator('button')
          .first()
          .getAttribute('aria-pressed'),
        'false'
      );
      await captureSocialState(
        page,
        output,
        'recommendation-local-transport-failure'
      );
      assert.deepEqual(
        await confirmedGraph('recommendation'),
        beforeGraph.recommendation
      );
    } finally {
      await page.unroute(`${ORIGIN}/api/atproto/recommendation`, abort);
    }
    await perform('recommendation', 'PUT', 'recommendation-local-retry');
    await perform(
      'recommendation',
      'DELETE',
      'recommendation-local-retry-undo'
    );
    checks.push({
      name: 'An explicitly aborted browser request shows local retry feedback; a subsequent real request confirms and can undo',
      details: {
        coverage:
          'Local transport failure only; no provider failure is claimed by this case.',
      },
    });
    await privateSave(resolve(output, 'social-ui-receipt.json'), {
      origin: ORIGIN,
      publisher,
      checks,
      cleanup: 'passed',
    });
  } finally {
    gate?.();
    try {
      await page.close();
    } finally {
      try {
        await recoverSocialFailures(output, options.identityJournal, publisher);
      } finally {
        await client.close();
      }
    }
  }
}

export async function captureSocialLogout(
  context: BrowserContext,
  output: string
) {
  const page = await context.newPage();
  const url = `${ORIGIN}/api/atproto/logout`;
  let release: (() => void) | undefined;
  try {
    await page.goto(`${ORIGIN}/writings`);
    const control = page.locator('[data-standard-social="subscription"]');
    async function clickMenuAction(name: string) {
      const action = control.getByRole('button', { name, exact: true });
      if (!(await action.isVisible())) {
        await control
          .getByRole('button', { name: 'Subscription options', exact: true })
          .click({ timeout: 10000 });
      }
      await action.click({ timeout: 10000 });
    }
    await control
      .getByRole('button', { name: 'Subscription options', exact: true })
      .click();
    await control
      .getByRole('button', { name: 'Sign out', exact: true })
      .waitFor();
    await captureSocialState(page, output, 'sign-out-options');
    const abort = (route: Route) => route.abort('failed');
    await page.route(url, abort);
    try {
      await clickMenuAction('Sign out');
      await control
        .getByRole('button', { name: 'Try again to sign out', exact: true })
        .waitFor();
      const retained = await context.request.get(
        `${ORIGIN}/api/atproto/social`
      );
      assert.equal(retained.status(), 200);
      assert.equal((await retained.json()).signedIn, true);
      await captureSocialState(page, output, 'sign-out-local-failure');
    } finally {
      await page.unroute(url, abort);
    }
    const held = new Promise<void>((done) => {
      release = done;
    });
    const arrival = page.waitForRequest(
      (request) => request.url() === url && request.method() === 'POST',
      { timeout: 15000 }
    );
    void arrival.catch(() => {});
    let completed!: () => void;
    let failed!: (error: unknown) => void;
    const completion = new Promise<void>((done, reject) => {
      completed = done;
      failed = reject;
    });
    void completion.catch(() => {});
    let handlerStarted = false;
    let dispatched = false;
    let cancelled = false;
    const handler = async (route: Route) => {
      handlerStarted = true;
      await held;
      try {
        if (cancelled) {
          await route.abort('failed');
          completed();
          return;
        }
        const response = await route.fetch({ timeout: 60000 });
        assert.equal(response.status(), 200);
        assert.equal((await response.json()).signedIn, false);
        if (cancelled) await route.abort('failed');
        else await route.fulfill({ response });
        completed();
      } catch (error) {
        await route.abort('failed').catch(() => {});
        failed(error);
      }
    };
    await page.route(url, handler);
    try {
      await clickMenuAction('Try again to sign out');
      await arrival;
      await control
        .getByRole('button', { name: 'Signing out…', exact: true })
        .waitFor();
      await captureSocialState(page, output, 'sign-out-pending');
      dispatched = true;
      release!();
      await completion;
      await control
        .getByRole('button', { name: 'Subscription options', exact: true })
        .waitFor({ state: 'hidden' });
      assert(
        !(await context.cookies(ORIGIN)).some(
          (cookie) => cookie.name === 'atproto_session'
        )
      );
      await captureSocialState(page, output, 'sign-out-confirmed');
      await privateSave(resolve(output, 'social-logout-ui-receipt.json'), {
        observedAt: new Date().toISOString(),
        status: 'passed',
        transportFailure:
          'Only the first browser request was aborted; its real session stayed active.',
        retry:
          'The retry used the actual deployed response and cleared the actual browser cookie.',
      });
    } finally {
      if (!dispatched) cancelled = true;
      release?.();
      try {
        await page.unroute(url, handler);
      } finally {
        if (handlerStarted) await completion.catch(() => {});
      }
    }
  } finally {
    release?.();
    await page.close();
  }
}
