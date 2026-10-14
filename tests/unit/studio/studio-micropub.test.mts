import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { hashSecret } from '@/lib/indieweb/indieauth/server';
import {
  type MicropubEndpointOptions,
  handleMicropubGet,
  handleMicropubPost,
} from '@/lib/indieweb/micropub/endpoint';
import { parseMicropubCreateRequest } from '@/lib/indieweb/micropub/parse';
import { buildMicropubWritingFile } from '@/lib/indieweb/micropub/serialize';
import { site } from '@/lib/site/identity';
import { StudioError } from '@/lib/studio/errors';
import type {
  Draft,
  DraftContent,
  Revision,
  StudioStore,
} from '@/lib/studio/types';

import { memoryIndieAuthStore } from '../../support/indieauth/memory-store.mts';

function memoryStudio() {
  const drafts = new Map<string, Draft>();
  const history: Revision[] = [];
  const store = {
    async bySlug(slug: string) {
      return (
        [...drafts.values()].find((d) => d.slug === slug && !d.deletedAt) ??
        null
      );
    },
    async create(slug: string, body: DraftContent) {
      if (await this.bySlug(slug)) throw new StudioError(409, 'Duplicate slug');
      const id = randomUUID();
      const head: Revision = {
        id: randomUUID(),
        documentId: id,
        number: 1,
        body,
        createdAt: new Date().toISOString(),
      };
      const draft: Draft = {
        id,
        slug,
        head,
        liveRevisionId: null,
        deletedAt: null,
      };
      drafts.set(id, draft);
      history.push(head);
      return draft;
    },
    async save(id: string, expected: string, body: DraftContent) {
      const draft = drafts.get(id)!;
      if (draft.head.id !== expected)
        throw new StudioError(409, 'Revision changed');
      const head = {
        id: randomUUID(),
        documentId: id,
        number: draft.head.number + 1,
        body,
        createdAt: new Date().toISOString(),
      };
      const updated = { ...draft, head };
      drafts.set(id, updated);
      history.push(head);
      return updated;
    },
    async remove(id: string, expected: string) {
      const draft = drafts.get(id)!;
      if (draft.head.id !== expected)
        throw new StudioError(409, 'Revision changed');
      drafts.set(id, { ...draft, deletedAt: new Date().toISOString() });
    },
  };
  return { store: store as unknown as StudioStore, drafts, history };
}

async function setup(scopes = ['create', 'update', 'delete']) {
  const { store } = memoryIndieAuthStore();
  const token: string = randomUUID();
  await store.saveToken(hashSecret(token), {
    clientId: 'https://client.example/',
    me: `${site.origin}/`,
    scope: scopes,
    issuedAt: new Date(),
    expiresAt: new Date(Date.now() + 60000),
  });
  const studio = memoryStudio();
  const published: { documentId: string; revisionId: string }[] = [];
  const options: MicropubEndpointOptions = {
    store,
    studioStore: studio.store,
    archives: {
      runExclusive: async () => {
        throw new Error('Private source reached public archive lock');
      },
      save: async () => {
        throw new Error('Private source reached public archive');
      },
      find: async () => {
        throw new Error('Private source reached public archive');
      },
      mark: async () => {
        throw new Error('Private source reached public archive');
      },
    },
    environment: {
      contentPath: 'content/writings',
      defaultBranch: 'main',
      githubRepository: 'test/site',
      githubToken: 'test-token',
    },
    fetch: async () => {
      throw new Error('Private draft unexpectedly accessed Git');
    },
    publish: async (documentId, revisionId) => {
      published.push({ documentId, revisionId });
      return {
        id: randomUUID(),
        documentId,
        revisionId,
        status: 'deploying',
        commit: 'published-commit',
        error: null,
        createdAt: new Date().toISOString(),
      };
    },
  };
  const request = (body: unknown, access = token) =>
    new Request(`${site.origin}/micropub`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  return { options, token, studio, published, request };
}

const createBody = (status: string) => ({
  type: ['h-entry'],
  properties: {
    name: ['Private note'],
    content: ['A private transit idea.'],
    'mp-slug': ['private-transit'],
    'post-status': [status],
  },
});

test('JSON and form creates preserve explicit post-status and reject unsupported statuses', async () => {
  const entry = await parseMicropubCreateRequest(
    new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createBody('draft')),
    })
  );
  assert.equal(entry.postStatus, 'draft');
  assert.match(
    buildMicropubWritingFile(entry, 'private-transit'),
    /draft: true/
  );
  const form = await parseMicropubCreateRequest(
    new Request('https://example.com', {
      method: 'POST',
      body: new URLSearchParams({
        h: 'entry',
        content: 'Private form note.',
        'post-status': 'draft',
      }),
    })
  );
  assert.equal(form.postStatus, 'draft');
  await assert.rejects(
    parseMicropubCreateRequest(
      new Request('https://example.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createBody('secret')),
      })
    ),
    /post-status/
  );
});

