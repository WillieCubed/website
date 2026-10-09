import { BlobNotFoundError, del, head, list } from '@vercel/blob';
import { createPool } from '@vercel/postgres';
import matter from 'gray-matter';
import { mf2 } from 'microformats-parser';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { parseArgs, parseEnv, promisify } from 'node:util';
import { type DefaultTreeAdapterMap, parse } from 'parse5';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  generateAtomFeed,
  generateRssFeed,
  writingToFeedItem,
} from '../lib/feeds/index';
import {
  discoverAuthor,
  fetchAuthorPage,
  findEntry,
} from '../lib/indieweb/authorship';
import { sanitizeCommentHtml } from '../lib/indieweb/comment-content';
import { micropubSource } from '../lib/indieweb/micropub-document';
import { fetchPublicBytes } from '../lib/indieweb/public-fetch';
import {
  discoverWebmentionEndpoint,
  webmentionTargetsForWriting,
} from '../lib/indieweb/send-webmention';
import { absoluteUrl } from '../lib/site';
import { plainTextHtml } from '../lib/writings/content';
import type { WritingData } from '../lib/writings/types';

const { values } = parseArgs({
  options: {
    output: { type: 'string' },
    'live-media': { type: 'boolean', default: false },
    'cleanup-only': { type: 'boolean', default: false },
    'env-file': { type: 'string', default: '.env.acceptance-indieweb.local' },
    'acceptance-cwd': {
      type: 'string',
      default:
        '/Users/williecubed/.codex/worktrees/publishing-verification/website',
    },
  },
});

interface LiveMediaJournal {
  startedAt: string;
  origin: string;
  projectId: string;
  branch: string;
  nonce: string;
  clientId: string;
  slug: string;
  permalink: string;
  code?: string;
  token?: { access_token: string; refresh_token: string };
  created?: boolean;
  uploads: {
    url: string;
    filename: string;
    mimeType: string;
    uploadedFile: string;
  }[];
  pendingUploads: { filename: string; prefix: string }[];
  plannedProperties?: Record<string, unknown[]>;
  sourceWasAbsent?: boolean;
  createCommit?: string;
  originalSourceSha256?: string;
  outgoingContentHash?: string;
  cleanup?: boolean;
  sourceAbsent?: boolean;
  revocationIntent?: boolean;
  grantRevoked?: boolean;
  removedBlobs?: string[];
  failure?: { phase: string; message: string };
}

