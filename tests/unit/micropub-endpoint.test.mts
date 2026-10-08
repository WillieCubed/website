import matter from 'gray-matter';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import test from 'node:test';

import { hashSecret } from '@/lib/indieweb/indieauth-server';
import {
  type ArchivedWriting,
  type MicropubArchiveStore,
} from '@/lib/indieweb/micropub-archive';
import {
  type MicropubEndpointOptions,
  handleMicropubGet,
  handleMicropubPost,
} from '@/lib/indieweb/micropub-endpoint';
import { MicropubConflictError } from '@/lib/indieweb/micropub-store';
import type { MicropubRouteEnvironment } from '@/lib/indieweb/types';
import { site } from '@/lib/site';

import { memoryIndieAuthStore } from './indieauth-memory-store.mts';

function memoryArchives(): MicropubArchiveStore & {
  records: Map<string, ArchivedWriting>;
} {
  const records = new Map<string, ArchivedWriting>();
  const locked = new Set<string>();
  return {
    records,
    async runExclusive(key, operation) {
      if (locked.has(key))
        throw new MicropubConflictError(
          'Another request is changing this post.'
        );
      locked.add(key);
      try {
        return await operation();
      } finally {
        locked.delete(key);
      }
    },
    async save(key, url, writing) {
      records.set(key, { ...writing, url, state: 'archived' });
    },
    async find(key) {
      return records.get(key) ?? null;
    },
    async mark(key, state) {
      const row = records.get(key);
      if (row) row.state = state;
    },
  };
}
const archives = memoryArchives();
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

const now = new Date('2026-09-27T20:05:00Z');

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
      {
        store,
        environment: { defaultBranch: 'main', contentPath },
        archives: memoryArchives(),
        now: () => now,
      },
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
 * every request and answers a write with `commit-sha`, or with
 * `writeStatus` when that is set.
 */
