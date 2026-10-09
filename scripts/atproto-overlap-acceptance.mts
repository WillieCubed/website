import type {} from '@atcute/atproto';
import type {} from '@atcute/bluesky';
import { Client, ok } from '@atcute/client';
import type { Did, Nsid } from '@atcute/lexicons';
import { PasswordSession } from '@atcute/password-session';
import { now } from '@atcute/tid';
import { chromium } from '@playwright/test';
import { createPool } from '@vercel/postgres';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs, parseEnv } from 'node:util';

import type { RepoClient } from '../lib/atproto/types';
import { fixtureSource } from './atproto-fixture-source.mts';

const ORIGIN = 'https://indieweb-acceptance.vercel.app';
const OWNER = 'did:plc:iyn6nc3ffqm2e3555exyrgvv';
const ACCOUNT = '18f90fa11cf0a87145be4a1517e41217';
const DOMAIN = 'willieechalmers-18f.workers.dev';
const SLUG = 'overlap-acceptance-20261009';
const TARGET = `${ORIGIN}/writings/${SLUG}`;
type Row = Record<string, unknown>;
type OwnedRecord = {
  collection: string;
  rkey: string;
  value: Row;
  cid?: string;
  deleted?: boolean;
};
type Snapshot = { value: Row; canonical: string };
interface Journal {
  version: 1;
  workspace: string;
  origin: string;
  did: string;
  slug: string;
  marker: string;
  createdAt: string;
  expiresAt: string;
  workerName: string;
  source: string;
  workerSource: string;
  workerHash: string;
  workerIntent?: boolean;
  workerRemoved?: boolean;
  records: OwnedRecord[];
  copy?: { uri: string; cid: string };
  repostRkey: string;
  publicationIntent?: boolean;
  deliveryIntent?: string;
  redeliveryIntents?: string[];
  mentionId?: string;
  mentionSnapshots: Snapshot[];
  approvalIntent?: boolean;
  rejectionIntent?: boolean;
  mentionRemoved?: boolean;
  foreignMentionHash?: string;
  runtimeRevision?: string;
  archiveDeployment?: Row;
  screenshots: string[];
  observations?: Snapshot[];
  hostedNativeBaseline?: Row;
  evidence?: Row;
  cleanup: 'pending' | 'passed';
}
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    env: { type: 'string' },
    output: { type: 'string' },
    'deployment-receipt': { type: 'string' },
  },
});
assert(
  values.env && values.output,
  'Provide --env and --output private paths.'
);
const operation = positionals[0];
assert(
  positionals.length === 1 &&
    ['prepare', 'publish', 'prove', 'cleanup-records'].includes(operation)
);
const output = resolve(values.output);
await mkdir(output, { recursive: true, mode: 0o700 });
await chmod(output, 0o700);
const path = resolve(output, 'overlap-journal.json');
Object.assign(
  process.env,
  parseEnv(await readFile(resolve(values.env), 'utf8'))
);
assert.equal(process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/$/, ''), ORIGIN);
assert(
  process.env.NEXT_PUBLIC_ATPROTO_DID &&
    process.env.NEXT_PUBLIC_ATPROTO_DID !== OWNER
);
assert(/^did:plc:[a-z2-7]+$/.test(process.env.NEXT_PUBLIC_ATPROTO_DID));
assert(
  /^ep-winter-wind-b5iiaxe7(?:-pooler)?\.c-7\.us-east-2\.aws\.neon\.tech$/.test(
    new URL(process.env.POSTGRES_URL!).hostname
  )
);
assert.equal(
  execFileSync('git', ['branch', '--show-current'], {
    cwd: root,
    encoding: 'utf8',
  }).trim(),
  'codex/publishing-overlap-live-acceptance'
);
const did = process.env.NEXT_PUBLIC_ATPROTO_DID as Did;
const profile = `https://bsky.app/profile/${did}`;
let journal: Journal;
async function save() {
  await writeFile(`${path}.next`, JSON.stringify(journal, null, 2) + '\n', {
    mode: 0o600,
  });
  await rename(`${path}.next`, path);
}
async function exists(file: string) {
  try {
    await readFile(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}
async function http(url: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
  });
}
async function until(
  name: string,
  check: () => Promise<boolean>,
  attempts = 120
) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (await check()) return;
    await delay(1000);
  }
  throw new Error(
    `Timed out waiting for ${name}. Resume the same operation with its journal.`
  );
}
async function cf(resource: string, init: RequestInit = {}) {
  const token: unknown = JSON.parse(
    execFileSync('wrangler', ['auth', 'token', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  ).token;
  assert(typeof token === 'string' && token);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return http(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/${resource}`,
    { ...init, headers }
  );
}
async function ownedWorker() {
  const result = await cf(`workers/scripts/${journal.workerName}/content/v2`);
  if (result.status === 404) return false;
  assert(result.ok);
  const modules = [...(await result.formData()).entries()];
  assert(modules.length === 1 && modules[0][0] === 'index.mjs');
  const value = modules[0][1];
  const content = typeof value === 'string' ? value : await value.text();
  assert.equal(content, journal.workerSource, 'Refuse a changed Worker.');
  assert.equal(hash(content), journal.workerHash);
  return true;
}
async function sourceOriginal() {
  const source = JSON.parse(
    await readFile(resolve(output, 'fixture-source-journal.json'), 'utf8')
  );
  assert(
    source.version === 1 && source.workspace === root && source.slug === SLUG
  );
  assert.equal(hash(source.original), source.sha256);
  assert(!source.removed && source.cleanup === 'pending');
  assert.equal(
    await readFile(resolve(root, 'content/writings', `${SLUG}.mdx`), 'utf8'),
    source.original
  );
  return source;
}
async function prepare() {
  if (!(await exists(path))) {
    assert(
      !(await exists(resolve(root, 'content/writings', `${SLUG}.mdx`))),
      'Refuse an unowned preexisting source.'
    );
    const marker = randomBytes(24).toString('hex');
    const workerName = `dev-williecubed-website-overlap-${randomBytes(8).toString('hex')}`;
    const source = `https://${workerName}.${DOMAIN}/repost/${marker}`;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Owned overlap repost</title><article class="h-entry"><a class="u-url" href="${source}">Repost permalink</a><span class="p-author h-card"><span class="p-name">Owned overlap actor</span><a class="u-url" href="${profile}">Bluesky profile</a></span><time class="dt-published" datetime="${createdAt}">9 October 2026</time><a class="u-repost-of" href="${TARGET}">Original writing</a><p class="e-content">This owned repost checks one response received through two publishing protocols.</p></article></html>`;
    const workerSource = `// owned:${marker}\nconst source=${JSON.stringify(source)},expires=${JSON.stringify(expiresAt)},html=${JSON.stringify(html)};export default {fetch(request){if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});if(new URL(request.url).href!==source)return new Response('Not found',{status:404});if(Date.now()>Date.parse(expires))return new Response('Expired',{status:410});return new Response(request.method==='HEAD'?null:html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Acceptance-Owner':${JSON.stringify(marker)}}});}};\n`;
    journal = {
      version: 1,
      workspace: root,
      origin: ORIGIN,
      did,
      slug: SLUG,
      marker,
      createdAt,
      expiresAt,
      workerName,
      source,
      workerSource,
      workerHash: hash(workerSource),
      records: [],
      repostRkey: now(),
      mentionSnapshots: [],
      screenshots: [],
      cleanup: 'pending',
    };
    await writeFile(path, JSON.stringify(journal, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
  }
  await fixtureSource(output, root, SLUG, false, [profile]);
  await sourceOriginal();
}
if (await exists(path)) {
  journal = JSON.parse(await readFile(path, 'utf8')) as Journal;
  assert(
    journal.version === 1 &&
      journal.workspace === root &&
      journal.origin === ORIGIN &&
      journal.did === did &&
      journal.slug === SLUG
  );
  assert(/^[a-f0-9]{48}$/.test(journal.marker));
  assert(
    /^dev-williecubed-website-overlap-[a-f0-9]{16}$/.test(journal.workerName)
  );
  assert.equal(
    journal.source,
    `https://${journal.workerName}.${DOMAIN}/repost/${journal.marker}`
  );
  assert(journal.workerSource.startsWith(`// owned:${journal.marker}\n`));
  assert.equal(hash(journal.workerSource), journal.workerHash);
} else assert.equal(operation, 'prepare', 'Run prepare first.');

async function run() {
  if (operation === 'prepare') {
    await prepare();
    return;
  }
  assert(
    process.env.ATPROTO_APP_PASSWORD && process.env.WEBMENTION_MODERATION_SECRET
  );
  const [
    { fixtureJournal },
    { publishingIdentity },
    { resolvePds },
    { createRepoClient },
    { loadWriting },
    { documentRkey },
  ] = await Promise.all([
    import('./atproto-fixture-journal.mts'),
    import('../lib/atproto/config'),
    import('../lib/atproto/identity'),
    import('../lib/atproto/client'),
    import('../lib/writings'),
    import('../lib/atproto/keys'),
  ]);
  assert.equal(publishingIdentity().did, did);
  const db = createPool({ connectionString: process.env.POSTGRES_URL, max: 1 });
  const client = await createRepoClient(process.env.ATPROTO_APP_PASSWORD);
  const session = await PasswordSession.login({
    service: await resolvePds(did),
    identifier: did,
    password: process.env.ATPROTO_APP_PASSWORD,
  });
  assert.equal(session.did, did);
  const rpc = new Client({ handler: session });
  async function row(): Promise<Snapshot | undefined> {
    const result = await db.query(
      'SELECT to_jsonb(w) AS value, to_jsonb(w)::text AS canonical FROM webmentions w WHERE source_url=$1 AND target_url=$2',
      [journal.source, TARGET]
    );
    assert(result.rows.length <= 1);
    return result.rows[0] as Snapshot | undefined;
  }
  async function foreignMentions() {
    const result = await db.query(
      'SELECT to_jsonb(w)::text AS canonical FROM webmentions w WHERE NOT(source_url=$1 AND target_url=$2) ORDER BY id',
      [journal.source, TARGET]
    );
    return hash(JSON.stringify(result.rows.map((value) => value.canonical)));
  }
  function assertOwnedMention(snapshot: Snapshot) {
    assert(journal.deliveryIntent);
    assert.equal(snapshot.value.source_url, journal.source);
    assert.equal(snapshot.value.target_url, TARGET);
    assert.equal(typeof snapshot.value.id, 'string');
    assert(
      new Date(String(snapshot.value.received_at)).getTime() >=
        new Date(journal.deliveryIntent).getTime() - 1000
    );
    if (journal.mentionId) assert.equal(snapshot.value.id, journal.mentionId);
    if (snapshot.value.is_verified) {
      assert.equal(snapshot.value.type, 'repost');
      assert.equal(snapshot.value.author_url, profile);
      assert.equal(snapshot.value.author_name, 'Owned overlap actor');
    }
  }
  async function remember(snapshot: Snapshot) {
    assertOwnedMention(snapshot);
    if (journal.mentionSnapshots.length) {
      const known = journal.mentionSnapshots.at(-1)!;
      const previous = { ...known.value },
        current = { ...snapshot.value };
      const verificationFields = [
        'type',
        'author_name',
        'author_url',
        'author_photo',
        'content',
        'content_html',
        'published_at',
        'raw_mf2_json',
        'verified_at',
        'is_verified',
        'rsvp',
      ];
      if (previous.received_at !== current.received_at) {
        const redelivery = journal.redeliveryIntents?.at(-1);
        assert(redelivery);
        const difference =
          new Date(String(current.received_at)).getTime() -
          new Date(redelivery).getTime();
        assert(difference >= -1000 && difference <= 30000);
        delete previous.received_at;
        delete current.received_at;
      }
      if (!known.value.is_verified && snapshot.value.is_verified) {
        for (const key of verificationFields) {
          delete previous[key];
          delete current[key];
        }
      }
      if (journal.approvalIntent || journal.rejectionIntent) {
        for (const key of ['is_approved', 'is_deleted', 'deleted_at']) {
          delete previous[key];
          delete current[key];
        }
      }
      assert(
        isDeepStrictEqual(previous, current),
        'Refuse an independently changed mention.'
      );
    }
    journal.mentionId = String(snapshot.value.id);
    if (
      !journal.mentionSnapshots.some(
        (known) => known.canonical === snapshot.canonical
      )
    )
      journal.mentionSnapshots.push(snapshot);
    await save();
  }
  async function moderate(action: 'approve' | 'reject') {
    const result = await http(`${ORIGIN}/api/webmention/moderate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WEBMENTION_MODERATION_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: journal.mentionId, action }),
    });
    assert.equal(result.status, 200);
    const response = await result.json();
    assert.equal(response.id, journal.mentionId);
    assert.equal(
      response.status,
      action === 'approve' ? 'approved' : 'rejected'
    );
  }
  async function intent(collection: string, rkey: string, value: Row) {
    const current = await client.getRecord!(collection, rkey);
    const existing = journal.records.filter(
      (record) => record.collection === collection && record.rkey === rkey
    );
    if (current) {
      assert(
        existing.some(
          (record) =>
            isDeepStrictEqual(record.value, current.value) &&
            (!record.cid || record.cid === current.cid)
        ),
        'Refuse a record outside the journaled versions.'
      );
    }
    if (!existing.some((record) => isDeepStrictEqual(record.value, value))) {
      journal.records.push({ collection, rkey, value });
      await save();
    }
  }
  async function observeRecords() {
    for (const record of journal.records) {
      const current = await client.getRecord!(record.collection, record.rkey);
      if (current && isDeepStrictEqual(current.value, record.value)) {
        if (record.cid) assert.equal(current.cid, record.cid);
        record.cid = current.cid;
      }
    }
    await save();
  }
  try {
    if (operation === 'cleanup-records') {
      if (journal.copy) {
        assert(
          journal.copy.uri ===
            `at://${did}/app.bsky.feed.post/${journal.records.find((record) => record.collection === 'app.bsky.feed.post')?.rkey}`
        );
        const connection = await db.connect();
        try {
          await connection.query('BEGIN');
          const owned = await connection.query(
            'SELECT to_jsonb(o) AS value, to_jsonb(o)::text AS canonical FROM atproto_response_observations o WHERE copy_uri=$1 AND actor_did=$2 FOR UPDATE',
            [journal.copy.uri, did]
          );
          for (const observation of owned.rows as Snapshot[]) {
            assert(
              new Date(String(observation.value.observed_at)).getTime() >=
                new Date(journal.createdAt).getTime()
            );
            if (journal.observations?.length)
              assert(
                journal.observations.some(
                  (snapshot) => snapshot.canonical === observation.canonical
                )
              );
            const removed: { rowCount: number | null } = await connection.query(
              'DELETE FROM atproto_response_observations WHERE copy_uri=$1 AND actor_did=$2 AND observed_at=$3 RETURNING actor_did',
              [journal.copy.uri, did, observation.value.observed_at]
            );
            assert.equal(removed.rowCount, 1);
          }
          await connection.query('COMMIT');
        } catch (error) {
          await connection.query('ROLLBACK');
          throw error;
        } finally {
          connection.release();
        }
      }
      let current = await row();
      if (current) {
        await remember(current);
        if (!current.value.is_deleted) {
          journal.rejectionIntent = true;
          await save();
          await moderate('reject');
          current = await row();
          assert(current);
          await remember(current);
        }
        const connection = await db.connect();
        try {
          await connection.query('BEGIN');
          const locked = await connection.query(
            'SELECT to_jsonb(w)::text AS canonical FROM webmentions w WHERE id=$1 FOR UPDATE',
            [journal.mentionId]
          );
          assert.equal(locked.rows.length, 1);
          assert.equal(locked.rows[0].canonical, current.canonical);
          const removed = await connection.query(
            'DELETE FROM webmentions WHERE id=$1 AND source_url=$2 AND target_url=$3 RETURNING id',
            [journal.mentionId, journal.source, TARGET]
          );
          assert.equal(removed.rowCount, 1);
          await connection.query('COMMIT');
        } catch (error) {
          await connection.query('ROLLBACK');
          throw error;
        } finally {
          connection.release();
        }
      }
      assert(!(await row()));
      journal.mentionRemoved = true;
      await save();
      if (await ownedWorker()) {
        assert(journal.workerIntent);
        const removed = await cf(`workers/scripts/${journal.workerName}`, {
          method: 'DELETE',
        });
        assert(removed.ok);
      }
      assert(!(await ownedWorker()));
      journal.workerRemoved = true;
      await save();
      const keys = new Set<string>();
      for (const owned of [...journal.records].reverse()) {
        if (!owned.collection.startsWith('app.bsky.')) continue;
        const key = `${owned.collection}/${owned.rkey}`;
        if (keys.has(key)) continue;
        keys.add(key);
        const current = await client.getRecord!(owned.collection, owned.rkey);
        if (current) {
          assert(
            journal.records.some(
              (record) =>
                record.collection === owned.collection &&
                record.rkey === owned.rkey &&
                isDeepStrictEqual(record.value, current.value) &&
                (!record.cid || record.cid === current.cid)
            ),
            'Refuse changed Bluesky record cleanup.'
          );
          await ok(
            rpc.post('com.atproto.repo.deleteRecord', {
              input: {
                repo: did,
                collection: owned.collection as Nsid,
                rkey: owned.rkey,
                swapRecord: current.cid,
              },
            })
          );
        }
        assert(!(await client.getRecord!(owned.collection, owned.rkey)));
        owned.deleted = true;
        await save();
      }
      if (await exists(resolve(output, 'fixture-publication-journal.json'))) {
        const publication = JSON.parse(
          await readFile(
            resolve(output, 'fixture-publication-journal.json'),
            'utf8'
          )
        );
        for (const [collection, key, original] of [
          ['site.standard.document', publication.documentRkey, null],
          [
            'site.standard.publication',
            publication.publicationRkey,
            publication.originalPublication,
          ],
        ] as const) {
          const current = await client.getRecord!(collection, key);
          if (current)
            assert(
              (original &&
                current.cid === original.cid &&
                isDeepStrictEqual(current.value, original.value)) ||
                journal.records.some(
                  (record) =>
                    record.collection === collection &&
                    record.rkey === key &&
                    isDeepStrictEqual(record.value, current.value) &&
                    (!record.cid || record.cid === current.cid)
                ),
              'Refuse changed Standard records before fixture cleanup.'
            );
        }
        const fixture = await fixtureJournal(output, SLUG, undefined, true);
        await fixture.cleanup();
      }
      if (journal.foreignMentionHash)
        assert.equal(
          await foreignMentions(),
          journal.foreignMentionHash,
          'Unrelated mentions changed. Preserve evidence for review.'
        );
      journal.cleanup = 'passed';
      await save();
      return;
    }
    await sourceOriginal();
    const loaded = await loadWriting(SLUG);
    assert.equal(loaded.writing.draft, false);
    assert(loaded.writing.syndicateTo?.includes(profile));
    const rkey = documentRkey(`/writings/${SLUG}`, loaded.writing.published);
    if (operation === 'publish') {
      const target = await http(TARGET);
      assert.equal(target.status, 200);
      assert(
        (await target.text()).includes(
          (await sourceOriginal()).original.match(
            /Fixture identifier: ([a-f0-9-]+)/
          )[1]
        )
      );
      const fixture = await fixtureJournal(
        output,
        SLUG,
        loaded.writing.published,
        await exists(resolve(output, 'fixture-publication-journal.json'))
      );
      const allowed = new Set([
        `site.standard.publication/${publishingIdentity().publicationRkey}`,
        `site.standard.document/${rkey}`,
      ]);
      const tracked: RepoClient = {
        ...client,
        async applyWrites(writes) {
          for (const write of writes) {
            assert(
              allowed.has(`${write.collection}/${write.rkey}`) &&
                'value' in write,
              'Refuse deletion or another publication target.'
            );
            await intent(write.collection, write.rkey, write.value);
          }
          journal.publicationIntent = true;
          await save();
          try {
            await client.applyWrites(writes);
          } finally {
            await observeRecords();
          }
        },
        async createRecord(collection, key, value) {
          assert(collection === 'app.bsky.feed.post' && key === rkey);
          await intent(collection, key, value);
          try {
            return await client.createRecord!(collection, key, value);
          } finally {
            await observeRecords();
          }
        },
        async putRecord(collection, key, value, cid) {
          assert(collection === 'site.standard.document' && key === rkey);
          await intent(collection, key, value);
          try {
            await client.putRecord!(collection, key, value, cid);
          } finally {
            await observeRecords();
          }
        },
      };
      const { syncAtproto } = await import('../lib/atproto/sync');
      try {
        await syncAtproto({
          client: tracked,
          writings: [{ ...loaded.writing, body: loaded.content }],
          fetchImage: async () => null,
        });
      } finally {
        await fixture.observe();
      }
      const document = await client.getRecord!('site.standard.document', rkey);
      assert(
        document && document.value.site === publishingIdentity().publicationUri
      );
      const copy = document.value.bskyPostRef as { uri: string; cid: string };
      assert(
        copy?.uri === `at://${did}/app.bsky.feed.post/${rkey}` && copy.cid
      );
      journal.copy = copy;
      await save();
      const repostValue = {
        $type: 'app.bsky.feed.repost',
        subject: copy,
        createdAt: journal.createdAt,
      };
      await intent('app.bsky.feed.repost', journal.repostRkey, repostValue);
      if (
        !(await client.getRecord!('app.bsky.feed.repost', journal.repostRkey))
      ) {
        try {
          await client.createRecord!(
            'app.bsky.feed.repost',
            journal.repostRkey,
            repostValue
          );
        } finally {
          await observeRecords();
        }
      }
      if (!journal.hostedNativeBaseline) {
        assert(!journal.deliveryIntent && !(await row()));
        assert(!(await ownedWorker()));
        const browser = await chromium.launch({ headless: true });
        try {
          const page = await browser.newPage({
            viewport: { width: 1440, height: 1000 },
            colorScheme: 'light',
            reducedMotion: 'reduce',
          });
          await until(
            'hosted native-only repost before Webmention delivery',
            async () => {
              await page.goto(TARGET, { waitUntil: 'networkidle' });
              const matching = page.locator('.u-repost').filter({
                has: page.locator(`a.u-url[href="${profile}"]`),
              });
              if ((await matching.count()) !== 1) return false;
              const source = await matching
                .locator('data.u-url')
                .getAttribute('value');
              if (source !== profile) return false;
              assert(!(await row()));
              await page.evaluate(() => globalThis.document.fonts.ready);
              const screenshot = resolve(output, 'native-only-1440-light.png');
              await page.screenshot({ path: screenshot, fullPage: true });
              journal.hostedNativeBaseline = {
                observedAt: new Date().toISOString(),
                matchingReposts: 1,
                source,
                html: await matching.evaluate((element) => element.outerHTML),
                incomingMentionAbsent: true,
                sourceWorkerNotDeployed: !journal.workerIntent,
                screenshot,
              };
              await save();
              return true;
            },
            360
          );
        } finally {
          await browser.close();
        }
      }
      if (!journal.foreignMentionHash) {
        assert(!(await row()));
        journal.foreignMentionHash = await foreignMentions();
        await save();
      }
      if (!(await ownedWorker())) {
        journal.workerIntent = true;
        await save();
        const form = new FormData();
        form.set(
          'metadata',
          JSON.stringify({
            main_module: 'index.mjs',
            compatibility_date: '2026-10-09',
          })
        );
        form.set(
          'index.mjs',
          new Blob([journal.workerSource], {
            type: 'application/javascript+module',
          }),
          'index.mjs'
        );
        const upload = await cf(`workers/scripts/${journal.workerName}`, {
          method: 'PUT',
          body: form,
        });
        assert(upload.ok);
      }
      const enabled = await cf(
        `workers/scripts/${journal.workerName}/subdomain`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: true, previews_enabled: false }),
        }
      );
      assert(enabled.ok);
      assert(await ownedWorker());
      await until(
        'public owned repost source',
        async () => {
          const result = await http(journal.source).catch(() => undefined);
          if (!result) return false;
          if (result.status !== 200) {
            await result.body?.cancel();
            return false;
          }
          assert.equal(
            result.headers.get('x-acceptance-owner'),
            journal.marker
          );
          assert((await result.text()).includes(`href="${profile}"`));
          return true;
        },
        60
      );
      if (!journal.deliveryIntent) {
        journal.deliveryIntent = new Date().toISOString();
        await save();
      }
      const existingMention = await row();
      if (!existingMention || !existingMention.value.is_verified) {
        if (existingMention) {
          await remember(existingMention);
          journal.redeliveryIntents ??= [];
          assert(journal.redeliveryIntents.length < 3);
          journal.redeliveryIntents.push(new Date().toISOString());
          await save();
        }
        const delivered = await http(`${ORIGIN}/api/webmention`, {
          method: 'POST',
          body: new URLSearchParams({ source: journal.source, target: TARGET }),
        });
        await delivered.arrayBuffer();
        assert.equal(delivered.status, 202);
      }
      await until('real receiver verification', async () => {
        const received = await row();
        if (!received) return false;
        await remember(received);
        return received.value.is_verified === true;
      });
      const verified = await row();
      assert(verified);
      await remember(verified);
      if (!verified.value.is_approved) {
        journal.approvalIntent = true;
        await save();
        await moderate('approve');
      }
      const approved = await row();
      assert(
        approved && approved.value.is_approved && !approved.value.is_deleted
      );
      await remember(approved);
      return;
    }
    assert(journal.copy);
    assert(
      journal.hostedNativeBaseline?.matchingReposts === 1 &&
        journal.hostedNativeBaseline.incomingMentionAbsent === true &&
        journal.hostedNativeBaseline.source === profile,
      'The final overlap proof requires the retained native-only hosted baseline.'
    );
    const received = await row();
    assert(received);
    assertOwnedMention(received);
    assert(
      received.value.is_verified &&
        received.value.is_approved &&
        !received.value.is_deleted
    );
    const { fetchBlueskyResponses } = await import('../lib/atproto/responses');
    let atmosphere:
      | Awaited<ReturnType<typeof fetchBlueskyResponses>>
      | undefined;
    await until('independent native repost AppView importer', async () => {
      atmosphere = await fetchBlueskyResponses(loaded.writing);
      return (
        !atmosphere.incomplete &&
        atmosphere.groups.reposts.some(
          (repost) => repost.author.url === profile
        )
      );
    });
    assert(atmosphere && !atmosphere.incomplete);
    const observations = await db.query(
      'SELECT to_jsonb(o) AS value, to_jsonb(o)::text AS canonical FROM atproto_response_observations o WHERE copy_uri=$1 AND actor_did=$2',
      [journal.copy.uri, did]
    );
    assert.equal(observations.rows.length, 1);
    journal.observations = observations.rows as Snapshot[];
    await save();
    const revision = await http(`${ORIGIN}/api/indieweb/revision`);
    assert.equal(revision.status, 200);
    journal.runtimeRevision = (await revision.json()).sha;
    if (!/^[a-f0-9]{40}$/.test(journal.runtimeRevision!)) {
      assert(
        journal.runtimeRevision === '' || journal.runtimeRevision === null
      );
      assert(
        values['deployment-receipt'],
        'Archive proof requires the actual READY deployment receipt.'
      );
      const deployed = JSON.parse(
        await readFile(resolve(values['deployment-receipt']), 'utf8')
      );
      assert(
        deployed.name === 'indieweb-acceptance' &&
          deployed.readyState === 'READY' &&
          deployed.target === 'production'
      );
      assert(
        /^dpl_[a-zA-Z0-9]+$/.test(deployed.id) &&
          deployed.aliases.includes(new URL(ORIGIN).hostname)
      );
      const base = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
      }).trim();
      execFileSync(
        'git',
        [
          'diff',
          '--exit-code',
          'HEAD',
          '--',
          'app',
          'components',
          'lib',
          'next.config.ts',
          'package.json',
          'pnpm-lock.yaml',
        ],
        { cwd: root, stdio: 'pipe' }
      );
      const nonce = (await sourceOriginal()).original.match(
        /Fixture identifier: ([a-f0-9-]+)/
      )[1];
      const immutable = execFileSync(
        'vercel',
        [
          'curl',
          `/writings/${SLUG}`,
          '--deployment',
          deployed.id,
          '--scope',
          'williecubed-projects',
          '--',
          '--fail',
          '--silent',
          '--show-error',
          '--max-time',
          '30',
        ],
        {
          cwd: root,
          encoding: 'utf8',
          maxBuffer: 4 * 1024 * 1024,
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );
      assert(immutable.includes(nonce));
      journal.archiveDeployment = {
        id: deployed.id,
        url: deployed.url,
        runtimeCodeBase: base,
        runtimeCodeDiffEmpty: true,
        revisionEndpoint: journal.runtimeRevision,
        limitation:
          'The CLI archive exposes no Git SHA. The actual READY deployment, canonical alias, unique fixture nonce and unchanged runtime source identify this proof.',
      };
      await save();
    }
    const browser = await chromium.launch({ headless: true });
    try {
      for (const width of [1440, 390])
        for (const theme of ['light', 'dark']) {
          const context = await browser.newContext({
            viewport: { width, height: width === 390 ? 844 : 1000 },
            reducedMotion: 'reduce',
            colorScheme: theme as 'light' | 'dark',
          });
          try {
            await context.addInitScript(
              (chosen) => localStorage.setItem('theme', chosen),
              theme
            );
            const page = await context.newPage();
            await until('hosted merged repost cache refresh', async () => {
              await page.goto(TARGET, {
                waitUntil: 'networkidle',
                timeout: 60000,
              });
              const reposts = page
                .locator('.u-repost')
                .filter({ has: page.locator(`a[href="${profile}"]`) });
              const count = await reposts.count();
              assert(
                count <= 1,
                'The hosted page renders duplicate reposts for the same actor.'
              );
              return count === 1;
            });
            await page.waitForFunction(
              (chosen) =>
                document.documentElement.dataset.theme === chosen &&
                getComputedStyle(document.documentElement).colorScheme ===
                  chosen,
              theme
            );
            await page.evaluate(async () => {
              await document.fonts.ready;
            });
            const merged = page
              .locator('.u-repost')
              .filter({ has: page.locator(`a[href="${profile}"]`) });
            await merged.scrollIntoViewIfNeeded();
            const retained = await merged.evaluate((node) => ({
              html: node.outerHTML,
              source: node.querySelector('data.u-url')?.getAttribute('value'),
            }));
            assert.equal(
              retained.source,
              journal.source,
              'The merged repost must retain its IndieWeb source link.'
            );
            assert(
              await page.evaluate(
                () =>
                  document.documentElement.scrollWidth <= window.innerWidth + 1
              )
            );
            const screenshot = resolve(output, `overlap-${width}-${theme}.png`);
            await page.screenshot({ path: screenshot, fullPage: true });
            if (!journal.screenshots.includes(screenshot))
              journal.screenshots.push(screenshot);
            journal.evidence = {
              observedAt: new Date().toISOString(),
              target: TARGET,
              authorUrl: profile,
              source: journal.source,
              copy: journal.copy,
              hostedNativeBaseline: journal.hostedNativeBaseline,
              independentVerifiedMention: received,
              independentAtmosphereReposts: atmosphere.groups.reposts,
              hostedMatchingReposts: 1,
              retained,
              runtimeRevision: journal.runtimeRevision,
              fixtureSourceSha256: (await sourceOriginal()).sha256,
            };
            await save();
          } finally {
            await context.close();
          }
        }
    } finally {
      await browser.close();
    }
  } finally {
    await client.close();
    await session.logout();
    await db.end();
  }
}
try {
  await run();
  console.log(`Overlap ${operation} completed. Private journal: ${path}`);
} catch (error) {
  await writeFile(
    resolve(output, `overlap-${operation}-failure-${Date.now()}.json`),
    JSON.stringify(
      {
        operation,
        checkedAt: new Date().toISOString(),
        error:
          error instanceof Error ? error.message : 'Unknown operation failure',
        resume: `Run ${operation} again with the same --env and --output.`,
      },
      null,
      2
    ) + '\n',
    { mode: 0o600 }
  );
  throw error;
}