test('draft create and source use private revisions without a Git request or publication', async () => {
  const { options, token, studio, published, request } = await setup();
  const response = await handleMicropubPost(
    request(createBody('draft')),
    options
  );
  assert.equal(response.status, 202);
  assert.equal(studio.history.length, 1);
  assert.equal(published.length, 0);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  const url = `${site.origin}/writings/private-transit`;
  const source = await handleMicropubGet(
    new Request(
      `${site.origin}/micropub?q=source&url=${encodeURIComponent(url)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ),
    options
  );
  assert.equal(source.status, 200);
  const data = await source.json();
  assert.deepEqual(data.properties['post-status'], ['draft']);
  assert.match(data.properties.content[0], /private transit idea/);
  const denied = await handleMicropubGet(
    new Request(
      `${site.origin}/micropub?q=source&url=${encodeURIComponent(url)}`
    ),
    options
  );
  assert.equal(denied.status, 401);
});

test('public Micropub writes keep their GitHub path when private storage is bound', async () => {
  const { options, studio, request } = await setup();
  let content: string | null = null;
  let archiveLocks = 0;
  let gitWrites = 0;
  options.archives = {
    runExclusive: async (_key, operation) => {
      archiveLocks++;
      return operation();
    },
    save: async () => {},
    find: async () => null,
    mark: async () => {},
  };
  options.fetch = async (input, init) => {
    const githubRequest = new Request(input, init);
    if (githubRequest.method === 'GET')
      return content === null
        ? new Response('Not Found', { status: 404 })
        : Response.json({
            content: Buffer.from(content).toString('base64'),
            sha: 'blob-sha',
          });
    gitWrites++;
    const body = await githubRequest.json();
    content = Buffer.from(body.content, 'base64').toString('utf8');
    return Response.json({ commit: { sha: `commit-${gitWrites}` } });
  };

  const created = await handleMicropubPost(
    request(createBody('published')),
    options
  );
  assert.equal(created.status, 202);
  assert.equal((await created.json()).commit, 'commit-1');
  const updated = await handleMicropubPost(
    request({
      action: 'update',
      url: `${site.origin}/writings/private-transit`,
      replace: { content: ['A published edit.'] },
    }),
    options
  );
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).commit, 'commit-2');
  assert.match(content ?? '', /A published edit/);
  assert.equal(archiveLocks, 2);
  assert.equal(studio.drafts.size, 0);
});

test('draft updates retain the prior revision and publish only the explicitly selected replacement', async () => {
  const { options, studio, published, request } = await setup();
  await handleMicropubPost(request(createBody('draft')), options);
  const original = studio.history[0];
  const url = `${site.origin}/writings/private-transit`;
  const changed = await handleMicropubPost(
    request({
      action: 'update',
      url,
      replace: { content: ['A revised private idea.'] },
    }),
    options
  );
  assert.equal(changed.status, 200);
  assert.equal(studio.history.length, 2);
  assert.equal(published.length, 0);
  assert.match(JSON.stringify(original.body), /A private transit idea/);
  const publish = await handleMicropubPost(
    request({
      action: 'update',
      url,
      replace: { 'post-status': ['published'] },
    }),
    options
  );
  assert.equal(publish.status, 200);
  const selected = studio.history.at(-1)!;
  assert.deepEqual(published, [
    { documentId: selected.documentId, revisionId: selected.id },
  ]);
  assert.match(JSON.stringify(selected.body), /A revised private idea/);
});

test('deleting a private draft soft deletes it and retains revision history', async () => {
  const { options, studio, request } = await setup();
  await handleMicropubPost(request(createBody('draft')), options);
  const response = await handleMicropubPost(
    request({
      action: 'delete',
      url: `${site.origin}/writings/private-transit`,
    }),
    options
  );
  assert.equal(response.status, 200);
  assert.equal(await studio.store.bySlug('private-transit'), null);
  assert.equal(studio.history.length, 1);
});

test('missing durable private storage fails closed before any Git write', async () => {
  const { options, request } = await setup();
  delete options.studioStore;
  const saved = process.env.STUDIO_DATABASE_URL;
  delete process.env.STUDIO_DATABASE_URL;
  try {
    const response = await handleMicropubPost(
      request(createBody('draft')),
      options
    );
    assert.equal(response.status, 503);
    assert.match(
      (await response.json()).error_description,
      /Private draft storage/
    );
  } finally {
    if (saved !== undefined) process.env.STUDIO_DATABASE_URL = saved;
  }
});

test('a bad IndieAuth token cannot create or publish a private revision', async () => {
  const { options, studio, published, request } = await setup();
  const response = await handleMicropubPost(
    request(createBody('draft'), 'bad-token'),
    options
  );
  assert.equal(response.status, 401);
  assert.equal(studio.history.length, 0);
  assert.equal(published.length, 0);
});

test('private source retains reply metadata and syndication intent', async () => {
  const { options, token, request } = await setup();
  const body = createBody('draft') as {
    type: string[];
    properties: Record<string, unknown[]>;
  };
  delete body.properties.name;
  body.properties['in-reply-to'] = ['https://example.com/post'];
  body.properties.syndication = ['https://social.example.com/copy'];
  assert.equal((await handleMicropubPost(request(body), options)).status, 202);
  const response = await handleMicropubGet(
    new Request(
      `${site.origin}/micropub?q=source&url=${encodeURIComponent(`${site.origin}/writings/private-transit`)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ),
    options
  );
  const source = await response.json();
  assert.deepEqual(source.properties['in-reply-to'], [
    'https://example.com/post',
  ]);
  assert.deepEqual(source.properties.syndication, [
    'https://social.example.com/copy',
  ]);
});

test('malformed post-status objects are rejected instead of accidentally publishing', async () => {
  const { options, studio, published, request } = await setup();
  const body = createBody('draft') as unknown as {
    type: string[];
    properties: Record<string, unknown>;
  };
  body.properties['post-status'] = { value: 'draft' };
  const response = await handleMicropubPost(request(body), options);
  assert.equal(response.status, 400);
  assert.equal(studio.history.length, 0);
  assert.equal(published.length, 0);
});

test('draft-only credentials save privately and cannot request public publication', async () => {
  const { options, request, studio, published } = await setup(['draft']);
  const response = await handleMicropubPost(
    request(createBody('draft')),
    options
  );
  assert.equal(response.status, 202);
  assert.equal(studio.history.length, 1);
  assert.deepEqual(published, []);
  const denied = await handleMicropubPost(
    request(createBody('published')),
    options
  );
  assert.equal(denied.status, 403);
  assert.equal(studio.history.length, 1);
  assert.deepEqual(published, []);
});

test('undelete cannot restore an archived private draft into the public backend', async () => {
  const { restoreStoredWriting } =
    await import('../../../lib/indieweb/micropub/store.ts');
  let calls = 0;
  await assert.rejects(
    restoreStoredWriting(
      {
        slug: 'private',
        path: 'content/writings/private.mdx',
        source: '---\ndraft: true\n---\nPrivate content.',
      },
      {
        contentPath: 'content/writings',
        defaultBranch: 'main',
        githubRepository: 'test/site',
        githubToken: 'test',
      },
      async () => {
        calls++;
        return Response.json({});
      }
    ),
    /cannot be written to the public content backend/
  );
  assert.equal(calls, 0);
});