function fakeGitHub(writeStatus?: number) {
  const calls: Request[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    calls.push(request.clone());
    if (request.method !== 'GET') {
      return writeStatus
        ? new Response('conflict', { status: writeStatus })
        : Response.json({ commit: { sha: 'commit-sha' } });
    }
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

function postJson(body: unknown, token: string): Request {
  return new Request(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function postForm(entries: [string, string][]): Request {
  return new Request(endpoint, {
    method: 'POST',
    body: new URLSearchParams(entries),
  });
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
    { store, archives, environment: github, fetch }
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

test('q=category lists published tags to anyone and filters them by prefix', async () => {
  const options = {
    publishedTags: async () => ['indieweb', 'note', 'transit', 'travel'],
  };
  const categories = async (query: string) => {
    const response = await handleMicropubGet(get(query), options);
    assert.equal(response.status, 200, query);
    return (await response.json()).categories;
  };
  assert.deepEqual(await categories('q=category'), [
    'indieweb',
    'note',
    'transit',
    'travel',
  ]);
  assert.deepEqual(await categories('q=category&filter=TR'), [
    'transit',
    'travel',
  ]);
  assert.deepEqual(await categories('q=category&filter=web'), []);
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

test('a create with an mp-slug outside the writings directory answers 400', async () => {
  await withContent(async (options) => {
    const response = await handleMicropubPost(
      new Request(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await tokenWith('create')}` },
        body: new URLSearchParams({
          h: 'entry',
          content: 'Out of bounds.',
          'mp-slug': '../../app/evil',
        }),
      }),
      options
    );
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, 'invalid_request');
    assert.match(body.error_description, /mp-slug/);
  });
});

test('a create cannot replace an existing permalink with either source extension', async () => {
  await withContent(async (options, file) => {
    const directory = join(process.cwd(), options.environment!.contentPath);
    await writeFile(join(directory, 'markdown-post.md'), source);
    for (const slug of ['bus-lane', 'markdown-post']) {
      const response = await handleMicropubPost(
        postJson(
          { properties: { content: ['Replacement.'], 'mp-slug': [slug] } },
          await tokenWith('create')
        ),
        options
      );
      assert.equal(response.status, 409);
    }
    assert.equal(await readFile(file, 'utf8'), source);
    assert.equal(
      await readFile(join(directory, 'markdown-post.md'), 'utf8'),
      source
    );
    await assert.rejects(readFile(join(directory, 'markdown-post.mdx')));
  });
});

test('a create with a photo without alt writes no file', async () => {
  await withContent(async (options) => {
    const response = await handleMicropubPost(
      postJson(
        {
          type: ['h-entry'],
          properties: {
            photo: ['https://example.com/photo.jpg'],
            'mp-slug': ['unlabeled-photo'],
          },
        },
        await tokenWith('create')
      ),
      options
    );
    assert.equal(response.status, 400);
    assert.match((await response.json()).error_description, /nonblank alt/);
    await assert.rejects(
      readFile(
        join(
          process.cwd(),
          options.environment!.contentPath,
          'unlabeled-photo.mdx'
        )
      )
    );
  });
});

test('an update needs the update scope and rewrites the file', async () => {
  await withContent(async (options, file) => {
    const body = {
      action: 'update',
      url: postUrl,
      replace: { content: ['A lane on Charleston first.'] },
      add: { category: ['charleston'] },
    };
    const refused = await handleMicropubPost(
      postJson(body, await tokenWith('create')),
      options
    );
    assert.equal(refused.status, 403);
    assert.equal((await refused.json()).error, 'insufficient_scope');
    assert.equal(await readFile(file, 'utf8'), source);

    const response = await handleMicropubPost(
      postJson(body, await tokenWith('update')),
      options
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      url: postUrl,
      path: `${options.environment!.contentPath}/bus-lane.mdx`,
      commit: '',
    });
    const updated = matter(await readFile(file, 'utf8'), {});
    assert.equal(updated.content.trim(), 'A lane on Charleston first.');
    assert.deepEqual(updated.data.tags, ['transit', 'charleston']);
    assert.equal(updated.data.contentFormat, 'text');
    assert.equal(updated.data.draft, false);
    assert.equal(updated.data.lastUpdated, '2026-09-27T13:05-0700');
  });
});

test('a photo update without alt writes no file or GitHub commit', async () => {
  const request = postJson(
    {
      action: 'update',
      url: postUrl,
      replace: { photo: ['https://example.com/photo.jpg'] },
    },
    await tokenWith('update')
  );
  await withContent(async (options, file) => {
    const response = await handleMicropubPost(request.clone(), options);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error_description, /nonblank alt/);
    assert.equal(await readFile(file, 'utf8'), source);
  });

  const { calls, fetch } = fakeGitHub();
  const response = await handleMicropubPost(request.clone(), {
    store,
    archives,
    environment: github,
    fetch,
  });
  assert.equal(response.status, 400);
  assert.deepEqual(
    calls.map(({ method }) => method),
    ['GET']
  );
});

test('a form update carries its token and changes in the body', async () => {
  await withContent(async (options, file) => {
    const response = await handleMicropubPost(
      postForm([
        ['action', 'update'],
        ['url', postUrl],
        ['replace[name]', 'Bus lane now'],
        ['delete[category][]', 'transit'],
        ['access_token', await tokenWith('update')],
      ]),
      options
    );
    assert.equal(response.status, 200);
    const updated = await readFile(file, 'utf8');
    assert.match(updated, /\ntitle: "Bus lane now"\n/);
    assert.match(updated, /\ntags: \[\]\n/);
    assert.match(updated, /\ndraft: false\n/);
  });
});

test('an update that changes nothing makes no commit', async () => {
  await withContent(async (options, file) => {
    const response = await handleMicropubPost(
      postJson(
        { action: 'update', url: postUrl, add: { category: ['transit'] } },
        await tokenWith('update')
      ),
      options
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).commit, '');
    assert.equal(await readFile(file, 'utf8'), source);
  });
});

test('an update of something that is not a writing, or cannot be stored, answers 400', async () => {
  await withContent(async (options, file) => {
    const token = await tokenWith('update');
    for (const url of [
      `${site.origin}/writings/nope`,
      'https://example.com/writings/bus-lane',
    ]) {
      const response = await handleMicropubPost(
        postJson({ action: 'update', url, replace: { name: ['x'] } }, token),
        options
      );
      assert.equal(response.status, 400, url);
      assert.equal(
        (await response.json()).error_description,
        'The post with the requested URL was not found.'
      );
    }
    const unsupported = await handleMicropubPost(
      postJson(
        {
          action: 'update',
          url: postUrl,
          replace: { url: ['https://example.com/override'] },
        },
        token
      ),
      options
    );
    assert.equal(unsupported.status, 400);
    assert.equal((await unsupported.json()).error, 'invalid_request');
    assert.equal(await readFile(file, 'utf8'), source);
  });
});

test('undelete requires its own scope', async () => {
  const response = await handleMicropubPost(
    postJson({ action: 'undelete', url: postUrl }, await tokenWith('update')),
    { store, archives }
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, 'insufficient_scope');
  assert.match(response.headers.get('www-authenticate')!, /scope="undelete"/);
});

test('a bad token is reported before a malformed body', async () => {
  const response = await handleMicropubPost(
    postJson({ action: 'launch' }, 'not-a-token'),
    { store, archives }
  );
  assert.equal(response.status, 401);
});

test('with GitHub configured, an update commits over the SHA it read', async () => {
  const { calls, fetch } = fakeGitHub();
  const response = await handleMicropubPost(
    postJson(
      { action: 'update', url: postUrl, replace: { summary: ['Now.'] } },
      await tokenWith('update')
    ),
    { store, archives, environment: github, fetch, now: () => now }
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).commit, 'commit-sha');
  assert.equal(calls.length, 2);
  const put = calls[1];
  assert.equal(put.method, 'PUT');
  assert.equal(
    put.url,
    'https://api.github.com/repos/WillieCubed/website/contents/content/writings/bus-lane.mdx'
  );
  assert.equal(put.headers.get('authorization'), 'Bearer github-test-token');
  const body = await put.json();
  assert.equal(body.sha, 'blob-sha');
  assert.equal(body.branch, 'publish');
  assert.equal(body.message, 'chore(content): Update bus-lane via Micropub');
  const updated = matter(
    Buffer.from(body.content, 'base64').toString('utf8'),
    {}
  );
  assert.equal(updated.data.description, 'Now.');
  assert.equal(updated.data.lastUpdated, '2026-09-27T13:05-0700');
  assert.equal(updated.content, matter(source, {}).content);
});

test('an update that loses a race with another commit fails instead of overwriting it', async () => {
  const { calls, fetch } = fakeGitHub(409);
  const response = await handleMicropubPost(
    postJson(
      { action: 'update', url: postUrl, replace: { summary: ['Now.'] } },
      await tokenWith('update')
    ),
    { store, archives, environment: github, fetch, now: () => now }
  );

  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, 'conflict');
  assert.equal(calls.length, 2);
});

test('a delete needs the delete scope and removes the file', async () => {
  await withContent(async (options, file) => {
    const request = (token: string) =>
      postForm([
        ['action', 'delete'],
        ['url', postUrl],
        ['access_token', token],
      ]);
    const refused = await handleMicropubPost(
      request(await tokenWith('create', 'update')),
      options
    );
    assert.equal(refused.status, 403);
    assert.equal((await refused.json()).error, 'insufficient_scope');
    assert.equal(await readFile(file, 'utf8'), source);

    const token = await tokenWith('delete');
    const deleted = await handleMicropubPost(request(token), options);
    assert.equal(deleted.status, 200);
    assert.deepEqual(await deleted.json(), {
      url: postUrl,
      path: `${options.environment!.contentPath}/bus-lane.mdx`,
      commit: '',
    });
    await assert.rejects(readFile(file, 'utf8'), { code: 'ENOENT' });

    const again = await handleMicropubPost(request(token), options);
    assert.equal(again.status, 400);
    assert.equal(
      (await again.json()).error_description,
      'The post with the requested URL was not found.'
    );
    const read = await handleMicropubGet(
      get(sourceQuery(postUrl), token),
      options
    );
    assert.equal(read.status, 400);
  });
});

test('delete archives privately and undelete restores the same source and permalink', async () => {
  await withContent(async (options, file) => {
    const token = await tokenWith('delete', 'undelete');
    const deleted = await handleMicropubPost(
      postJson({ action: 'delete', url: postUrl }, token),
      options
    );
    assert.equal(deleted.status, 200);
    await assert.rejects(readFile(file, 'utf8'), { code: 'ENOENT' });
    const hidden = await handleMicropubGet(
      get(sourceQuery(postUrl), token),
      options
    );
    assert.equal(hidden.status, 400);
    const restored = await handleMicropubPost(
      postForm([
        ['action', 'undelete'],
        ['url', postUrl],
        ['access_token', token],
      ]),
      options
    );
    assert.equal(restored.status, 200);
    assert.equal((await restored.json()).url, postUrl);
    assert.equal(await readFile(file, 'utf8'), source);
    const conflict = await handleMicropubPost(
      postJson({ action: 'undelete', url: postUrl }, token),
      options
    );
    assert.equal(conflict.status, 409);
    assert.equal(await readFile(file, 'utf8'), source);
  });
});

test('an archive failure leaves the public source untouched', async () => {
  await withContent(async (options, file) => {
    options.archives!.save = async () => {
      throw new Error('archive unavailable');
    };
    const response = await handleMicropubPost(
      postJson({ action: 'delete', url: postUrl }, await tokenWith('delete')),
      options
    );
    assert.equal(response.status, 500);
    assert.equal(await readFile(file, 'utf8'), source);
  });
});

test('with GitHub configured, a delete removes the file at the SHA it read', async () => {
  const { calls, fetch } = fakeGitHub();
  const response = await handleMicropubPost(
    postJson({ action: 'delete', url: postUrl }, await tokenWith('delete')),
    { store, archives, environment: github, fetch }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    url: postUrl,
    path: 'content/writings/bus-lane.mdx',
    commit: 'commit-sha',
  });
  assert.equal(calls.length, 2);
  const remove = calls[1];
  assert.equal(remove.method, 'DELETE');
  assert.equal(
    remove.url,
    'https://api.github.com/repos/WillieCubed/website/contents/content/writings/bus-lane.mdx'
  );
  assert.equal(remove.headers.get('authorization'), 'Bearer github-test-token');
  assert.deepEqual(await remove.json(), {
    branch: 'publish',
    message: 'chore(content): Delete bus-lane via Micropub',
    sha: 'blob-sha',
  });
});

test('a delete that loses a race with another commit fails instead of discarding it', async () => {
  const { calls, fetch } = fakeGitHub(409);
  const response = await handleMicropubPost(
    postJson({ action: 'delete', url: postUrl }, await tokenWith('delete')),
    { store, archives, environment: github, fetch }
  );

  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, 'conflict');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].method, 'DELETE');
});

test('a draft-scoped token creates drafts but cannot publish', async () => {
  await withContent(async (options) => {
    const token = await tokenWith('draft');
    const draft = await handleMicropubPost(
      postJson(
        {
          properties: {
            content: ['A draft.'],
            'post-status': ['draft'],
            'mp-slug': ['draft-only'],
          },
        },
        token
      ),
      options
    );
    assert.equal(draft.status, 202);
    const file = await readFile(
      join(process.cwd(), options.environment!.contentPath, 'draft-only.mdx'),
      'utf8'
    );
    assert.equal(matter(file, {}).data.draft, true);
    const published = await handleMicropubPost(
      postJson(
        {
          properties: {
            content: ['Must remain unpublished.'],
            'mp-slug': ['not-published'],
          },
        },
        token
      ),
      options
    );
    assert.equal(published.status, 403);
    await assert.rejects(
      readFile(
        join(
          process.cwd(),
          options.environment!.contentPath,
          'not-published.mdx'
        ),
        'utf8'
      ),
      { code: 'ENOENT' }
    );
  });
});

test('Micropub preflights and credential errors expose CORS and bearer challenges', async () => {
  const { OPTIONS } = await import('@/app/micropub/route');
  const preflight = OPTIONS();
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
  const denied = await handleMicropubGet(get(sourceQuery(postUrl)), { store });
  assert.equal(denied.headers.get('www-authenticate'), 'Bearer');
  assert.equal(denied.headers.get('access-control-allow-origin'), '*');
  const bad = await handleMicropubGet(get(sourceQuery(postUrl), 'invalid'), {
    store,
  });
  assert.match(bad.headers.get('www-authenticate')!, /invalid_token/);
});

test('concurrent mutations for one permalink reject the second request', async () => {
  await withContent(async (options, file) => {
    let entered!: () => void;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const original = options.archives!.runExclusive.bind(options.archives!);
    options.archives!.runExclusive = (key, operation) =>
      original(key, async () => {
        entered();
        await gate;
        return operation();
      });
    const token = await tokenWith('update', 'delete');
    const first = handleMicropubPost(
      postJson(
        {
          action: 'update',
          url: postUrl,
          replace: { summary: ['Changed first.'] },
        },
        token
      ),
      options
    );
    await started;
    const second = await handleMicropubPost(
      postJson({ action: 'delete', url: postUrl }, token),
      options
    );
    assert.equal(second.status, 409);
    release();
    assert.equal((await first).status, 200);
    assert.equal(
      matter(await readFile(file, 'utf8'), {}).data.description,
      'Changed first.'
    );
  });
});