async function liveMediaProof() {
  const origin = 'https://indieweb-acceptance.vercel.app';
  const projectId = 'prj_rurUFlQ4YKYKoMxGCaAyL6ASijHm';
  const branch = 'codex/publishing-compatibility-acceptance-20261008';
  const blobHost = 'b0dgluyotqkpvpbg.public.blob.vercel-storage.com';
  const blobStore = 'store_b0dGLUyoTQkPVPBg';
  assert(
    values.output,
    'Live media proof requires --output inside .playwright-mcp.'
  );
  const output = resolve(values.output);
  const inside = relative(resolve('.playwright-mcp'), output);
  assert(inside && !inside.startsWith('..') && !inside.startsWith('/'));
  const directory = dirname(output);
  const journalPath = resolve(directory, 'private-ownership.json');
  const manifestPath = resolve(directory, 'private-feed-manifest.json');
  const context = resolve(directory, 'private-vercel');
  const env = parseEnv(await readFile(resolve(values['env-file']!), 'utf8'));
  assert.equal(env.NEXT_PUBLIC_SITE_ORIGIN, origin);
  assert(env.POSTGRES_URL);
  assert.equal(
    new URL(env.POSTGRES_URL).hostname,
    'ep-winter-wind-b5iiaxe7-pooler.c-7.us-east-2.aws.neon.tech'
  );
  assert(env.INDIEAUTH_TOTP_SECRET);
  const totpSecret = env.INDIEAUTH_TOTP_SECRET;
  const linkedProject = JSON.parse(
    await readFile(
      resolve(values['acceptance-cwd']!, '.vercel/project.json'),
      'utf8'
    )
  );
  assert.equal(linkedProject.projectId, projectId);
  const cli = promisify(execFile);
  async function run(
    args: string[],
    commandEnv = process.env,
    timeout = 60000
  ) {
    try {
      return (
        await cli('pnpm', args, {
          env: commandEnv,
          timeout,
          maxBuffer: 4 * 1024 * 1024,
        })
      ).stdout;
    } catch {
      throw new Error(
        'An acceptance CLI operation failed; its credential-bearing output was withheld.'
      );
    }
  }
  let journal: LiveMediaJournal;
  if (values['cleanup-only'])
    journal = JSON.parse(await readFile(journalPath, 'utf8'));
  else {
    await mkdir(directory, { recursive: false, mode: 0o700 });
    const nonce = randomBytes(12).toString('hex');
    const slug = `indieweb-media-proof-${nonce}`;
    journal = {
      startedAt: new Date().toISOString(),
      origin,
      projectId,
      branch,
      nonce,
      clientId: `http://localhost:8765/${nonce}/`,
      slug,
      permalink: `${origin}/writings/${slug}`,
      uploads: [],
      pendingUploads: [],
    };
  }
  assert.equal(journal.origin, origin);
  assert.equal(new Date(journal.startedAt).toISOString(), journal.startedAt);
  assert.equal(journal.projectId, projectId);
  assert.equal(journal.branch, branch);
  assert.match(journal.nonce, /^[a-f0-9]{24}$/);
  assert.equal(journal.slug, `indieweb-media-proof-${journal.nonce}`);
  assert.equal(journal.permalink, `${origin}/writings/${journal.slug}`);
  assert.equal(journal.clientId, `http://localhost:8765/${journal.nonce}/`);
  const save = () =>
    writeFile(journalPath, JSON.stringify(journal, null, 2), { mode: 0o600 });
  await save();
  await mkdir(resolve(context, '.vercel'), { recursive: true, mode: 0o700 });
  await writeFile(
    resolve(context, '.vercel/project.json'),
    JSON.stringify(linkedProject),
    { mode: 0o600 }
  );
  const pulledPath = resolve(context, 'private.env');
  await run([
    'exec',
    'vercel',
    'env',
    'pull',
    pulledPath,
    '--environment',
    'production',
    '--yes',
    '--cwd',
    context,
    '--scope',
    'williecubed-projects',
  ]);
  await chmod(pulledPath, 0o600);
  const pulled = parseEnv(await readFile(pulledPath, 'utf8'));
  assert.equal(pulled.MICROPUB_GITHUB_BRANCH, branch);
  const oidc = pulled.VERCEL_OIDC_TOKEN;
  assert(oidc);
  const claims = JSON.parse(
    Buffer.from(oidc.split('.')[1], 'base64url').toString()
  );
  assert.equal(claims.project_id, projectId);
  assert(claims.exp * 1000 > Date.now() + 15 * 60 * 1000);
  const blobEnv = {
    ...process.env,
    BLOB_STORE_ID: blobStore,
    VERCEL_OIDC_TOKEN: oidc,
  };
  process.env.BLOB_STORE_ID = blobEnv.BLOB_STORE_ID;
  process.env.VERCEL_OIDC_TOKEN = blobEnv.VERCEL_OIDC_TOKEN;
  const filenamePattern = new RegExp(
    `^${journal.nonce}-(?:image\\.png|audio\\.ogg|video\\.mp4|pdf\\.pdf)$`
  );
  for (const pending of journal.pendingUploads) {
    assert(filenamePattern.test(pending.filename));
    assert(
      new RegExp(
        `^media/\\d{4}/(?:0[1-9]|1[0-2])/${pending.filename.replace(/\.[^.]+$/, '')}$`
      ).test(pending.prefix)
    );
  }
  function ownedBlobUrl(address: string) {
    const url = new URL(address);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, blobHost);
    assert(!url.username && !url.password && !url.search && !url.hash);
    assert(
      new RegExp(
        `^/media/\\d{4}/(?:0[1-9]|1[0-2])/${journal.nonce}-(?:image-[a-zA-Z0-9]+\\.png|audio-[a-zA-Z0-9]+\\.ogg|video-[a-zA-Z0-9]+\\.mp4|pdf-[a-zA-Z0-9]+\\.pdf)$`
      ).test(url.pathname)
    );
    return url;
  }
  for (const uploaded of journal.uploads) {
    assert(filenamePattern.test(uploaded.filename));
    ownedBlobUrl(uploaded.url);
  }
  const hash = (value: string) =>
    createHash('sha256').update(value).digest('hex');
  type LiveReceipt = {
    at: string;
    kind: string;
    origin: string;
    checks: { name: string; evidence: unknown }[];
    cleanup?: unknown;
    result?: string;
    failure?: string;
  };
  const receipt: LiveReceipt = values['cleanup-only']
    ? JSON.parse(await readFile(output, 'utf8'))
    : {
        at: journal.startedAt,
        kind: 'Actual isolated normal S256 consent, Micropub uploads and publishing, independent deployed JSON Feed/MF2/media SHA256 checks.',
        origin,
        checks: [],
      };
  assert.equal(receipt.at, journal.startedAt);
  assert.equal(receipt.origin, origin);
  assert(Array.isArray(receipt.checks));
  await writeFile(output, JSON.stringify(receipt, null, 2), { mode: 0o600 });
  const record = async (name: string, evidence: unknown) => {
    receipt.checks.push({ name, evidence });
    await writeFile(output, JSON.stringify(receipt, null, 2), { mode: 0o600 });
    console.log(`PASS ${name}`);
  };
  function verifyPlannedSource(source: {
    properties: Record<string, unknown>;
  }) {
    assert(journal.sourceWasAbsent && journal.plannedProperties);
    for (const [property, expected] of Object.entries(
      journal.plannedProperties
    )) {
      const normalizedExpected =
        property === 'content'
          ? expected.map((value) =>
              value &&
              typeof value === 'object' &&
              'html' in value &&
              typeof value.html === 'string'
                ? { ...value, html: sanitizeCommentHtml(value.html, origin) }
                : value
            )
          : expected;
      assert.deepEqual(
        source.properties[property],
        normalizedExpected,
        `The owned ${property} changed; cleanup refused.`
      );
    }
  }
  async function sourceHash(ref: string) {
    let stdout: string;
    try {
      stdout = (
        await cli(
          'gh',
          [
            'api',
            `repos/WillieCubed/website/contents/content/writings/${journal.slug}.mdx?ref=${encodeURIComponent(ref)}`,
          ],
          { timeout: 30000, maxBuffer: 1024 * 1024 }
        )
      ).stdout;
    } catch {
      throw new Error('The exact owned GitHub source could not be read.');
    }
    const source = JSON.parse(stdout);
    assert.equal(source.path, `content/writings/${journal.slug}.mdx`);
    assert.equal(source.type, 'file');
    const bytes = Buffer.from(source.content, 'base64');
    verifyPlannedSource(micropubSource(bytes.toString(), journal.permalink));
    if (ref === journal.createCommit) {
      const { content } = matter(bytes.toString(), {});
      const currentTargets = webmentionTargetsForWriting(
        { slug: journal.slug, people: [] },
        content
      );
      assert(
        currentTargets.every((target) =>
          journal.uploads.some((item) => item.url === target)
        )
      );
      const contentHash = hash(JSON.stringify({ content, currentTargets }));
      if (journal.outgoingContentHash)
        assert.equal(journal.outgoingContentHash, contentHash);
      journal.outgoingContentHash = contentHash;
      await save();
    }
    return createHash('sha256').update(bytes).digest('hex');
  }
  async function drainNotifications() {
    const runs = async () =>
      JSON.parse(
        await run([
          'exec',
          'gh',
          'run',
          'list',
          '--repo',
          'WillieCubed/website',
          '--branch',
          branch,
          '--workflow',
          'indieweb-publish.yml',
          '--limit',
          '100',
          '--json',
          'databaseId,status,updatedAt',
        ])
      ) as { databaseId: number; status: string; updatedAt: string }[];
    let terminal: Awaited<ReturnType<typeof runs>> = [];
    await until('notification jobs to finish', async () => {
      terminal = await runs();
      return terminal.every((job) => job.status === 'completed');
    });
    // GitHub completion can precede the invoked handler's 60-second deadline.
    for (let remaining = 70000; remaining > 0; remaining -= 10000)
      await setTimeout(10000);
    assert.deepEqual(
      await runs(),
      terminal,
      'Notification activity changed during cleanup; retry after it drains.'
    );
  }
  async function request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (journal.token)
      headers.set('Authorization', `Bearer ${journal.token.access_token}`);
    const send = () =>
      fetch(origin + path, {
        ...init,
        headers,
        signal: AbortSignal.timeout(30000),
      });
    const response = await send();
    if (response.status !== 401 || !journal.token) return response;
    const refresh = await fetch(origin + '/indieauth/token', {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: journal.token.refresh_token,
        client_id: journal.clientId,
      }),
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(
      refresh.status,
      200,
      'The owned grant cannot refresh for cleanup.'
    );
    journal.token = await refresh.json();
    assert(journal.token?.access_token && journal.token.refresh_token);
    await save();
    headers.set('Authorization', `Bearer ${journal.token.access_token}`);
    return send();
  }
  async function mutate(body: unknown) {
    const response = await request('/micropub', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert(
      response.ok,
      `The owned Micropub mutation returned ${response.status}.`
    );
    return response;
  }
  async function until(name: string, operation: () => Promise<boolean>) {
    const deadline = Date.now() + 12 * 60 * 1000;
    while (Date.now() < deadline) {
      if (await operation()) return;
      await setTimeout(5000);
    }
    throw new Error(`The deployed ${name} did not converge within12minutes.`);
  }
  async function cleanup() {
    const steps: Record<string, unknown> = {};
    if (journal.token && !journal.sourceAbsent) {
      const source = await request(
        '/micropub?' +
          new URLSearchParams({ q: 'source', url: journal.permalink })
      );
      if (source.status === 200) {
        const sourceData = await source.json();
        verifyPlannedSource(sourceData);
        if (!journal.originalSourceSha256) {
          assert(
            journal.createCommit && /^[a-f0-9]{40}$/.test(journal.createCommit),
            'Creation ownership is ambiguous; cleanup refused without the original commit.'
          );
          journal.originalSourceSha256 = await sourceHash(journal.createCommit);
          await save();
        }
        const currentHash = await sourceHash(branch);
        assert.equal(
          currentHash,
          journal.originalSourceSha256,
          'The exact owned source changed; cleanup refused.'
        );
        await mutate({ action: 'delete', url: journal.permalink });
      } else {
        assert.equal(source.status, 400);
        const absent = await source.json();
        assert.equal(absent.error, 'invalid_request');
        assert.equal(
          absent.error_description,
          'The post with the requested URL was not found.'
        );
      }
      await until('source cleanup', async () => {
        const page = await fetch(journal.permalink, {
          signal: AbortSignal.timeout(10000),
        });
        if (page.status !== 404) return false;
        for (const path of [
          '/writings',
          '/writings/feed.xml',
          '/writings/feed/atom',
          '/writings/feed/json',
        ]) {
          const response = await fetch(origin + path, {
            signal: AbortSignal.timeout(10000),
          });
          if (
            response.status !== 200 ||
            (await response.text()).includes(journal.slug)
          )
            return false;
        }
        return true;
      });
      journal.sourceAbsent = true;
      await save();
    }
    steps.sourceAndFeedsAbsent = journal.sourceAbsent === true;
    if (journal.token && !journal.revocationIntent) {
      journal.revocationIntent = true;
      await save();
      for (const token of [
        journal.token.access_token,
        journal.token.refresh_token,
      ]) {
        const response = await fetch(origin + '/indieauth/revoke', {
          method: 'POST',
          body: new URLSearchParams({ token }),
          signal: AbortSignal.timeout(10000),
        });
        assert.equal(response.status, 200);
      }
      journal.grantRevoked = true;
      await save();
    }
    steps.normalRevocation = journal.grantRevoked === true;
    if (journal.createCommit && !journal.outgoingContentHash) {
      const originalHash = await sourceHash(journal.createCommit);
      assert.equal(originalHash, journal.originalSourceSha256);
    }
    await drainNotifications();
    const db = createPool({ connectionString: env.POSTGRES_URL, max: 1 });
    try {
      await db.query('BEGIN');
      const outgoing = (
        await db.query(
          'SELECT id,source_url,target_url,post_slug,content_hash FROM outgoing_webmentions WHERE source_url=$1 OR post_slug=$2 FOR UPDATE',
          [journal.permalink, journal.slug]
        )
      ).rows;
      for (const row of outgoing) {
        assert.equal(row.source_url, journal.permalink);
        assert.equal(row.post_slug, journal.slug);
        assert(journal.uploads.some((item) => item.url === row.target_url));
        assert(
          row.content_hash === hash(`unpublished:${journal.permalink}`) ||
            row.content_hash === journal.outgoingContentHash
        );
        const deleted = await db.query(
          'DELETE FROM outgoing_webmentions WHERE id=$1 AND source_url=$2 AND post_slug=$3 AND target_url=$4 AND content_hash=$5 RETURNING id',
          [
            row.id,
            journal.permalink,
            journal.slug,
            row.target_url,
            row.content_hash,
          ]
        );
        assert.equal(deleted.rowCount, 1);
      }
      assert.equal(
        Number(
          (
            await db.query(
              'SELECT count(*) AS n FROM outgoing_webmentions WHERE source_url=$1 OR post_slug=$2',
              [journal.permalink, journal.slug]
            )
          ).rows[0].n
        ),
        0
      );
      steps.exactOwnedOutgoingRowsAbsent = true;
      const ownedCodes = (
        await db.query(
          'SELECT code_hash,me,scope FROM indieauth_codes WHERE client_id=$1',
          [journal.clientId]
        )
      ).rows;
      for (const code of ownedCodes) {
        assert.equal(code.me, origin + '/');
        assert.equal(code.scope, 'profile create media delete');
      }
      const codeHashes = ownedCodes.map((code) => code.code_hash);
      if (journal.code && codeHashes.length)
        assert(codeHashes.includes(hash(journal.code)));
      const families = (
        await db.query(
          'SELECT family_id FROM indieauth_refresh_families WHERE client_id=$1 AND authorization_code_hash=ANY($2::text[])',
          [journal.clientId, codeHashes]
        )
      ).rows.map((row) => row.family_id);
      await db.query(
        'DELETE FROM indieauth_tokens WHERE refresh_family_id=ANY($1::text[])',
        [families]
      );
      await db.query(
        'DELETE FROM indieauth_refresh_tokens WHERE family_id=ANY($1::text[])',
        [families]
      );
      await db.query(
        'DELETE FROM indieauth_refresh_families WHERE family_id=ANY($1::text[]) AND client_id=$2',
        [families, journal.clientId]
      );
      if (codeHashes.length)
        await db.query(
          'DELETE FROM indieauth_codes WHERE code_hash=ANY($1::text[]) AND client_id=$2',
          [codeHashes, journal.clientId]
        );
      const archive = (
        await db.query(
          'SELECT mutation_key,slug,source FROM micropub_deleted_writings WHERE permalink=$1',
          [journal.permalink]
        )
      ).rows;
      for (const row of archive) {
        assert.equal(row.slug, journal.slug);
        assert.equal(JSON.parse(row.mutation_key)[1], branch);
        verifyPlannedSource(micropubSource(row.source, journal.permalink));
        assert.equal(
          createHash('sha256').update(row.source).digest('hex'),
          journal.originalSourceSha256,
          'The owned archive changed; cleanup refused.'
        );
        await db.query(
          'DELETE FROM micropub_deleted_writings WHERE mutation_key=$1 AND permalink=$2',
          [row.mutation_key, journal.permalink]
        );
      }
      const remaining = (
        await db.query(
          'SELECT (SELECT count(*) FROM indieauth_tokens WHERE client_id=$1) + (SELECT count(*) FROM indieauth_refresh_families WHERE client_id=$1) + (SELECT count(*) FROM indieauth_codes WHERE client_id=$1) + (SELECT count(*) FROM micropub_deleted_writings WHERE permalink=$2) AS n',
          [journal.clientId, journal.permalink]
        )
      ).rows[0].n;
      assert.equal(Number(remaining), 0);
      await db.query('COMMIT');
      steps.exactOwnedGrantAndArchiveRowsAbsent = true;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      await db.end();
    }
    for (const { filename, prefix } of journal.pendingUploads) {
      let cursor: string | undefined;
      do {
        const listing = await list({ prefix, limit: 100, cursor });
        for (const blob of listing.blobs) {
          const url = ownedBlobUrl(blob.url);
          assert(url.pathname.startsWith('/' + prefix));
          if (!journal.uploads.some((item) => item.url === url.href))
            journal.uploads.push({
              url: url.href,
              filename,
              mimeType: '',
              uploadedFile: '',
            });
        }
        assert(!listing.hasMore || listing.cursor);
        cursor = listing.hasMore ? listing.cursor : undefined;
      } while (cursor);
    }
    await save();
    for (const item of journal.uploads) {
      ownedBlobUrl(item.url);
      if (journal.removedBlobs?.includes(item.url)) continue;
      const expected = await readFile(resolve(directory, item.filename));
      try {
        const metadata = await head(item.url);
        const actual = await fetchPublicBytes(item.url, 4 * 1024 * 1024, 20000);
        assert(actual);
        assert.equal(
          createHash('sha256').update(actual.bytes).digest('hex'),
          createHash('sha256').update(expected).digest('hex'),
          'The owned blob changed; cleanup refused.'
        );
        await del(item.url, { ifMatch: metadata.etag });
      } catch (error) {
        if (!(error instanceof BlobNotFoundError)) throw error;
      }
      await until(
        'owned blob cleanup',
        async () =>
          (
            await fetch(item.url + '?cleanup=' + Date.now(), {
              signal: AbortSignal.timeout(10000),
            })
          ).status === 404
      );
      journal.removedBlobs ??= [];
      journal.removedBlobs.push(item.url);
      await save();
    }
    steps.exactOwnedBlobsAbsent = journal.uploads.map((item) => ({
      url: item.url,
      status: 404,
    }));
    journal.cleanup = true;
    await save();
    receipt.cleanup = steps;
    await writeFile(output, JSON.stringify(receipt, null, 2), { mode: 0o600 });
    await rm(context, { recursive: true, force: true });
    await rm(manifestPath, { force: true });
    await rm(journalPath);
  }
  if (values['cleanup-only']) {
    await cleanup();
    console.log(`Owned cleanup receipt: ${output}`);
    return;
  }
  let phase = 'normal authorization';
  try {
    const metadataResponse = await fetch(
      origin + '/.well-known/oauth-authorization-server'
    );
    assert.equal(metadataResponse.status, 200);
    const metadata = await metadataResponse.json();
    for (const endpoint of [
      'authorization_endpoint',
      'token_endpoint',
      'userinfo_endpoint',
    ])
      assert.equal(new URL(metadata[endpoint]).origin, origin);
    const verifier = randomBytes(48).toString('base64url');
    const state = randomBytes(24).toString('base64url');
    const redirect = journal.clientId + 'callback';
    const auth = new URL(metadata.authorization_endpoint);
    auth.search = new URLSearchParams({
      response_type: 'code',
      client_id: journal.clientId,
      redirect_uri: redirect,
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      scope: 'profile create media delete',
    }).toString();
    const authorization = await fetch(auth, { redirect: 'manual' });
    const consentUrl = new URL(authorization.headers.get('location')!, origin);
    assert.equal(consentUrl.origin, origin);
    const consentPage = await fetch(consentUrl);
    assert.equal(consentPage.status, 200);
    const fields = new URLSearchParams();
    function inputs(node: DefaultTreeAdapterMap['node']) {
      if ('tagName' in node && node.tagName === 'input') {
        const attrs = Object.fromEntries(
          node.attrs.map((attr) => [attr.name, attr.value])
        );
        if (
          attrs.name &&
          (attrs.type === 'hidden' ||
            (attrs.type === 'checkbox' && 'checked' in attrs))
        )
          fields.append(attrs.name, attrs.value);
      }
      if ('childNodes' in node) node.childNodes.forEach(inputs);
    }
    inputs(parse(await consentPage.text()));
    function totp() {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      const bits = totpSecret
        .toUpperCase()
        .replace(/[\s=]/g, '')
        .split('')
        .map((char) => {
          assert(alphabet.includes(char));
          return alphabet.indexOf(char).toString(2).padStart(5, '0');
        })
        .join('');
      const key = Buffer.from(
        (bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2))
      );
      const counter = Buffer.alloc(8);
      counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
      const digest = createHmac('sha1', key).update(counter).digest();
      return String(
        (digest.readUInt32BE(digest[digest.length - 1] & 15) & 0x7fffffff) %
          1000000
      ).padStart(6, '0');
    }
    fields.set('decision', 'approve');
    fields.set('code', totp());
    const authorize = () =>
      fetch(origin + '/indieauth/consent', {
        method: 'POST',
        headers: { Origin: origin },
        body: fields,
        redirect: 'manual',
      });
    let consent = await authorize();
    if (consent.status === 401) {
      await setTimeout(31000);
      fields.set('code', totp());
      consent = await authorize();
    }
    assert.equal(consent.status, 303);
    const callback = new URL(consent.headers.get('location')!);
    assert.equal(callback.origin + callback.pathname, redirect);
    assert.equal(callback.searchParams.get('state'), state);
    assert.equal(callback.searchParams.get('iss'), metadata.issuer);
    journal.code = callback.searchParams.get('code')!;
    assert(journal.code);
    await save();
    const redemption = await fetch(metadata.token_endpoint, {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: journal.code,
        client_id: journal.clientId,
        redirect_uri: redirect,
        code_verifier: verifier,
      }),
    });
    assert.equal(redemption.status, 200);
    journal.token = await redemption.json();
    assert(journal.token?.access_token && journal.token.refresh_token);
    await save();
    const userinfo = await fetch(metadata.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${journal.token.access_token}` },
    });
    assert.equal(userinfo.status, 200);
    const profile = await userinfo.json();
    assert.equal(profile.url, origin + '/');
    await record('Normal S256/TOTP consent and scoped UserInfo', {
      authorizationStatus: 303,
      redemptionStatus: 200,
      userinfoStatus: 200,
    });
    for (const [kind, mimeType, source] of [
      ['image', 'image/png', 'public/apple-touch-icon.png'],
      [
        'audio',
        'audio/ogg',
        'https://media.w3.org/2010/07/bunny/04-Death_Becomes_Fur.oga',
      ],
      [
        'video',
        'video/mp4',
        'https://media.w3.org/2010/05/video/movie_300.mp4',
      ],
      [
        'pdf',
        'application/pdf',
        'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      ],
    ]) {
      phase = `${kind} upload`;
      const bytes = source.startsWith('https:')
        ? (await fetchPublicBytes(source, 4 * 1024 * 1024, 20000))?.bytes
        : await readFile(source);
      assert(bytes && bytes.length > 0 && bytes.length <= 4 * 1024 * 1024);
      const filename = `${journal.nonce}-${kind}.${kind === 'image' ? 'png' : kind === 'audio' ? 'ogg' : kind === 'video' ? 'mp4' : 'pdf'}`;
      await writeFile(resolve(directory, filename), bytes, { mode: 0o600 });
      const uploadDate = new Date().toISOString();
      journal.pendingUploads.push({
        filename,
        prefix: `media/${uploadDate.slice(0, 4)}/${uploadDate.slice(5, 7)}/${filename.replace(/\.[^.]+$/, '')}`,
      });
      await save();
      const form = new FormData();
      form.set(
        'file',
        new File([Buffer.from(bytes)], filename, { type: mimeType })
      );
      const upload = await request('/micropub/media', {
        method: 'POST',
        body: form,
      });
      assert.equal(upload.status, 201);
      const uploaded = await upload.json();
      ownedBlobUrl(uploaded.url);
      journal.uploads.push({
        url: uploaded.url,
        filename,
        mimeType,
        uploadedFile: filename,
      });
      journal.pendingUploads = journal.pendingUploads.filter(
        (pending) => pending.filename !== filename
      );
      await save();
      await record(`Actual ${kind} upload`, {
        status: 201,
        bytes: bytes.length,
        url: uploaded.url,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
    const media = (kind: string) =>
      journal.uploads.find((item) => item.filename.includes(`-${kind}.`))!;
    const published = new Date().toISOString();
    phase = 'Micropub create and deployed source';
    const title = `Media interoperability proof ${journal.nonce}`;
    const content = `<p>This isolated fixture verifies native media and one contained attachment.</p><img src="${media('image').url}" alt="The authored inline image"><audio><source src="${media('audio').url}"></audio><video src="${media('video').url}"></video><p><a href="${media('pdf').url}">Read the PDF</a></p>`;
    const absentSource = await request(
      '/micropub?' +
        new URLSearchParams({ q: 'source', url: journal.permalink })
    );
    assert.equal(absentSource.status, 400);
    const absentData = await absentSource.json();
    assert.equal(absentData.error, 'invalid_request');
    assert.equal(
      absentData.error_description,
      'The post with the requested URL was not found.'
    );
    journal.sourceWasAbsent = true;
    journal.plannedProperties = {
      'mp-slug': [journal.slug],
      name: [title],
      published: [published],
      content: [{ html: content }],
      photo: [
        { value: media('image').url, alt: 'The property image description' },
      ],
      audio: [media('audio').url],
      video: [media('video').url],
      attachment: [media('pdf').url],
    };
    await save();
    const created = await mutate({
      type: ['h-entry'],
      properties: journal.plannedProperties,
    });
    const createdData = await created.json();
    assert.match(createdData.commit, /^[a-f0-9]{40}$/);
    journal.createCommit = createdData.commit;
    await save();
    journal.originalSourceSha256 = await sourceHash(journal.createCommit!);
    journal.created = true;
    await save();
    const source = await request(
      '/micropub?' +
        new URLSearchParams({ q: 'source', url: journal.permalink })
    );
    assert.equal(source.status, 200);
    const stored = await source.json();
    assert.equal(stored.properties.published[0], published);
    const updated = stored.properties.updated?.[0];
    await until('published media fixture', async () => {
      const page = await fetch(journal.permalink, {
        signal: AbortSignal.timeout(10000),
      });
      if (page.status !== 200) return false;
      const html = await page.text();
      return html.includes(title) && html.includes(media('pdf').url);
    });
    await record('Actual hosted Micropub fixture', {
      url: journal.permalink,
      published,
      updated,
    });
    const manifest = {
      feedUrl: origin + '/writings/feed/json',
      itemUrl: journal.permalink,
      title,
      published,
      updated,
      author: { name: 'Willie Chalmers III', url: origin + '/' },
      attachments: journal.uploads.map((item) => ({
        url: item.url,
        mimeType: item.mimeType,
        uploadedFile: item.uploadedFile,
        jsonAttachment: !item.mimeType.startsWith('image/'),
      })),
    };
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), {
      mode: 0o600,
    });
    phase = 'independent deployed JSON Feed and byte hashes';
    await run([
      'exec',
      'tsx',
      'scripts/indieweb-feed-media-verify.mts',
      '--manifest',
      manifestPath,
      '--output',
      resolve(directory, 'feed-media-receipt.json'),
    ]);
    await record(
      'Independent actual JSON Feed/MF2 and exact four-upload SHA256 verification',
      JSON.parse(
        await readFile(resolve(directory, 'feed-media-receipt.json'), 'utf8')
      )
    );
    const page = await fetch(journal.permalink);
    phase = 'actual page native controls and MF2';
    const pageHtml = await page.text();
    const document = parse(pageHtml);
    const counts = { image: 0, audio: 0, video: 0, pdf: 0, autoplay: 0 };
    function inspect(node: DefaultTreeAdapterMap['node']) {
      if ('tagName' in node) {
        const attrs = Object.fromEntries(
          node.attrs.map((attr) => [attr.name, attr.value])
        );
        if (node.tagName === 'img' && attrs.src === media('image').url) {
          counts.image++;
          assert.equal(attrs.alt, 'The authored inline image');
        }
        if (node.tagName === 'audio') {
          counts.audio++;
          assert('controls' in attrs);
        }
        if (node.tagName === 'video' && attrs.src === media('video').url) {
          counts.video++;
          assert('controls' in attrs);
        }
        if (node.tagName === 'a' && attrs.href === media('pdf').url) {
          counts.pdf++;
          assert(attrs.class?.split(/\s+/).includes('u-attachment'));
        }
        if ('autoplay' in attrs) counts.autoplay++;
      }
      if ('childNodes' in node) node.childNodes.forEach(inspect);
    }
    inspect(document);
    assert.deepEqual(counts, {
      image: 1,
      audio: 1,
      video: 1,
      pdf: 1,
      autoplay: 0,
    });
    const entry = mf2(pageHtml, { baseUrl: journal.permalink }).items.find(
      (item) => item.type?.includes('h-entry')
    );
    assert(entry);
    for (const property of ['photo', 'audio', 'video', 'attachment'])
      assert.equal(entry.properties[property]?.length, 1);
    await record(
      'Actual page native media controls, MF2 and no duplicate media',
      counts
    );
    phase = 'actual native playback and contextual renders';
    await run(
      [
        'exec',
        'tsx',
        'scripts/indieweb-media-browser-verify.mts',
        '--manifest',
        manifestPath,
        '--output',
        resolve(directory, 'browser-media-receipt.json'),
      ],
      process.env,
      180000
    );
    const browserProof = JSON.parse(
      await readFile(resolve(directory, 'browser-media-receipt.json'), 'utf8')
    );
    assert.equal(browserProof.result, 'passed');
    assert.equal(browserProof.results.length, 4);
    assert.equal(browserProof.feeds.length, 2);
    await record(
      'Actual RSS/Atom parsing, native playback and full-page renders in both themes',
      browserProof
    );
    receipt.result = 'passed';
  } catch (error) {
    journal.failure = {
      phase,
      message: error instanceof Error ? error.message : 'Unknown failure',
    };
    await save();
    receipt.result = 'failed';
    receipt.failure = `${phase} failed. Exact diagnostics remain in the private ownership journal; credentials and HTTP bodies were withheld.`;
    process.exitCode = 1;
  } finally {
    try {
      await cleanup();
    } catch {
      receipt.cleanup = {
        result: 'failed',
        recovery:
          'Retained private ownership journal; rerun the same command with --cleanup-only.',
      };
      process.exitCode = 1;
    }
    await writeFile(output, JSON.stringify(receipt, null, 2), { mode: 0o600 });
  }
  console.log(`Live media receipt: ${output}`);
}

if (values['live-media'] || values['cleanup-only']) {
  try {
    await liveMediaProof();
  } catch {
    console.error(
      'The isolated media operation failed. Private ownership and proof files remain available for recovery; raw diagnostics were withheld.'
    );
    process.exitCode = 1;
  }
  process.exit(process.exitCode ?? 0);
}
const report: {
  startedAt: string;
  finishedAt?: string;
  evidenceKind: string;
  checks: {
    name: string;
    status: 'passed' | 'failed';
    evidence?: unknown;
    error?: string;
  }[];
} = {
  startedAt: new Date().toISOString(),
  evidenceKind:
    'Live independent fixture fetches and validation of current component/feed output. No post, PDS record, Webmention, token, or stored media is created.',
  checks: [],
};

async function check(name: string, run: () => Promise<unknown>) {
  try {
    const evidence = await run();
    report.checks.push({ name, status: 'passed', evidence });
    console.log(`PASS ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.checks.push({ name, status: 'failed', error: message });
    console.error(`FAIL ${name}: ${message}`);
  }
}

