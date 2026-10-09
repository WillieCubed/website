import type {} from '@atcute/atproto';
import type {} from '@atcute/bluesky';
import { Client, ok } from '@atcute/client';
import type { Did, Nsid } from '@atcute/lexicons';
import { PasswordSession } from '@atcute/password-session';
import { now } from '@atcute/tid';
import { type Page, chromium } from '@playwright/test';
import matter from 'gray-matter';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs, parseEnv } from 'node:util';

import type { WritingData } from '../lib/writings/types';

const ORIGIN = 'https://indieweb-acceptance.vercel.app';
const OWNER = 'did:plc:iyn6nc3ffqm2e3555exyrgvv';
const RETAINED = {
  revision: '9014e42aeb9c566d7952485fc40bf6137913fe5f',
  did: 'did:plc:l3ycfv2ycqya33wyyw6zv6j6',
  slug: 'atproto-acceptance-20261008',
  nonce: 'c494f7f1-49f6-4e9b-ac52-7eed1fe3ecf9',
  publishedAt: '2026-10-09T04:19:16.968Z',
  documentRkey: '3mxg4ngubm2kt',
  sourceSha256:
    '612bf6a27d93954fbbeea9c7ebb2b18dd83908e2278190ea8a4e79aa0732cd42',
} as const;
const REUSED_REVISION = '7f71010c5cf37cb379681e8a0e982f159d6e2a0d';
const HLS_REUSED_REVISION = '4d0ff1f9a76010ff429c84b9917fa6da4416297c';
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
interface Snapshot {
  uri: string;
  cid: string;
  value: Record<string, unknown>;
}
interface Owned {
  previous?: { cid: string; value: Record<string, unknown> }[];
  collection: string;
  rkey: string;
  value: Record<string, unknown> | null;
  cid?: string;
  deleted?: boolean;
}
interface Receipt {
  version: 1;
  origin: string;
  did: string;
  slug: string;
  deploymentRecovery?: {
    mode: 'verified-owned-artifact';
    revision: string;
    baseGitRevision: string;
    dirtyFixtureOverlay: true;
    runtimeCodeUnchanged: true;
    sourceJournal: string;
    publicationJournal: string;
    sourceSha256: string;
    observedAt: string;
  };
  retainedRuntime?: {
    revision: string;
    baseGitRevision?: string;
    dirtyFixtureOverlay?: true;
    runtimeCodeUnchanged?: true;
    sourceJournal: string;
    publicationJournal: string;
    sourceSha256: string;
    nonce: string;
    publishedAt: string;
    documentUri: string;
    limits: string[];
  };
  source: {
    path: string;
    original: string;
    temporary?: string;
    versions?: string[];
    restored?: boolean;
    deployed?: boolean;
  };
  document: {
    rkey: string;
    original: Snapshot;
    expected?: Record<string, unknown>;
    restored?: boolean;
  };
  foreignDocuments: { rkey: string; cid: string }[];
  owned: Owned[];
  checks: { name: string; observedAt: string; details?: unknown }[];
  screenshots: string[];
  cleanup: 'pending' | 'passed';
  error?: string;
}
interface PostView {
  uri: string;
  record: { text?: string };
  embed?: { $type: string; playlist?: string; images?: { fullsize: string }[] };
}
interface Thread {
  post?: PostView;
  replies?: Thread[];
}
let phase = 'input validation';
let privateReceipt = 'the selected private receipt';
async function saveFailure(error: unknown) {
  if (privateReceipt === 'the selected private receipt') return;
  const path = `${privateReceipt}.failure-${Date.now()}-${randomUUID()}.json`;
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(
    path,
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
    { mode: 0o600 }
  );
  await chmod(path, 0o600);
  await writeFile(`${privateReceipt}.failure.json`, await readFile(path), {
    mode: 0o600,
    flag: 'wx',
  }).catch((failure: unknown) => {
    if ((failure as NodeJS.ErrnoException).code !== 'EEXIST') throw failure;
  });
}
async function main() {
  const { values } = parseArgs({
    options: {
      env: {
        type: 'string',
        default: resolve(root, '.env.standard-test.local'),
      },
      slug: { type: 'string' },
      receipt: {
        type: 'string',
        default: resolve(
          root,
          `.playwright-mcp/hosted-atmosphere-${Date.now()}.json`
        ),
      },
      cleanup: { type: 'boolean', default: false },
      'retained-runtime': { type: 'boolean', default: false },
      'reuse-runtime': { type: 'boolean', default: false },
      'reuse-runtime-revision': { type: 'string' },
      'fixture-source-journal': { type: 'string' },
      'retained-source-journal': { type: 'string' },
      'publication-journal': { type: 'string' },
    },
  });
  privateReceipt = values.receipt!;
  const reusedRevision = values['reuse-runtime-revision'] ?? REUSED_REVISION;
  assert(!values['reuse-runtime-revision'] || values['reuse-runtime']);
  assert(
    reusedRevision === REUSED_REVISION ||
      reusedRevision === HLS_REUSED_REVISION,
    'Reuse requires an explicitly verified acceptance revision.'
  );
  Object.assign(process.env, parseEnv(await readFile(values.env!, 'utf8')));
  assert(process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/$/, '') === ORIGIN);
  const did = process.env.NEXT_PUBLIC_ATPROTO_DID;
  assert(
    did && did !== OWNER && process.env.ATPROTO_APP_PASSWORD,
    'An isolated publishing account is required.'
  );
  assert(
    /^ep-winter-wind-b5iiaxe7(?:-pooler)?\.c-7\.us-east-2\.aws\.neon\.tech$/.test(
      new URL(process.env.POSTGRES_URL!).hostname
    )
  );
  assert(
    /^codex\/publishing-compatibility-acceptance(?:-\d{8})?$/.test(
      execFileSync('git', ['branch', '--show-current'], {
        encoding: 'utf8',
      }).trim()
    )
  );
  assert(values.slug && /^[a-z0-9-]+-acceptance-[a-z0-9-]+$/.test(values.slug));
  const slug = values.slug;
  const [
    config,
    { resolvePds },
    { createRepoClient },
    { documentRkey },
    copies,
    { loadWriting },
    { fetchBlueskyResponses: fetchResponses },
  ] = await Promise.all([
    import('../lib/atproto/config'),
    import('../lib/atproto/identity'),
    import('../lib/atproto/client'),
    import('../lib/atproto/keys'),
    import('../lib/atproto/bluesky'),
    import('../lib/writings'),
    import('../lib/atproto/responses'),
  ]);
  async function fetchBlueskyResponses(writing: WritingData) {
    const result = await fetchResponses(writing);
    assert(
      !result.incomplete,
      'Incomplete response reads cannot establish import or deletion.'
    );
    return result;
  }
  const identity = config.publishingIdentity();
  assert(identity.did === did);
  const sourcePath = resolve('content/writings', `${slug}.mdx`);
  let retainedRuntime: Receipt['retainedRuntime'];
  let retainedDocument: Snapshot | undefined;
  let reusedPublication: Snapshot | undefined;
  let runtimeExpectation: {
    revision: string;
    did: string;
    slug: string;
    nonce: string;
    publishedAt: string;
    documentRkey: string;
    sourceSha256: string;
  } = RETAINED;
  assert(!(values['retained-runtime'] && values['reuse-runtime']));
  assert(!values['fixture-source-journal'] || values['reuse-runtime']);
  async function verifyRetainedHttp() {
    const revision = await fetch(`${ORIGIN}/api/indieweb/revision`, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    assert(
      revision.ok &&
        (await revision.json()).sha === runtimeExpectation.revision,
      'Retained evidence requires the exact authorized hosted revision.'
    );
    const page = await fetch(`${ORIGIN}/writings/${slug}`, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    assert(page.ok, 'The retained fixture must remain publicly readable.');
    const html = await page.text();
    assert(
      html.includes(runtimeExpectation.nonce) &&
        html.includes(
          `at://${did}/site.standard.document/${runtimeExpectation.documentRkey}`
        ) &&
        html.includes(identity.publicationUri),
      'The retained fixture nonce and verification links must match the owned target.'
    );
    if (values['reuse-runtime']) {
      const [{ parse }, { documentIsVerified }] = await Promise.all([
        import('parse5'),
        import('../lib/atproto/verification'),
      ]);
      type HtmlNode = {
        tagName?: string;
        attrs?: { name: string; value: string }[];
        childNodes?: HtmlNode[];
      };
      const all = (node: HtmlNode): HtmlNode[] => [
        node,
        ...(node.childNodes ?? []).flatMap(all),
      ];
      const nodes = all(parse(html) as HtmlNode);
      const head = nodes.find((node) => node.tagName === 'head');
      const attrs = (node: HtmlNode) =>
        Object.fromEntries(
          (node.attrs ?? []).map(({ name, value }) => [name, value])
        );
      assert(
        retainedDocument &&
          documentIsVerified(
            retainedDocument.value,
            identity.publicationUri,
            `/writings/${slug}`,
            retainedDocument.uri,
            html
          ),
        'The reused artifact must expose the valid exact owned document head link.'
      );
      assert(
        head &&
          all(head).some(
            (node) =>
              node.tagName === 'link' &&
              attrs(node)
                .rel?.split(/\s+/)
                .includes('site.standard.publication') &&
              attrs(node).href === identity.publicationUri
          )
      );
      assert(
        nodes.some(
          (node) =>
            node.tagName === 'time' &&
            attrs(node).class?.split(/\s+/).includes('dt-published') &&
            attrs(node).datetime === runtimeExpectation.publishedAt
        )
      );
    }
  }
  if (values['reuse-runtime']) {
    assert(!values['retained-source-journal']);
    assert(
      execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim() === reusedRevision,
      'Reuse requires the exact acceptance base Git revision.'
    );
    for (const cwd of new Set([root, process.cwd()])) {
      execFileSync(
        'git',
        [
          'diff',
          '--exit-code',
          reusedRevision,
          '--',
          'app',
          'components',
          'lib',
        ],
        { cwd, stdio: 'pipe' }
      );
      assert(
        execFileSync(
          'git',
          [
            'ls-files',
            '--others',
            '--exclude-standard',
            '-z',
            '--',
            'app',
            'components',
            'lib',
          ],
          { cwd, encoding: 'utf8', stdio: 'pipe' }
        ).length === 0,
        'The verifier and acceptance runtime code must match the pinned artifact without untracked runtime files.'
      );
    }
    assert(values['fixture-source-journal'] && values['publication-journal']);
    const sourceJournalPath = resolve(values['fixture-source-journal']);
    const publicationJournalPath = resolve(values['publication-journal']);
    assert(
      dirname(sourceJournalPath) === dirname(resolve(values.receipt!)) &&
        dirname(publicationJournalPath) === dirname(sourceJournalPath) &&
        sourceJournalPath.endsWith('/fixture-source-journal.json') &&
        publicationJournalPath.endsWith('/fixture-publication-journal.json'),
      'Reuse requires the exact parent fixture ownership journals beside the new receipt.'
    );
    const sourceJournal = JSON.parse(await readFile(sourceJournalPath, 'utf8'));
    const publicationJournal = JSON.parse(
      await readFile(publicationJournalPath, 'utf8')
    );
    assert(
      sourceJournal.version === 1 &&
        sourceJournal.workspace === process.cwd() &&
        sourceJournal.slug === slug &&
        sourceJournal.cleanup === 'pending' &&
        sourceJournal.removed === false &&
        typeof sourceJournal.original === 'string' &&
        /^[a-f0-9]{64}$/.test(sourceJournal.sha256) &&
        hash(sourceJournal.original) === sourceJournal.sha256,
      'Reuse requires a pending unchanged source owned by this parent run.'
    );
    const source = matter(sourceJournal.original);
    const nonces = [
      ...source.content.matchAll(
        /Fixture identifier: ([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\./g
      ),
    ];
    assert(nonces.length === 1);
    assert(
      source.data.draft === false &&
        !source.data.syndicateTo?.length &&
        !source.data.syndication?.length &&
        !source.data.atproto?.bskyPostRef
    );
    const publishedAt = new Date(source.data.published).toISOString();
    const rkey = documentRkey(`/writings/${slug}`, new Date(publishedAt));
    assert(
      publicationJournal.version === 1 &&
        publicationJournal.did === did &&
        publicationJournal.publicationUri === identity.publicationUri &&
        publicationJournal.publicationRkey === identity.publicationRkey &&
        publicationJournal.slug === slug &&
        publicationJournal.publishedAt === publishedAt &&
        publicationJournal.documentRkey === rkey &&
        publicationJournal.expectedPath === `/writings/${slug}` &&
        publicationJournal.inventoryComplete === true &&
        publicationJournal.cleanup === 'pending' &&
        !publicationJournal.documentRemoved &&
        !publicationJournal.publicationRestored &&
        publicationJournal.syncedDocument?.cid &&
        publicationJournal.syncedPublication?.cid,
      'Reuse requires the pending complete parent publication inventory.'
    );
    runtimeExpectation = {
      revision: reusedRevision,
      did,
      slug,
      nonce: nonces[0][1],
      publishedAt,
      documentRkey: rkey,
      sourceSha256: sourceJournal.sha256,
    };
    retainedDocument = {
      uri: `at://${did}/site.standard.document/${rkey}`,
      ...publicationJournal.syncedDocument,
    };
    reusedPublication = {
      uri: identity.publicationUri,
      ...publicationJournal.syncedPublication,
    };
    assert(
      retainedDocument!.value.publishedAt === publishedAt &&
        retainedDocument!.value.path === `/writings/${slug}` &&
        retainedDocument!.value.site === identity.publicationUri &&
        !retainedDocument!.value.bskyPostRef &&
        reusedPublication!.value.url === ORIGIN
    );
    if (!values.cleanup)
      assert((await readFile(sourcePath, 'utf8')) === sourceJournal.original);
    retainedRuntime = {
      revision: reusedRevision,
      baseGitRevision: reusedRevision,
      dirtyFixtureOverlay: true,
      runtimeCodeUnchanged: true,
      sourceJournal: sourceJournalPath,
      publicationJournal: publicationJournalPath,
      sourceSha256: runtimeExpectation.sourceSha256,
      nonce: runtimeExpectation.nonce,
      publishedAt,
      documentUri: retainedDocument!.uri,
      limits: [
        `Hosted rendering uses the verified existing acceptance artifact at ${reusedRevision}.`,
        'The existing artifact contains the parent-owned fixture overlay; its base Git tree has no fixture.',
        'The local loader supplies explicit opt-in; the immutable hosted source remains unchanged.',
        'This proves the pinned hosted artifact, not a later local revision or production.',
      ],
    };
    await verifyRetainedHttp();
  } else if (values['retained-runtime']) {
    assert(did === runtimeExpectation.did && slug === runtimeExpectation.slug);
    assert(values['retained-source-journal'] && values['publication-journal']);
    const sourceJournalPath = resolve(values['retained-source-journal']);
    const publicationJournalPath = resolve(values['publication-journal']);
    assert(
      dirname(sourceJournalPath) === dirname(resolve(values.receipt!)) &&
        dirname(publicationJournalPath) === dirname(sourceJournalPath),
      'Retained verification requires the current run journals beside its new receipt.'
    );
    assert(
      sourceJournalPath.endsWith('/retained-source-ownership.json') &&
        publicationJournalPath.endsWith('/fixture-publication-journal.json')
    );
    const sourceJournal = JSON.parse(await readFile(sourceJournalPath, 'utf8'));
    const publicationJournal = JSON.parse(
      await readFile(publicationJournalPath, 'utf8')
    );
    assert(
      sourceJournal.version === 1 &&
        sourceJournal.workspace === process.cwd() &&
        sourceJournal.source === sourcePath &&
        sourceJournal.slug === slug &&
        sourceJournal.deployedRevision === runtimeExpectation.revision &&
        sourceJournal.cleanup === 'pending' &&
        sourceJournal.sha256 === runtimeExpectation.sourceSha256 &&
        typeof sourceJournal.original === 'string' &&
        hash(sourceJournal.original) === runtimeExpectation.sourceSha256 &&
        sourceJournal.original.includes(runtimeExpectation.nonce),
      'Only the new exact retained source ownership journal authorizes this run.'
    );
    assert(
      publicationJournal.version === 1 &&
        publicationJournal.did === did &&
        publicationJournal.publicationUri === identity.publicationUri &&
        publicationJournal.publicationRkey === identity.publicationRkey &&
        publicationJournal.slug === slug &&
        publicationJournal.publishedAt === runtimeExpectation.publishedAt &&
        publicationJournal.documentRkey === runtimeExpectation.documentRkey &&
        publicationJournal.expectedPath === `/writings/${slug}` &&
        publicationJournal.inventoryComplete === true &&
        publicationJournal.cleanup === 'pending' &&
        publicationJournal.syncedDocument?.cid &&
        publicationJournal.syncedPublication?.cid,
      'Retained verification requires the current complete publication ownership inventory.'
    );
    retainedDocument = {
      uri: `at://${did}/site.standard.document/${runtimeExpectation.documentRkey}`,
      ...publicationJournal.syncedDocument,
    };
    assert(
      retainedDocument!.value.publishedAt === runtimeExpectation.publishedAt &&
        retainedDocument!.value.path === `/writings/${slug}` &&
        retainedDocument!.value.site === identity.publicationUri &&
        !retainedDocument!.value.bskyPostRef
    );
    if (!values.cleanup)
      assert(
        hash(await readFile(sourcePath, 'utf8')) ===
          runtimeExpectation.sourceSha256
      );
    retainedRuntime = {
      revision: runtimeExpectation.revision,
      sourceJournal: sourceJournalPath,
      publicationJournal: publicationJournalPath,
      sourceSha256: runtimeExpectation.sourceSha256,
      nonce: runtimeExpectation.nonce,
      publishedAt: runtimeExpectation.publishedAt,
      documentUri: retainedDocument!.uri,
      limits: [
        'Hosted rendering uses revision 9014e42a, not current HEAD or production.',
        'The local loader supplies explicit opt-in; the immutable hosted source remains unchanged.',
        'This run cannot verify newer AppView failure preservation or authored HTML media/feed changes.',
      ],
    };
    await verifyRetainedHttp();
  } else {
    assert(
      !values['retained-source-journal'] &&
        !values['fixture-source-journal'] &&
        !values['publication-journal']
    );
  }
  const session = await PasswordSession.login({
    service: await resolvePds(did as Did),
    identifier: did,
    password: process.env.ATPROTO_APP_PASSWORD!,
  });
  let client: Awaited<ReturnType<typeof createRepoClient>>;
  try {
    assert(session.did === did);
    client = await createRepoClient(process.env.ATPROTO_APP_PASSWORD!);
  } catch (error) {
    await session.logout().catch(() => {
      console.error(
        'The owned hosted publishing session could not close after setup failed. Provider details are withheld.'
      );
    });
    throw error;
  }
  const rpc = new Client({ handler: session });
  const get = client.getRecord!;
  let receipt: Receipt | undefined;
  let ownershipVerified = false;
  async function save() {
    await mkdir(dirname(values.receipt!), { recursive: true, mode: 0o700 });
    await writeFile(values.receipt!, JSON.stringify(receipt, null, 2) + '\n', {
      mode: 0o600,
    });
    await chmod(values.receipt!, 0o600);
  }
  async function check(name: string, details?: unknown) {
    receipt!.checks.push({
      name,
      observedAt: new Date().toISOString(),
      details,
    });
    await save();
    console.log(`Passed: ${name}.`);
  }
  async function deploy() {
    if (retainedRuntime) {
      await verifyRetainedHttp();
      return;
    }
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    assert(/^[a-f0-9]{40}$/.test(sha));
    await new Promise<void>((resolvePromise, reject) => {
      const child = spawn(
        'vercel',
        [
          'deploy',
          '--prod',
          '--yes',
          '--scope',
          'williecubed-projects',
          '--project',
          'prj_rurUFlQ4YKYKoMxGCaAyL6ASijHm',
          '--env',
          `VERCEL_GIT_COMMIT_SHA=${sha}`,
          '--build-env',
          `VERCEL_GIT_COMMIT_SHA=${sha}`,
        ],
        { cwd: process.cwd(), env: process.env, stdio: 'ignore' }
      );
      child.on('error', reject);
      child.on('exit', (code) =>
        code === 0
          ? resolvePromise()
          : reject(new Error('Acceptance deployment failed.'))
      );
    });
    const revision = await fetch(`${ORIGIN}/api/indieweb/revision`, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    assert(
      revision.ok && (await revision.json()).sha === sha,
      'The hosted response deployment must serve the actual acceptance revision.'
    );
  }
  async function appview<T>(
    method: string,
    params: Record<string, string | string[]>
  ): Promise<T>;
  async function appview<T>(
    method: 'app.bsky.feed.getPostThread',
    params: Record<string, string | string[]>,
    initialPendingNotFound: true
  ): Promise<T | null>;
  async function appview<T>(
    method: string,
    params: Record<string, string | string[]>,
    initialPendingNotFound = false
  ): Promise<T | null> {
    const url = new URL(`/xrpc/${method}`, config.blueskyAppview());
    for (const [key, value] of Object.entries(params))
      for (const item of Array.isArray(value) ? value : [value])
        url.searchParams.append(key, item);
    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (
      initialPendingNotFound &&
      method === 'app.bsky.feed.getPostThread' &&
      response.status === 400
    ) {
      const failure = await response.json().catch(() => ({}));
      if (failure.error === 'NotFound') return null;
    }
    assert(
      response.ok,
      `Successful ${method} is required; HTTP ${response.status} cannot prove absence.`
    );
    return response.json();
  }
  async function until(
    name: string,
    test: () => Promise<boolean>,
    seconds = 240
  ) {
    const deadline = Date.now() + seconds * 1000;
    do {
      if (await test()) return;
      await new Promise((r) => setTimeout(r, 3000));
    } while (Date.now() < deadline);
    throw new Error(`Timed out waiting for ${name}.`);
  }
  function nodes(thread: Thread): PostView[] {
    return [
      ...(thread.post ? [thread.post] : []),
      ...(thread.replies ?? []).flatMap(nodes),
    ];
  }
  async function create(
    collection: string,
    value: Record<string, unknown>,
    rkey = now()
  ) {
    assert(
      (await get(collection, rkey)) === null,
      'Refuse an occupied record key.'
    );
    const entry: Owned = { collection, rkey, value };
    receipt!.owned.push(entry);
    await save();
    const result = await client.createRecord!(collection, rkey, value);
    entry.cid = result.cid;
    await save();
    return { uri: result.uri, cid: result.cid };
  }
  async function ownedCurrent(entry: Owned) {
    const current = await get(entry.collection, entry.rkey);
    if (current) {
      assert(
        (entry.value &&
          isDeepStrictEqual(current.value, entry.value) &&
          (!entry.cid || current.cid === entry.cid)) ||
          entry.previous?.some(
            (prior) =>
              prior.cid === current.cid &&
              isDeepStrictEqual(prior.value, current.value)
          ),
        'Refuse cleanup of a changed or unowned record.'
      );
      entry.cid = current.cid;
      await save();
    }
    return current;
  }
  async function remove(entry: Owned) {
    const current = await ownedCurrent(entry);
    if (current)
      await ok(
        rpc.post('com.atproto.repo.deleteRecord', {
          input: {
            repo: did as Did,
            collection: entry.collection as Nsid,
            rkey: entry.rkey,
            swapRecord: current.cid,
          },
        })
      );
    assert((await get(entry.collection, entry.rkey)) === null);
    entry.deleted = true;
    await save();
  }
  async function cleanup() {
    assert(receipt);
    for (const entry of [...receipt.owned].reverse()) await remove(entry);
    const current = await get(
      config.DOCUMENT_COLLECTION,
      receipt.document.rkey
    );
    assert(current, 'Do not recreate a fixture deleted by someone else.');
    if (!isDeepStrictEqual(current.value, receipt.document.original.value)) {
      assert(
        receipt.document.expected &&
          isDeepStrictEqual(current.value, receipt.document.expected),
        'The fixture document changed outside this runner.'
      );
      await client.putRecord!(
        config.DOCUMENT_COLLECTION,
        receipt.document.rkey,
        receipt.document.original.value,
        current.cid
      );
    }
    assert(
      isDeepStrictEqual(
        (await get(config.DOCUMENT_COLLECTION, receipt.document.rkey))?.value,
        receipt.document.original.value
      )
    );
    assert(
      (await get(config.DOCUMENT_COLLECTION, receipt.document.rkey))?.cid ===
        receipt.document.original.cid
    );
    receipt.document.restored = true;
    await save();
    const original = receipt.source.original,
      temporary = receipt.source.temporary;
    const source = await readFile(receipt.source.path, 'utf8');
    assert(
      source === original ||
        source === temporary ||
        !!receipt.source.versions?.includes(source),
      'The fixture source changed outside this runner.'
    );
    if (source !== original) await writeFile(receipt.source.path, original);
    if (temporary && !receipt.source.deployed) {
      await deploy();
      receipt.source.deployed = true;
      await save();
    }
    receipt.source.restored = true;
    await save();
    const documents = await client.listRecords(config.DOCUMENT_COLLECTION);
    for (const foreign of receipt.foreignDocuments)
      assert(
        documents.some(
          (item) => item.rkey === foreign.rkey && item.cid === foreign.cid
        ),
        'A foreign document changed.'
      );
    const { createPool } = await import('@vercel/postgres');
    const db = createPool({ max: 1 });
    try {
      for (const entry of receipt.owned.filter(
        (entry) => entry.collection === 'app.bsky.feed.post'
      ))
        await db.sql`DELETE FROM atproto_response_observations WHERE copy_uri = ${`at://${did}/app.bsky.feed.post/${entry.rkey}`}`;
    } finally {
      await db.end();
    }
    receipt.cleanup = 'passed';
    await save();
  }
  try {
    if (reusedPublication) {
      const publication = await get(
        config.PUBLICATION_COLLECTION,
        identity.publicationRkey
      );
      assert(
        publication?.cid === reusedPublication.cid &&
          isDeepStrictEqual(publication.value, reusedPublication.value),
        'The reused artifact publication must match the exact parent inventory before writes.'
      );
    }
    if (values.cleanup) {
      receipt = JSON.parse(await readFile(values.receipt!, 'utf8')) as Receipt;
      assert(
        receipt.version === 1 &&
          receipt.did === did &&
          receipt.origin === ORIGIN &&
          receipt.slug === slug
      );
      assert(receipt.source.path === sourcePath);
      const normalArtifactRecovery =
        values['reuse-runtime'] && !receipt.retainedRuntime;
      assert(
        normalArtifactRecovery ||
          isDeepStrictEqual(receipt.retainedRuntime, retainedRuntime),
        'Recovery must use the same explicitly pinned runtime and current ownership journals.'
      );
      assert(
        receipt.document.rkey ===
          documentRkey(
            `/writings/${slug}`,
            new Date(receipt.document.original.value.publishedAt as string)
          )
      );
      assert(
        receipt.document.original.value.site === identity.publicationUri &&
          receipt.document.original.value.path === `/writings/${slug}`
      );
      assert(
        receipt.owned.every(
          (entry) =>
            [
              'app.bsky.feed.post',
              'app.bsky.feed.like',
              'app.bsky.feed.repost',
              'app.bsky.feed.threadgate',
            ].includes(entry.collection) && /^[234567a-z]{13}$/.test(entry.rkey)
        )
      );
      const originalSource = matter(receipt.source.original);
      assert(
        originalSource.data.draft === false &&
          !originalSource.data.syndicateTo?.length &&
          !originalSource.data.syndication?.length &&
          !originalSource.data.atproto?.bskyPostRef
      );
      assert(
        new Date(originalSource.data.published).toISOString() ===
          receipt.document.original.value.publishedAt
      );
      assert(
        receipt.document.original.value.$type === config.DOCUMENT_COLLECTION &&
          !receipt.document.original.value.bskyPostRef
      );
      assert(
        new Set(
          receipt.owned.map((entry) => entry.collection + '/' + entry.rkey)
        ).size === receipt.owned.length
      );
      assert(
        receipt.owned.every((entry) => entry.value?.$type === entry.collection)
      );
      assert(
        receipt.foreignDocuments.every(
          (entry) =>
            entry.rkey !== receipt!.document.rkey &&
            typeof entry.cid === 'string'
        )
      );
      if (retainedRuntime)
        assert(
          receipt.document.original.cid === retainedDocument!.cid &&
            isDeepStrictEqual(
              receipt.document.original.value,
              retainedDocument!.value
            ) &&
            hash(receipt.source.original) === runtimeExpectation.sourceSha256
        );
      if (normalArtifactRecovery) {
        assert(retainedRuntime && values['fixture-source-journal']);
        receipt.deploymentRecovery = {
          mode: 'verified-owned-artifact',
          revision: retainedRuntime.revision,
          baseGitRevision: reusedRevision,
          dirtyFixtureOverlay: true,
          runtimeCodeUnchanged: true,
          sourceJournal: retainedRuntime.sourceJournal,
          publicationJournal: retainedRuntime.publicationJournal,
          sourceSha256: retainedRuntime.sourceSha256,
          observedAt: new Date().toISOString(),
        };
        await save();
        const recoveryPath = `${values.receipt}.deployment-recovery-${randomUUID()}.json`;
        await writeFile(
          recoveryPath,
          JSON.stringify(receipt.deploymentRecovery, null, 2) + '\n',
          { mode: 0o600, flag: 'wx' }
        );
        await chmod(recoveryPath, 0o600);
      }
      ownershipVerified = true;
      await cleanup();
      return;
    }
    await assert.rejects(
      readFile(values.receipt!, 'utf8'),
      (e: unknown) => (e as NodeJS.ErrnoException).code === 'ENOENT'
    );
    const original = await readFile(sourcePath, 'utf8');
    const parsed = matter(original);
    assert(
      parsed.data.draft === false &&
        !parsed.data.syndicateTo?.length &&
        !parsed.data.syndication?.length &&
        !parsed.data.atproto?.bskyPostRef,
      'Use only the clean controlled published fixture.'
    );
    const loaded = await loadWriting(slug);
    assert(!loaded.writing.draft);
    const rkey = documentRkey(`/writings/${slug}`, loaded.writing.published);
    const originalDocument = await get(config.DOCUMENT_COLLECTION, rkey);
    assert(
      originalDocument &&
        originalDocument.value.site === identity.publicationUri &&
        originalDocument.value.path === `/writings/${slug}` &&
        !originalDocument.value.bskyPostRef
    );
    assert(
      (await get('app.bsky.feed.post', rkey)) === null,
      'The deterministic copy key is occupied.'
    );
    if (retainedRuntime)
      assert(
        originalDocument.cid === retainedDocument!.cid &&
          isDeepStrictEqual(originalDocument.value, retainedDocument!.value) &&
          hash(original) === runtimeExpectation.sourceSha256 &&
          rkey === runtimeExpectation.documentRkey,
        'The current PDS fixture must exactly match the new ownership inventory.'
      );
    receipt = {
      version: 1,
      ...(retainedRuntime && { retainedRuntime }),
      origin: ORIGIN,
      did,
      slug,
      source: { path: sourcePath, original },
      document: { rkey, original: originalDocument },
      foreignDocuments: (await client.listRecords(config.DOCUMENT_COLLECTION))
        .filter((item) => item.rkey !== rkey)
        .map(({ rkey, cid }) => ({ rkey, cid })),
      owned: [],
      checks: [],
      screenshots: [],
      cleanup: 'pending',
    };
    await save();
    ownershipVerified = true;
    phase = 'real copy publication';
    const data = {
      ...parsed.data,
      syndicateTo: [copies.blueskyProfileUrl(did)],
    };
    receipt.source.temporary = matter.stringify(parsed.content, data);
    await save();
    await writeFile(sourcePath, receipt.source.temporary);
    const requested = await loadWriting(slug);
    assert(
      requested.writing.syndicateTo?.includes(copies.blueskyProfileUrl(did)),
      'The actual writing loader must expose the explicit per-writing opt-in.'
    );
    const tracked = {
      ...client,
      createRecord: async (
        collection: string,
        key: string,
        value: Record<string, unknown>
      ) => create(collection, value, key),
      putRecord: async (
        collection: string,
        key: string,
        value: Record<string, unknown>,
        cid: string
      ) => {
        assert(collection === config.DOCUMENT_COLLECTION && key === rkey);
        const before = await get(collection, key);
        assert(
          before &&
            before.cid === cid &&
            before.cid === receipt!.document.original.cid &&
            isDeepStrictEqual(before.value, receipt!.document.original.value),
          'Only the exact snapshotted fixture can receive the new copy association.'
        );
        receipt!.document.expected = value;
        await save();
        await client.putRecord!(collection, key, value, cid);
      },
    };
    const announcements = await copies.syncBlueskyCopies(tracked, [
      { ...requested.writing, body: requested.content },
    ]);
    const post = announcements[0]?.post;
    assert(post && announcements.length === 1);
    const associated = await get(config.DOCUMENT_COLLECTION, rkey);
    assert(isDeepStrictEqual(associated?.value.bskyPostRef, post));
    let actual = requested;
    if (!retainedRuntime) {
      receipt.source.versions = [receipt.source.temporary!];
      receipt.source.temporary = matter.stringify(parsed.content, {
        ...data,
        atproto: { ...parsed.data.atproto, bskyPostRef: post },
      });
      await save();
      await writeFile(sourcePath, receipt.source.temporary);
      actual = await loadWriting(slug);
      assert(isDeepStrictEqual(actual.writing.atproto?.bskyPostRef, post));
    }
    await check(
      retainedRuntime
        ? 'Actual local loader opt-in creates an automatic copy associated with the retained hosted document through its current PDS record'
        : 'Actual source and Standard document retain the real automatic copy strong reference',
      { post, document: { uri: associated!.uri, cid: associated!.cid } }
    );
    phase = 'real response and media publication';
    const base = {
      $type: 'app.bsky.feed.post',
      createdAt: new Date().toISOString(),
    };
    const reply = async (
      text: string,
      embed?: Record<string, unknown>,
      parent = post
    ) =>
      create('app.bsky.feed.post', {
        ...base,
        text,
        reply: { root: post, parent },
        ...(embed && { embed }),
      });
    const control = await reply(
      'A real Atmosphere reply that remains visible during refresh checks.'
    );
    const nested = await reply(
      'This real nested reply preserves the conversation thread.',
      undefined,
      control
    );
    const imageAlt = 'WillieCubed image from a real Atmosphere reply';
    const imageBlob = await ok(
      rpc.post('com.atproto.repo.uploadBlob', {
        input: await readFile(
          resolve(root, 'public/brand/social/avatar-400.png')
        ),
        headers: { 'content-type': 'image/png' },
      })
    );
    const image = await reply('An image reply from The Atmosphere.', {
      $type: 'app.bsky.embed.images',
      images: [{ alt: imageAlt, image: imageBlob.blob }],
    });
    const account = await ok(rpc.get('com.atproto.server.getSession', {}));
    assert(
      account.emailConfirmed !== false,
      'The isolated Bluesky account must verify its email before video upload.'
    );
    // Bluesky documents this uploadBlob path; acceptance waits for actual transcoding and playback.
    // https://bsky.network/docs/about-bluesky-content/video/
    const videoAlt = 'Moving circle in a real Atmosphere video reply';
    const videoBlob = await ok(
      rpc.post('com.atproto.repo.uploadBlob', {
        input: await readFile(
          resolve(root, 'tests/fixtures/atproto/acceptance-video.mp4')
        ),
        headers: { 'content-type': 'video/mp4' },
      })
    );
    const video = await reply('A video reply from The Atmosphere.', {
      $type: 'app.bsky.embed.video',
      video: videoBlob.blob,
      alt: videoAlt,
      aspectRatio: { width: 320, height: 180 },
    });
    const attachment = ORIGIN + '/brand/social/avatar-400.png';
    const linked = await reply('A linked file reply from The Atmosphere.', {
      $type: 'app.bsky.embed.external',
      external: {
        uri: attachment,
        title: 'Open the linked reply image',
        description: 'A real linked file attachment.',
      },
    });
    const quote = await create('app.bsky.feed.post', {
      ...base,
      text: 'A real quote of this acceptance writing.',
      embed: { $type: 'app.bsky.embed.record', record: post },
    });
    const like = await create('app.bsky.feed.like', {
      $type: 'app.bsky.feed.like',
      subject: post,
      createdAt: base.createdAt,
    });
    const repost = await create('app.bsky.feed.repost', {
      $type: 'app.bsky.feed.repost',
      subject: post,
      createdAt: base.createdAt,
    });
    const replyRefs = [control, nested, image, video, linked];
    let indexedPlaylist: string | undefined;
    phase = 'real response AppView indexing';
    await until('successful AppView response/media indexing', async () => {
      const thread = await appview<{ thread: Thread }>(
        'app.bsky.feed.getPostThread',
        {
          uri: post.uri,
          depth: '100',
          parentHeight: '0',
        },
        true
      );
      if (thread === null) return false;
      const [quotes, likes, reposts] = await Promise.all([
        appview<{ posts: PostView[] }>('app.bsky.feed.getQuotes', {
          uri: post.uri,
          limit: '100',
        }),
        appview<{ likes: { actor: { did: string } }[] }>(
          'app.bsky.feed.getLikes',
          { uri: post.uri, limit: '100' }
        ),
        appview<{ repostedBy: { did: string }[] }>(
          'app.bsky.feed.getRepostedBy',
          { uri: post.uri, limit: '100' }
        ),
      ]);
      const views = nodes(thread.thread);
      indexedPlaylist = views.find((view) => view.uri === video.uri)?.embed
        ?.playlist;
      return (
        replyRefs.every((ref) => views.some((view) => view.uri === ref.uri)) &&
        Boolean(indexedPlaylist) &&
        views.some(
          (view) => view.uri === image.uri && view.embed?.images?.length
        ) &&
        quotes.posts.some((view) => view.uri === quote.uri) &&
        likes.likes.some((like) => like.actor.did === did) &&
        reposts.repostedBy.some((actor) => actor.did === did)
      );
    });
    phase = 'real video CDN readiness';
    assert(indexedPlaylist);
    const cdnDeadline = AbortSignal.timeout(240000);
    let readyResources: { playlists: number; segments: number } | undefined;
    let lastCdnFailure = 'No successful CDN response.';
    await until('actual video CDN playlists and segments', async () => {
      try {
        const pending = [indexedPlaylist!];
        const playlists = new Set<string>();
        const assets = new Set<string>();
        while (pending.length) {
          const url = new URL(pending.shift()!);
          assert.equal(url.protocol, 'https:');
          if (playlists.has(url.href)) continue;
          assert(playlists.size < 32, 'Unexpected video playlist graph.');
          playlists.add(url.href);
          const response = await fetch(url, {
            signal: AbortSignal.any([cdnDeadline, AbortSignal.timeout(10000)]),
          });
          if (response.status !== 200) await response.body?.cancel();
          assert.equal(
            response.status,
            200,
            `Video playlist HTTP ${response.status}.`
          );
          const lines = (await response.text())
            .split(/\r?\n/)
            .map((line) => line.trim());
          assert.equal(lines[0], '#EXTM3U');
          const references = lines.filter(
            (line) => line && !line.startsWith('#')
          );
          assert(
            references.length,
            'The CDN playlist has no media references.'
          );
          if (lines.some((line) => line.startsWith('#EXT-X-STREAM-INF:'))) {
            pending.push(
              ...references.map(
                (reference) => new URL(reference, response.url).href
              )
            );
            for (const line of lines.filter((line) =>
              line.startsWith('#EXT-X-MEDIA:')
            )) {
              const uri = /(?:[:,])URI="([^"]+)"/.exec(line)?.[1];
              if (uri) pending.push(new URL(uri, response.url).href);
            }
          } else {
            assert(
              lines.includes('#EXT-X-ENDLIST'),
              'The fixture video is not yet complete.'
            );
            for (const reference of references)
              assets.add(new URL(reference, response.url).href);
            for (const line of lines.filter((line) =>
              line.startsWith('#EXT-X-MAP:')
            )) {
              const uri = /(?:[:,])URI="([^"]+)"/.exec(line)?.[1];
              assert(uri);
              assets.add(new URL(uri, response.url).href);
            }
          }
        }
        assert(assets.size > 0 && assets.size <= 64);
        for (const asset of assets) {
          assert.equal(new URL(asset).protocol, 'https:');
          const response = await fetch(asset, {
            headers: { range: 'bytes=0-1023' },
            signal: AbortSignal.any([cdnDeadline, AbortSignal.timeout(10000)]),
          });
          const reader = response.body?.getReader();
          try {
            assert(
              [200, 206].includes(response.status),
              `Video segment HTTP ${response.status}.`
            );
            const first = await reader?.read();
            assert(
              first?.value?.byteLength,
              'The CDN segment returned no bytes.'
            );
          } finally {
            await reader?.cancel().catch(() => {});
            reader?.releaseLock();
          }
        }
        readyResources = { playlists: playlists.size, segments: assets.size };
        return true;
      } catch (error) {
        lastCdnFailure =
          error instanceof Error ? error.message : 'CDN fetch failed.';
        cdnDeadline.throwIfAborted();
        return false;
      }
    }).catch((error) => {
      throw new Error(`Video CDN readiness failed: ${lastCdnFailure}`, {
        cause: error,
      });
    });
    await check(
      'The actual video CDN serves complete playlists and nonempty media/init segments before browser playback',
      readyResources
    );
    phase = 'real response import';
    const imported = await fetchBlueskyResponses(actual.writing);
    assert(
      replyRefs.every((ref) =>
        imported.groups.replies.some((reply) => reply.id === ref.uri)
      ) &&
        imported.groups.mentions.some((reply) => reply.id === quote.uri) &&
        imported.groups.likes.length &&
        imported.groups.reposts.length,
      'The actual importer must retain every indexed reply, quote, like and repost.'
    );
    assert(
      imported.groups.replies.some(
        (reply) =>
          reply.id === video.uri &&
          reply.media?.some((media) => media.kind === 'video')
      ),
      'The actual importer must retain the indexed video media.'
    );
    await check(
      'Successful AppView and the actual writing loader import all real reply/media/reaction formats',
      { replies: replyRefs, quote, like, repost }
    );
    phase = 'hosted real response rendering';
    await deploy();
    const browser = await chromium.launch({ headless: true });
    const browserDiagnostics = new Map<Page, () => Promise<void>>();
    try {
      async function installBrowserDiagnostics(page: Page, label: string) {
        assert(
          !(await page.context().cookies(ORIGIN)).some((cookie) =>
            ['atproto_session', 'atproto_flow'].includes(cookie.name)
          ),
          'Hosted media diagnostics require an anonymous browser.'
        );
        const network: Record<string, unknown>[] = [];
        const errors: Record<string, unknown>[] = [];
        const keep = (
          items: Record<string, unknown>[],
          value: Record<string, unknown>
        ) => {
          if (items.length < 300)
            items.push({ observedAt: new Date().toISOString(), ...value });
        };
        const safeUrl = (value: string) => {
          try {
            const url = new URL(value);
            url.username = '';
            url.password = '';
            url.search = '';
            url.hash = '';
            return url.href.slice(0, 2048);
          } catch {
            return '[unparseable URL]';
          }
        };
        const relevant = (url: string, type: string) =>
          ['media', 'script', 'document'].includes(type) ||
          /\.(?:m3u8|m4s|mp4|ts)(?:[?#]|$)/i.test(url) ||
          new URL(url).hostname === 'video.bsky.app';
        page.on('response', (response) => {
          const request = response.request();
          if (relevant(response.url(), request.resourceType()))
            keep(network, {
              event: 'response',
              url: safeUrl(response.url()),
              resourceType: request.resourceType(),
              status: response.status(),
              contentType: response.headers()['content-type'],
              allowOrigin: response.headers()['access-control-allow-origin'],
              contentRange: response.headers()['content-range'],
            });
        });
        page.on('requestfailed', (request) =>
          keep(network, {
            event: 'requestfailed',
            url: safeUrl(request.url()),
            resourceType: request.resourceType(),
            error: request.failure()?.errorText,
          })
        );
        page.on('pageerror', (error) =>
          keep(errors, {
            event: 'pageerror',
            name: error.name,
            message: error.message.slice(0, 4096),
            stack: error.stack?.slice(0, 8192),
          })
        );
        page.on('console', (message) => {
          if (['error', 'warning'].includes(message.type()))
            keep(errors, {
              event: message.type(),
              message: message.text().slice(0, 4096),
            });
        });
        await page.addInitScript(`"use strict";
(() => {
    const safeUrl = (value) => {
        if (!value) return '';
        try {
            const url = new URL(value, location.href);
            url.username = '';
            url.password = '';
            url.search = '';
            url.hash = '';
            return url.href.slice(0, 2048);
        }
        catch {
            return '[unparseable URL]';
        }
    };
    const ranges = (value) => Array.from({ length: value.length }, (_, index) => [
        value.start(index),
        value.end(index),
    ]);
    const snapshotVideo = (v) => ({
        label: v.getAttribute('aria-label'),
        src: safeUrl(v.src),
        currentSrc: safeUrl(v.currentSrc),
        controls: v.controls,
        preload: v.preload,
        autoplay: v.autoplay,
        muted: v.muted,
        paused: v.paused,
        ended: v.ended,
        seeking: v.seeking,
        readyState: v.readyState,
        networkState: v.networkState,
        currentTime: v.currentTime,
        duration: Number.isFinite(v.duration)
            ? v.duration
            : String(v.duration),
        videoWidth: v.videoWidth,
        videoHeight: v.videoHeight,
        error: v.error
            ? { code: v.error.code, message: v.error.message }
            : null,
        buffered: ranges(v.buffered),
        seekable: ranges(v.seekable),
        nativeHls: v.canPlayType('application/vnd.apple.mpegurl'),
        nativeXHls: v.canPlayType('application/x-mpegURL'),
        h264: v.canPlayType('video/mp4; codecs="avc1.42E01E"'),
        aac: v.canPlayType('audio/mp4; codecs="mp4a.40.2"'),
        fallback: Array.from(v.parentElement?.querySelectorAll('a') ?? []).map((a) => ({ text: a.textContent, href: safeUrl(a.href) })),
    });
    const diagnostic = {
        events: [],
        playRejections: [],
        snapshot: () => ({
            observedAt: new Date().toISOString(),
            userAgent: navigator.userAgent,
            documentReadyState: document.readyState,
            mseH264: typeof MediaSource !== 'undefined' &&
                MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"'),
            videos: Array.from(document.querySelectorAll('video')).map(snapshotVideo),
        }),
    };
    window.__atprotoHostedMedia = diagnostic;
    for (const name of [
        'loadstart',
        'progress',
        'suspend',
        'abort',
        'error',
        'emptied',
        'stalled',
        'loadedmetadata',
        'loadeddata',
        'canplay',
        'canplaythrough',
        'playing',
        'waiting',
        'seeking',
        'seeked',
        'ended',
        'play',
        'pause',
        'durationchange',
        'timeupdate',
    ])
        document.addEventListener(name, (event) => {
            if (event.target instanceof HTMLVideoElement &&
                diagnostic.events.length < 300)
                diagnostic.events.push({
                    event: name,
                    at: performance.now(),
                    video: snapshotVideo(event.target),
                });
        }, true);
})();
`);
        let saved = false;
        const saveDiagnostic = async () => {
          if (saved) return;
          saved = true;
          const state = await page
            .evaluate(() => {
              const diagnostic = (
                window as typeof window & {
                  __atprotoHostedMedia?: {
                    snapshot: () => unknown;
                    events: unknown[];
                    playRejections: unknown[];
                  };
                }
              ).__atprotoHostedMedia;
              return diagnostic
                ? {
                    state: diagnostic.snapshot(),
                    events: diagnostic.events,
                    playRejections: diagnostic.playRejections,
                  }
                : {
                    unavailable:
                      'Browser media instrumentation was not installed in this document.',
                  };
            })
            .catch(() => ({
              unavailable:
                'The browser document was unavailable during failure capture.',
            }));
          const path = `${values.receipt}.browser-${label}-${randomUUID()}.json`;
          await writeFile(
            path,
            JSON.stringify(
              {
                phase,
                label,
                capturedAt: new Date().toISOString(),
                network,
                errors,
                ...state,
              },
              null,
              2
            ) + '\n',
            { mode: 0o600, flag: 'wx' }
          );
          await chmod(path, 0o600);
          const screenshot = `${path}.png`;
          await page
            .screenshot({ path: screenshot, fullPage: true })
            .then(() => chmod(screenshot, 0o600))
            .catch(() => {});
        };
        browserDiagnostics.set(page, saveDiagnostic);
        return saveDiagnostic;
      }
      async function load(page: Page) {
        if (!browserDiagnostics.has(page))
          await installBrowserDiagnostics(page, 'cache-refresh');
        if (retainedRuntime) await verifyRetainedHttp();
        const response = await page.goto(`${ORIGIN}/writings/${slug}`, {
          waitUntil: 'networkidle',
          timeout: 45000,
        });
        assert(response?.status() === 200);
      }
      async function visible(page: Page, uri: string) {
        return page
          .locator(`a.u-url[href="${copies.blueskyPostUrl(uri)}"]`)
          .count()
          .then((count) => count > 0);
      }
      async function capture(
        label: string,
        verify: (page: Page) => Promise<void>
      ) {
        for (const width of [1440, 390])
          for (const theme of ['light', 'dark']) {
            const context = await browser.newContext({
              viewport: { width, height: width === 390 ? 844 : 1000 },
              reducedMotion: 'reduce',
            });
            let saveDiagnostic: (() => Promise<void>) | undefined;
            try {
              await context.addInitScript(
                (theme) => localStorage.setItem('theme', theme),
                theme
              );
              const page = await context.newPage();
              saveDiagnostic = await installBrowserDiagnostics(
                page,
                `${label}-${width}-${theme}`
              );
              await load(page);
              await verify(page);
              assert(
                await page.evaluate(
                  () =>
                    document.documentElement.scrollWidth <=
                    window.innerWidth + 1
                ),
                'The hosted page overflows its viewport.'
              );
              const screenshot = resolve(
                dirname(values.receipt!),
                `atmosphere-${label}-${width}-${theme}.png`
              );
              await page.screenshot({ path: screenshot, fullPage: true });
              receipt!.screenshots.push(screenshot);
              await save();
            } catch (error) {
              await saveDiagnostic?.().catch(() => {});
              throw error;
            } finally {
              await context.close();
            }
          }
      }
      if (retainedRuntime) {
        const page = await browser.newPage();
        try {
          await until(
            'retained hosted cache discovers every new owned response',
            async () => {
              await load(page);
              return (
                await Promise.all(
                  [...replyRefs, quote].map((ref) => visible(page, ref.uri))
                )
              ).every(Boolean);
            },
            300
          );
        } finally {
          await page.close();
        }
      }
      await capture('all-formats', async (page) => {
        for (const ref of [...replyRefs, quote])
          assert(
            await visible(page, ref.uri),
            'A real source permalink is missing from the hosted page.'
          );
        const img = page.getByAltText(imageAlt, { exact: true });
        await img.scrollIntoViewIfNeeded();
        await img.waitFor({ state: 'visible' });
        await page.waitForFunction(
          (alt) => {
            const image = document.querySelector(
              `img[alt="${alt}"]`
            ) as HTMLImageElement | null;
            return !!image && image.complete && image.naturalWidth > 0;
          },
          imageAlt,
          { timeout: 30000 }
        );
        assert(
          await img.evaluate(
            (img) =>
              (img as HTMLImageElement).complete &&
              (img as HTMLImageElement).naturalWidth > 0
          )
        );
        const videoElement = page.locator(`video[aria-label="${videoAlt}"]`);
        assert((await videoElement.count()) === 1);
        assert(
          await videoElement.evaluate(
            (video) =>
              (video as HTMLVideoElement).controls &&
              !(video as HTMLVideoElement).autoplay
          )
        );
        await videoElement.scrollIntoViewIfNeeded();
        await videoElement.click();
        await videoElement.evaluate((video) => {
          void (video as HTMLVideoElement).play().catch((error: unknown) => {
            const diagnostic = (
              window as typeof window & {
                __atprotoHostedMedia?: { playRejections: unknown[] };
              }
            ).__atprotoHostedMedia;
            diagnostic?.playRejections.push({
              at: performance.now(),
              name: error instanceof Error ? error.name : 'UnknownError',
              message:
                error instanceof Error ? error.message : 'Playback rejected.',
            });
          });
        });
        await page.waitForFunction(
          (alt) => {
            const v = document.querySelector(
              `video[aria-label="${alt}"]`
            ) as HTMLVideoElement | null;
            return (
              !!v &&
              v.currentTime > 0 &&
              Number.isFinite(v.duration) &&
              v.duration > 0 &&
              v.videoWidth > 0
            );
          },
          videoAlt,
          { timeout: 30000 }
        );
        await videoElement.evaluate((video) =>
          (video as HTMLVideoElement).pause()
        );
        assert((await page.locator(`a[href="${attachment}"]`).count()) > 0);
        assert(
          (await page.locator('.u-like').count()) > 0 &&
            (await page.locator('.u-repost').count()) > 0
        );
        const nestedCard = page.locator(
          `li:has(a.u-url[href="${copies.blueskyPostUrl(nested.uri)}"])`
        );
        assert(
          await nestedCard.evaluate(
            (card) => parseFloat(getComputedStyle(card).marginInlineStart) > 0
          )
        );
        await page.evaluate(() => window.scrollTo(0, 0));
      });
      await check(
        'Hosted full-page desktop/mobile light/dark render actual text, nesting, image, playable video, linked file, quote and reactions',
        { screenshots: receipt.screenshots }
      );
      phase = 'hosted edit refresh';
      const controlEntry = receipt.owned.find(
        (entry) => entry.rkey === control.uri.split('/').at(-1)
      )!;
      const current = await ownedCurrent(controlEntry);
      assert(current);
      const changed = {
        ...current.value,
        text: 'This Atmosphere reply was edited on its real PDS.',
      };
      controlEntry.previous = [
        ...(controlEntry.previous ?? []),
        { cid: current.cid, value: current.value },
      ];
      controlEntry.value = changed;
      controlEntry.cid = undefined;
      await save();
      await client.putRecord!(
        'app.bsky.feed.post',
        controlEntry.rkey,
        changed,
        current.cid
      );
      const edited = await get(controlEntry.collection, controlEntry.rkey);
      assert(edited && isDeepStrictEqual(edited.value, changed));
      controlEntry.cid = edited.cid;
      await save();
      await until(
        'AppView still discovers the edited reply and surviving control',
        async () => {
          const posts = await appview<{ posts: PostView[] }>(
            'app.bsky.feed.getPosts',
            { uris: [control.uri, image.uri] }
          );
          return (
            posts.posts.some((p) => p.uri === control.uri) &&
            posts.posts.some((p) => p.uri === image.uri)
          );
        }
      );
      const page = await browser.newPage();
      try {
        await until(
          'hosted reply cache edit refresh',
          async () => {
            await load(page);
            return (
              (await page.getByText(changed.text, { exact: true }).count()) >
                0 && (await visible(page, image.uri))
            );
          },
          300
        );
      } finally {
        await page.close();
      }
      await capture('edited', async (page) =>
        assert(
          (await page.getByText(changed.text, { exact: true }).count()) > 0 &&
            (await visible(page, image.uri))
        )
      );
      await check(
        'AppView discovery and hosted cache refresh display the verified current PDS edit with a surviving control',
        { uri: control.uri, currentPdsCid: edited.cid, text: changed.text }
      );
      phase = 'hosted hidden-reply refresh';
      await create(
        'app.bsky.feed.threadgate',
        {
          $type: 'app.bsky.feed.threadgate',
          post: post.uri,
          createdAt: new Date().toISOString(),
          hiddenReplies: [image.uri],
        },
        rkey
      );
      await until(
        'successful AppView hidden reply with visible control',
        async () => {
          const thread = await appview<{
            thread: Thread;
            threadgate?: { record?: { hiddenReplies?: string[] } };
          }>('app.bsky.feed.getPostThread', {
            uri: post.uri,
            depth: '100',
            parentHeight: '0',
          });
          const posts = await appview<{ posts: PostView[] }>(
            'app.bsky.feed.getPosts',
            { uris: [image.uri, control.uri] }
          );
          return (
            thread.threadgate?.record?.hiddenReplies?.includes(image.uri) ===
              true &&
            nodes(thread.thread).some((p) => p.uri === control.uri) &&
            posts.posts.some((p) => p.uri === image.uri) &&
            posts.posts.some((p) => p.uri === control.uri)
          );
        }
      );
      const hiddenPage = await browser.newPage();
      try {
        await until(
          'hosted hidden reply cache refresh',
          async () => {
            await load(hiddenPage);
            return (
              (await visible(hiddenPage, control.uri)) &&
              (await visible(hiddenPage, video.uri)) &&
              !(await visible(hiddenPage, image.uri))
            );
          },
          300
        );
      } finally {
        await hiddenPage.close();
      }
      await capture('hidden', async (page) => {
        assert(
          (await visible(page, control.uri)) &&
            (await visible(page, video.uri)) &&
            !(await visible(page, image.uri))
        );
      });
      await check(
        'Actual threadgate hides an existing image reply while surviving text/video responses remain visible on the hosted page'
      );
      phase = 'hosted hidden-reply restoration';
      const gate = receipt.owned.find(
        (entry) => entry.collection === 'app.bsky.feed.threadgate'
      )!;
      await remove(gate);
      await until('successful AppView restored reply', async () => {
        const thread = await appview<{
          thread: Thread;
          threadgate?: { record?: { hiddenReplies?: string[] } };
        }>('app.bsky.feed.getPostThread', {
          uri: post.uri,
          depth: '100',
          parentHeight: '0',
        });
        return (
          !thread.threadgate?.record?.hiddenReplies?.includes(image.uri) &&
          nodes(thread.thread).some((p) => p.uri === image.uri) &&
          nodes(thread.thread).some((p) => p.uri === control.uri)
        );
      });
      const restoredPage = await browser.newPage();
      try {
        await until(
          'hosted restored reply cache refresh',
          async () => {
            await load(restoredPage);
            return (
              (await visible(restoredPage, control.uri)) &&
              (await visible(restoredPage, image.uri))
            );
          },
          300
        );
      } finally {
        await restoredPage.close();
      }
      await capture('restored', async (page) =>
        assert(
          (await visible(page, control.uri)) && (await visible(page, image.uri))
        )
      );
      await check(
        'Removing the owned threadgate restores the existing image reply through the hosted cache'
      );
      phase = 'hosted deletion refresh';
      const removed = [nested, image, video, linked, quote, like, repost];
      for (const ref of removed) {
        const entry = receipt.owned.find(
          (entry) => `at://${did}/${entry.collection}/${entry.rkey}` === ref.uri
        )!;
        await remove(entry);
      }
      await until('successful AppView deleted response absence', async () => {
        const [posts, thread, quotes, likes, reposts] = await Promise.all([
          appview<{ posts: PostView[] }>('app.bsky.feed.getPosts', {
            uris: [
              control.uri,
              ...removed
                .filter((ref) => ref.uri.includes('/app.bsky.feed.post/'))
                .map((ref) => ref.uri),
            ],
          }),
          appview<{ thread: Thread }>('app.bsky.feed.getPostThread', {
            uri: post.uri,
            depth: '100',
            parentHeight: '0',
          }),
          appview<{ posts: PostView[] }>('app.bsky.feed.getQuotes', {
            uri: post.uri,
            limit: '100',
          }),
          appview<{ likes: { actor: { did: string } }[] }>(
            'app.bsky.feed.getLikes',
            { uri: post.uri, limit: '100' }
          ),
          appview<{ repostedBy: { did: string }[] }>(
            'app.bsky.feed.getRepostedBy',
            { uri: post.uri, limit: '100' }
          ),
        ]);
        return (
          posts.posts.some((p) => p.uri === control.uri) &&
          !posts.posts.some((p) => removed.some((ref) => ref.uri === p.uri)) &&
          nodes(thread.thread).some((p) => p.uri === control.uri) &&
          !nodes(thread.thread).some((p) =>
            removed.some((ref) => ref.uri === p.uri)
          ) &&
          !quotes.posts.some((p) => p.uri === quote.uri) &&
          !likes.likes.some((like) => like.actor.did === did) &&
          !reposts.repostedBy.some((actor) => actor.did === did)
        );
      });
      const refreshed = await browser.newPage();
      try {
        await until(
          'hosted deletion cache refresh',
          async () => {
            await load(refreshed);
            return (
              (await visible(refreshed, control.uri)) &&
              !(
                await Promise.all(
                  removed
                    .filter((ref) => ref.uri.includes('/app.bsky.feed.post/'))
                    .map((ref) => visible(refreshed, ref.uri))
                )
              ).some(Boolean) &&
              (await refreshed.locator('.u-like,.u-repost').count()) === 0
            );
          },
          300
        );
      } finally {
        await refreshed.close();
      }
      await capture('deleted', async (page) => {
        assert(await visible(page, control.uri));
        for (const ref of removed.filter((ref) =>
          ref.uri.includes('/app.bsky.feed.post/')
        ))
          assert(!(await visible(page, ref.uri)));
        assert((await page.locator('.u-like,.u-repost').count()) === 0);
      });
      await check(
        'Successful direct AppView absence and surviving reply prove hosted media/quote/reaction deletion refresh'
      );
    } catch (error) {
      for (const saveDiagnostic of browserDiagnostics.values())
        await saveDiagnostic().catch(() => {});
      throw error;
    } finally {
      await browser.close();
    }
  } catch (error) {
    await saveFailure(error).catch(() => {
      // A diagnostic filesystem failure must not replace the provider error.
    });
    if (receipt) {
      receipt.error = `The ${phase} phase failed. Detailed provider or browser errors are omitted.`;
      await save();
    }
    throw error;
  } finally {
    try {
      if (receipt && ownershipVerified) await cleanup();
    } finally {
      const closed = await Promise.allSettled([
        Promise.resolve().then(() => client.close()),
        Promise.resolve().then(() => session.logout()),
      ]);
      assert(
        closed.every((result) => result.status === 'fulfilled'),
        'The owned hosted publishing sessions did not both close. Provider details are withheld.'
      );
    }
  }
}
main().catch(() => {
  console.error(
    `Hosted Atmosphere verification failed during ${phase}. Recover with --cleanup using ${privateReceipt}. No credential or provider redirect details were printed.`
  );
  process.exitCode = 1;
});
