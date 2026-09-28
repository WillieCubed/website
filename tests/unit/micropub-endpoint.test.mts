import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import test from 'node:test';

import { hashSecret } from '@/lib/indieweb/indieauth-server';
import {
  type MicropubEndpointOptions,
  handleMicropubGet,
  handleMicropubPost,
} from '@/lib/indieweb/micropub-endpoint';
import type { MicropubRouteEnvironment } from '@/lib/indieweb/types';
import { site } from '@/lib/site';

import { memoryIndieAuthStore } from './indieauth-memory-store.mts';

const endpoint = `${site.origin}/micropub`;
const postUrl = `${site.origin}/writings/bus-lane`;
const source = `---
title: "Bus lane"
description: "The 109 needs one."
published: 2026-09-20T08:00-0700
lastUpdated: 2026-09-20T08:00-0700
tags: ["transit"]
draft: false
postType: "article"
---

The 109 carries more riders than any other route.
`;

const { store } = memoryIndieAuthStore();

async function tokenWith(...scope: string[]): Promise<string> {
  const token = `token-${scope.join('-') || 'none'}`;
  await store.saveToken(hashSecret(token), {
    clientId: 'https://client.example/',
    me: `${site.origin}/`,
    scope,
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return token;
}

/** A content directory holding one writing, removed after the test. */
async function withContent(
  run: (options: MicropubEndpointOptions, file: string) => Promise<void>
) {
  const dir = await mkdtemp(join(tmpdir(), 'micropub-endpoint-'));
  const contentPath = relative(process.cwd(), join(dir, 'writings'));
  await mkdir(join(dir, 'writings'));
  const file = join(dir, 'writings', 'bus-lane.mdx');
  await writeFile(file, source);
  try {
    await run(
      { store, environment: { defaultBranch: 'main', contentPath } },
      file
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const github: MicropubRouteEnvironment = {
  githubRepository: 'WillieCubed/website',
  githubToken: 'github-test-token',
  defaultBranch: 'publish',
  contentPath: 'content/writings',
};

/**
 * A stand-in for GitHub's Contents API holding `bus-lane.mdx`. It records
 * every request.
 */
function fakeGitHub() {
  const calls: Request[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    calls.push(request.clone());
    return request.url.includes('/bus-lane.mdx')
      ? Response.json({
          content: Buffer.from(source).toString('base64'),
          sha: 'blob-sha',
        })
      : new Response('Not Found', { status: 404 });
  };
  return { calls, fetch };
}

function get(query: string, token?: string): Request {
  return new Request(`${endpoint}?${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

function sourceQuery(url: string): string {
  return `q=source&url=${encodeURIComponent(url)}`;
}

test('q=source needs a token for this site and returns the post', async () => {
  await withContent(async (options) => {
    const query = sourceQuery(postUrl);
    assert.equal((await handleMicropubGet(get(query), options)).status, 401);
    const invalid = await handleMicropubGet(get(query, 'not-a-token'), options);
    assert.equal(invalid.status, 401);
    assert.equal((await invalid.json()).error, 'invalid_token');

    const response = await handleMicropubGet(
      get(query, await tokenWith('media')),
      options
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
      type: ['h-entry'],
      properties: {
        name: ['Bus lane'],
        summary: ['The 109 needs one.'],
        content: ['The 109 carries more riders than any other route.'],
        published: ['2026-09-20T15:00:00.000Z'],
        updated: ['2026-09-20T15:00:00.000Z'],
        category: ['transit'],
        'post-status': ['published'],
        url: [postUrl],
      },
    });
  });
});

test('q=source returns only the properties asked for', async () => {
  await withContent(async (options) => {
    const token = await tokenWith('create');
    const some = await handleMicropubGet(
      get(
        `${sourceQuery(postUrl)}&properties[]=content&properties[]=category&properties[]=location`,
        token
      ),
      options
    );
    assert.deepEqual(await some.json(), {
      properties: {
        content: ['The 109 carries more riders than any other route.'],
        category: ['transit'],
      },
    });
    const one = await handleMicropubGet(
      get(`${sourceQuery(postUrl)}&properties=name`, token),
      options
    );
    assert.deepEqual(await one.json(), { properties: { name: ['Bus lane'] } });
  });
});

test('q=source answers 400 for a URL that is not a writing', async () => {
  await withContent(async (options) => {
    const token = await tokenWith('create');
    const missing = await handleMicropubGet(get('q=source', token), options);
    assert.equal(missing.status, 400);
    assert.equal((await missing.json()).error, 'invalid_request');

    for (const url of [
      `${site.origin}/writings/nope`,
      `${site.origin}/writings/_template`,
      `${site.origin}/writings/..%2F..%2Fpackage`,
      `${site.origin}/initiatives/twd`,
      'https://example.com/writings/bus-lane',
      'not a url',
    ]) {
      const response = await handleMicropubGet(
        get(sourceQuery(url), token),
        options
      );
      assert.equal(response.status, 400, url);
      assert.deepEqual(
        await response.json(),
        {
          error: 'invalid_request',
          error_description: 'The post with the requested URL was not found.',
        },
        url
      );
    }
  });
});

test('q=source reads the writing from GitHub when GitHub is configured', async () => {
  const { calls, fetch } = fakeGitHub();
  const response = await handleMicropubGet(
    get(sourceQuery(postUrl), await tokenWith('create')),
    { store, environment: github, fetch }
  );

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).properties.name, ['Bus lane']);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://api.github.com/repos/WillieCubed/website/contents/content/writings/bus-lane.mdx?ref=publish'
  );
  assert.equal(
    calls[0].headers.get('authorization'),
    'Bearer github-test-token'
  );
});

test('a create still needs the create scope and writes the file', async () => {
  await withContent(async (options) => {
    const body = () =>
      new URLSearchParams({
        h: 'entry',
        content: 'A second note.',
        'mp-slug': 'second-note',
      });
    const refused = await handleMicropubPost(
      new Request(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await tokenWith('media')}` },
        body: body(),
      }),
      options
    );
    assert.equal(refused.status, 403);
    assert.equal((await refused.json()).error, 'insufficient_scope');

    const created = await handleMicropubPost(
      new Request(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await tokenWith('create')}` },
        body: body(),
      }),
      options
    );
    assert.equal(created.status, 202);
    assert.equal(
      created.headers.get('location'),
      `${site.origin}/writings/second-note`
    );
    const dir = join(process.cwd(), options.environment!.contentPath);
    assert.match(
      await readFile(join(dir, 'second-note.mdx'), 'utf8'),
      /A second note\./
    );
  });
});