const authors = [
  { name: 'William Shakespeare' },
  {
    name: 'Homer',
    url: 'https://en.wikiquote.org/wiki/Homer',
    photo: 'https://authorship.rocks/images/homer.jpg',
  },
  { name: 'Patañjali', url: 'https://authorship.rocks/test/3/about-patanjali' },
  {
    name: 'Virginia Woolf',
    url: 'https://authorship.rocks/test/4/about-virginia-woolf',
    photo: 'https://authorship.rocks/images/virginia-woolf.jpg',
  },
  {
    name: 'Basho',
    url: 'https://authorship.rocks/test/5/about-basho',
    photo: 'https://authorship.rocks/images/basho.jpg',
  },
];
for (const [index, expected] of authors.entries()) {
  await check(`Authorship Rocks ${index + 1}`, async () => {
    const url = `https://authorship.rocks/test/${index + 1}`;
    const page = await fetchAuthorPage(url);
    assert.ok(
      page,
      'The actual public-address fetch guard could not retrieve the fixture.'
    );
    const document = mf2(page.html, { baseUrl: page.url });
    const entry = findEntry(document.items);
    assert.ok(entry, 'The independent fixture contains no h-entry.');
    const actual = await discoverAuthor(document, entry, page.url);
    assert.deepEqual(actual, expected);
    return { url, actual };
  });
}

