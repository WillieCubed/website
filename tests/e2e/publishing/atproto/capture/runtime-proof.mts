import type {} from '@atcute/atproto';
import type { Did } from '@atcute/lexicons';
import matter from 'gray-matter';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

interface Context {
  settings: Record<string, string>;
  ORIGIN: string;
  runtimeRevision: string;
  socialOnly: boolean;
  values: {
    workspace?: string | undefined;
    slug?: string | undefined;
    env: string;
    output: string;
    'refresh-wait-seconds': string;
    'cleanup-only': boolean;
    'defer-bluesky': boolean;
    'authorization-only': boolean;
    'cookie-delivery-failure': boolean;
    'social-only': boolean;
    'fixture-source-journal'?: string | undefined;
    'fixture-publication-journal'?: string | undefined;
    'social-runtime-revision'?: string | undefined;
  };
  currentSocialFixture: boolean;
  workspace: string;
  socialRevision: string;
  root: string;
  fixturePublicationJournal: string;
}

export async function verifyExistingRuntime(dependencies: Context) {
  const { resolvePds } = await import('../../../../../lib/atproto/identity');
  const { documentIsVerified, publicationIsVerified } =
    await import('../../../../../lib/atproto/verification');
  const publication = `at://${dependencies.settings.NEXT_PUBLIC_ATPROTO_DID}/site.standard.publication/${dependencies.settings.ATPROTO_PUBLICATION_RKEY}`;
  const pds = await resolvePds(
    dependencies.settings.NEXT_PUBLIC_ATPROTO_DID as Did
  );
  assert.equal(
    new URL(pds).origin,
    dependencies.settings.ATPROTO_ACCEPTANCE_PROVIDER_ORIGIN
  );
  const recordUrl = new URL('/xrpc/com.atproto.repo.getRecord', pds);
  recordUrl.search = new URLSearchParams({
    repo: dependencies.settings.NEXT_PUBLIC_ATPROTO_DID,
    collection: 'site.standard.publication',
    rkey: dependencies.settings.ATPROTO_PUBLICATION_RKEY,
  }).toString();
  const responses = await Promise.all([
    fetch(`${dependencies.ORIGIN}/api/indieweb/revision`, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    }),
    fetch(`${dependencies.ORIGIN}/api/atproto/social`, {
      redirect: 'error',
      signal: AbortSignal.timeout(60000),
    }),
    fetch(`${dependencies.ORIGIN}/.well-known/site.standard.publication`, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    }),
    fetch(recordUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    }),
  ]);
  for (const response of responses) assert.equal(response.status, 200);
  assert.equal((await responses[0].json()).sha, dependencies.runtimeRevision);
  const status = await responses[1].json();
  assert(status.enabled && status.ready && !status.signedIn);
  const endpoint = await responses[2].text();
  const record = await responses[3].json();
  assert.equal(record.uri, publication);
  assert(
    publicationIsVerified(
      record.value,
      dependencies.ORIGIN,
      publication,
      endpoint
    )
  );
  let document:
    | {
        uri: string;
        cid: string;
        sourceHash: string;
        dirtyFixtureOverlay?: true;
      }
    | undefined;
  if (dependencies.socialOnly) {
    assert.equal(
      dependencies.values.slug,
      dependencies.currentSocialFixture
        ? 'atproto-acceptance-20261009'
        : 'atproto-acceptance-20261008'
    );
    const source = JSON.parse(
      await readFile(dependencies.values['fixture-source-journal']!, 'utf8')
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
    assert.equal(source.workspace, dependencies.workspace);
    assert.equal(source.slug, dependencies.values.slug);
    assert.equal(
      source.sha256,
      dependencies.currentSocialFixture
        ? '5a77d47542803e78d087a1e745a279b5c04ef7d1a03a7ff96009208c83ae4ba1'
        : '612bf6a27d93954fbbeea9c7ebb2b18dd83908e2278190ea8a4e79aa0732cd42'
    );
    assert.equal(
      createHash('sha256').update(source.original).digest('hex'),
      source.sha256
    );
    assert.equal(
      await readFile(
        resolve(
          dependencies.workspace,
          'content/writings',
          `${dependencies.values.slug}.mdx`
        ),
        'utf8'
      ),
      source.original
    );
    if (dependencies.currentSocialFixture) {
      assert(source.removed === false && source.cleanup === 'pending');
      assert.equal(
        execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: dependencies.workspace,
          encoding: 'utf8',
        }).trim(),
        dependencies.socialRevision
      );
      for (const directory of [dependencies.workspace, dependencies.root]) {
        assert.equal(
          execFileSync(
            'git',
            [
              'diff',
              dependencies.socialRevision,
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
    if (dependencies.currentSocialFixture)
      assert.equal(
        new Date(metadata.published).toISOString(),
        '2026-10-09T09:22:45.696Z'
      );
    assert.equal(metadata.draft, false);
    assert(!metadata.syndicateTo?.length && !metadata.syndication?.length);
    const { documentRkey } = await import('../../../../../lib/atproto/keys');
    const path = `/writings/${dependencies.values.slug}`;
    const rkey = documentRkey(path, new Date(metadata.published));
    if (dependencies.currentSocialFixture) assert.equal(rkey, '3mxgnm42kk26a');
    const uri = `at://${dependencies.settings.NEXT_PUBLIC_ATPROTO_DID}/site.standard.document/${rkey}`;
    const url = new URL(recordUrl);
    url.searchParams.set('collection', 'site.standard.document');
    url.searchParams.set('rkey', rkey);
    const [recordResponse, pageResponse] = await Promise.all([
      fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) }),
      fetch(dependencies.ORIGIN + path, {
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
        dependencies.currentSocialFixture
          ? '4038d95d-3c92-408b-a144-38ecf1db490d'
          : 'c494f7f1-49f6-4e9b-ac52-7eed1fe3ecf9'
      )
    );
    assert(documentIsVerified(writing.value, publication, path, uri, html));
    if (dependencies.currentSocialFixture) {
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
      await readFile(dependencies.fixturePublicationJournal, 'utf8')
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
    assert.equal(fixture.did, dependencies.settings.NEXT_PUBLIC_ATPROTO_DID);
    assert.equal(fixture.publicationUri, publication);
    assert.equal(
      fixture.publicationRkey,
      dependencies.settings.ATPROTO_PUBLICATION_RKEY
    );
    assert.equal(fixture.slug, dependencies.values.slug);
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
      ...(dependencies.currentSocialFixture && {
        dirtyFixtureOverlay: true as const,
      }),
    };
  }
  return {
    revision: dependencies.runtimeRevision,
    ...(dependencies.currentSocialFixture && { dirtyFixtureOverlay: true }),
    publication,
    cid: record.cid as string,
    ...(document && { document }),
  };
}