for (let index = 1; index <= 23; index++) {
  await check(`Webmention Rocks discovery ${index}`, async () => {
    const url = `https://webmention.rocks/test/${index}${index === 23 ? '/page' : ''}`;
    const endpoint = await discoverWebmentionEndpoint(url);
    assert.ok(endpoint, 'No endpoint was discovered from the live fixture.');
    const parsed = new URL(endpoint);
    assert.equal(parsed.origin, 'https://webmention.rocks');
    if (index === 15) assert.equal(parsed.pathname, '/test/15');
    else if (index === 23)
      assert.match(
        parsed.pathname,
        /^\/test\/23\/page\/webmention-endpoint\/[A-Za-z0-9]+$/
      );
    else assert.equal(parsed.pathname, `/test/${index}/webmention`);
    if ([1, 2, 7, 8, 10, 18, 19].includes(index))
      assert.equal(parsed.search, '?head=true');
    if (index === 21) assert.equal(parsed.search, '?query=yes');
    return {
      url,
      endpoint,
      proves: 'Endpoint discovery only. No mention is sent.',
    };
  });
}

// Next bundles these styles; Node needs only the components' HTML for the independent parsers.
registerHooks({
  load(url, context, nextLoad) {
    return url.endsWith('.css')
      ? { format: 'module', source: '', shortCircuit: true }
      : nextLoad(url, context);
  },
});
const { default: WritingItem } =
  await import('../components/writings/WritingItem');
const writing: WritingData = {
  slug: 'local-component-validation',
  title: 'مرحبا Alice',
  description: 'שלום Alice',
  hasExplicitTitle: true,
  published: new Date('2026-10-07T12:00:00Z'),
  lastUpdated: new Date('2026-10-07T12:00:00Z'),
  tags: ['event'],
  people: [],
  draft: false,
  featured: false,
  readingTime: 2,
  postType: 'event',
  photos: [{ url: 'https://media.example/image.jpg', alt: 'A garden' }],
  audio: ['https://media.example/sound.mp3'],
  video: ['https://media.example/video.mp4'],
  event: {
    start: '2026-11-01T12:00:00Z',
    end: '2026-11-01T13:00:00Z',
    location: 'A garden',
  },
  rsvp: { eventUrl: 'https://event.example/', status: 'yes' },
  micropub: {
    type: ['h-entry'],
    properties: {
      'in-reply-to': ['https://event.example/', 'https://event.example/two'],
      attachment: ['https://media.example/file.pdf'],
    },
  },
};
const body =
  '<div dir="auto">' +
  sanitizeCommentHtml(
    '<p dir="rtl">مرحبا <bdi dir="ltr">Alice</bdi></p><bdo dir="rtl">ABC</bdo>',
    absoluteUrl('/writings/local-component-validation')
  ) +
  '</div>';
const html = renderToStaticMarkup(
  createElement(
    'main',
    { className: 'h-feed' },
    createElement(WritingItem, { writing, contentHtml: body })
  )
);
function text(node: DefaultTreeAdapterMap['node']): string {
  return node.nodeName === '#text' && 'value' in node
    ? node.value
    : 'childNodes' in node
      ? node.childNodes.map(text).join('')
      : '';
}
function textarea(html: string): string {
  const visit = (node: DefaultTreeAdapterMap['node']): string | undefined => {
    if (
      'tagName' in node &&
      node.tagName === 'textarea' &&
      node.attrs.some(
        (a) => ['json', 'json-input'].includes(a.value) && a.name === 'id'
      )
    )
      return text(node);
    if ('childNodes' in node)
      for (const child of node.childNodes) {
        const found = visit(child);
        if (found !== undefined) return found;
      }
  };
  const found = visit(parse(html));
  assert.ok(found, 'The independent parser did not return its JSON textarea.');
  return found;
}
for (const parser of ['go', 'php']) {
  await check(`Independent ${parser} Microformats parser`, async () => {
    const params = new URLSearchParams({
      html,
      [parser === 'go' ? 'base-url' : 'url']: absoluteUrl('/writings'),
    });
    const response = await fetch(`https://${parser}.microformats.io/`, {
      method: 'POST',
      body: params,
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.status, 200);
    const parsed = JSON.parse(textarea(await response.text()));
    const entry = parsed.items[0]?.children?.[0];
    assert.ok(
      entry?.type.includes('h-entry') && entry.type.includes('h-event')
    );
    const p = entry.properties;
    assert.deepEqual(p.name, [writing.title]);
    assert.deepEqual(p.summary, [writing.description]);
    assert.deepEqual(p.rsvp, ['yes']);
    assert.deepEqual(p.audio, writing.audio);
    assert.deepEqual(p.video, writing.video);
    assert.deepEqual(p.attachment, ['https://media.example/file.pdf']);
    assert.equal(p['in-reply-to'].length, 2);
    assert.deepEqual(p.start, [writing.event!.start]);
    assert.deepEqual(p.end, [writing.event!.end]);
    assert.deepEqual(p.location, ['A garden']);
    assert.match(p.content[0].html, /dir="rtl"/);
    assert.match(p.content[0].html, /<bdi dir="ltr">Alice<\/bdi>/);
    return {
      service: `https://${parser}.microformats.io/`,
      entry,
      inputKind:
        'Current WritingItem rendered from a local in-memory fixture. No public writing.',
    };
  });
}

const item = writingToFeedItem(
  writing,
  body + plainTextHtml('\u200fAlice שלום')
);
for (const [format, xml] of [
  ['rss', generateRssFeed([item])],
  ['atom', generateAtomFeed([item])],
] as const) {
  await check(`W3C ${format} feed validator`, async () => {
    const response = await fetch('https://validator.w3.org/feed/check.cgi', {
      method: 'POST',
      body: new URLSearchParams({
        rawdata: xml,
        manual: '1',
        output: 'soap12',
      }),
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.status, 200);
    const result = await response.text();
    assert.match(result, /<(?:m:)?validity>true<\/(?:m:)?validity>/);
    return {
      service: 'https://validator.w3.org/feed/check.cgi',
      inputKind:
        'Current feed serializer output from an in-memory fixture, not a deployed feed.',
      errorCount: Number(
        /<m:errorcount>(\d+)<\/m:errorcount>/.exec(result)?.[1]
      ),
      warningCount: Number(
        /<m:warningcount>(\d+)<\/m:warningcount>/.exec(result)?.[1]
      ),
      warningContext:
        'Direct input has no document location for its self link. The validator also warns about the valid bdo direction override retained for Micropub rendering.',
      response: result,
    };
  });
  await setTimeout(1100);
}
report.finishedAt = new Date().toISOString();
const json = JSON.stringify(report, null, 2) + '\n';
if (values.output) {
  await mkdir(dirname(values.output), { recursive: true });
  await writeFile(values.output, json);
} else console.log(json);
if (report.checks.some((check) => check.status === 'failed'))
  process.exitCode = 1;
