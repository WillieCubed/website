import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Pool } from 'pg';

import { approvedManifest } from '../../../lib/music/public';
import {
  musicPublicationStatus,
  publishMusic,
} from '../../../lib/music/publication';
import { musicStore } from '../../../lib/music/store';
import { emptyCatalog } from '../../../lib/music/types';

interface MockPullRequest {
  number: number;
  html_url: string;
  title: string;
  body: string;
  state: string;
  head: { sha: string };
  base: { sha: string };
  merged: boolean;
  merge_commit_sha?: string;
}
interface MockTreeRequest {
  base_tree: string;
  tree: { path: string; content: string }[];
}
interface MockCommitRequest {
  message: string;
  tree: string;
  parents: string[];
}
interface MockCommit extends Omit<MockCommitRequest, 'parents'> {
  sha: string;
  parents: { sha: string }[];
}

test(
  'publication recovers a lost PR response, rebases unrelated main, and waits for exact deployed proof',
  { skip: !process.env.STUDIO_TEST_DATABASE_URL },
  async (context) => {
    const environmentKeys = [
      'SITE_MODE',
      'STUDIO_DATABASE_URL',
      'STUDIO_GITHUB_REPOSITORY',
      'STUDIO_GITHUB_BRANCH',
      'STUDIO_GITHUB_TOKEN',
      'STUDIO_PUBLIC_ORIGIN',
    ];
    const previousEnvironment = new Map(
      environmentKeys.map((key) => [key, process.env[key]])
    );
    const original = globalThis.fetch;
    context.after(() => {
      globalThis.fetch = original;
      for (const [key, value] of previousEnvironment) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
    const schema = 'music_publish_' + randomUUID().replaceAll('-', ''),
      admin = new Pool({
        connectionString: process.env.STUDIO_TEST_DATABASE_URL,
      });
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.STUDIO_TEST_DATABASE_URL!);
    url.searchParams.set('options', `-c search_path=${schema}`);
    process.env.STUDIO_DATABASE_URL = url.href;
    Object.assign(process.env, {
      SITE_MODE: 'preview',
      STUDIO_GITHUB_REPOSITORY: 'owner/site',
      STUDIO_GITHUB_BRANCH: 'main',
      STUDIO_GITHUB_TOKEN: 'test',
      STUDIO_PUBLIC_ORIGIN: 'https://public.test',
    });
    const store = musicStore();
    const mainFile = (await approvedManifest()).sourceSha;
    let main = 'a'.repeat(40),
      ready = false,
      loseResponse = true,
      rebases = 0,
      merges = 0;
    let pr: MockPullRequest | null = null;
    let proof: Record<string, unknown> = {};
    const refs = new Map<string, string>(),
      commits = new Map<string, MockCommit>(),
      trees = new Map<string, MockTreeRequest>();
    globalThis.fetch = async (input, init = {}) => {
      const url = new URL(String(input));
      if (url.hostname === 'public.test') return Response.json(proof);
      const path = decodeURIComponent(
          url.pathname.replace('/repos/owner/site/', '')
        ),
        method = init.method ?? 'GET';
      const body = <T,>() => JSON.parse(String(init.body)) as T;
      const ok = (data: unknown) => Response.json(data),
        missing = () => Response.json({}, { status: 404 });
      if (url.pathname === '/graphql') {
        const update = body<{
          variables: {
            input: {
              refUpdates: {
                name: string;
                beforeOid: string;
                afterOid: string;
              }[];
            };
          };
        }>().variables.input.refUpdates[0];
        const branch = update.name.replace('refs/heads/', '');
        assert.equal(refs.get(branch), update.beforeOid);
        refs.set(branch, update.afterOid);
        rebases++;
        if (pr) pr.head.sha = update.afterOid;
        return ok({ data: { updateRefs: {} } });
      }
      if (path === '') return ok({ node_id: 'repo' });
      if (path === 'git/ref/heads/main') return ok({ object: { sha: main } });
      if (path.startsWith('git/ref/heads/')) {
        const value = refs.get(path.slice(14));
        return value ? ok({ object: { sha: value } }) : missing();
      }
      if (path === 'git/refs') {
        const request = body<{ ref: string; sha: string }>();
        refs.set(request.ref.replace('refs/heads/', ''), request.sha);
        return ok({});
      }
      if (path === 'git/trees') {
        const request = body<MockTreeRequest>();
        assert.equal(request.tree.length, 1);
        assert.equal(request.tree[0].path, 'content/music/catalog.json');
        const sha = createHash('sha1')
          .update(JSON.stringify(request))
          .digest('hex');
        trees.set(sha, request);
        return ok({ sha });
      }
      if (path === 'git/commits' && method === 'POST') {
        const request = body<MockCommitRequest>();
        const sha = createHash('sha1')
          .update(JSON.stringify(request))
          .digest('hex');
        commits.set(sha, {
          ...request,
          sha,
          parents: request.parents.map((sha: string) => ({ sha })),
        });
        return ok({ sha });
      }
      if (path.startsWith('git/commits/'))
        return ok(
          commits.get(path.slice(12)) ?? {
            tree: { sha: 'base-tree' },
            parents: [],
          }
        );
      if (path.startsWith('contents/'))
        return ok({
          sha: mainFile,
          encoding: 'base64',
          content: Buffer.from(
            JSON.stringify({ revisionId: null, catalog: emptyCatalog })
          ).toString('base64'),
        });
      if (path === 'pulls' && method === 'GET') return ok(pr ? [pr] : []);
      if (path === 'pulls' && method === 'POST') {
        const request = body<{ title: string; body: string; head: string }>();
        const head = refs.get(request.head);
        assert.ok(head);
        pr = {
          number: 1,
          html_url: 'https://github.com/owner/site/pull/1',
          title: request.title,
          body: request.body,
          state: 'open',
          head: { sha: head },
          base: { sha: main },
          merged: false,
        };
        if (loseResponse) {
          loseResponse = false;
          throw new Error('Lost after creating PR');
        }
        return ok(pr);
      }
      if (path === 'pulls/1')
        return ok({
          ...pr,
          base: { sha: main },
          mergeable: ready,
          mergeable_state: ready ? 'unstable' : 'unknown',
        });
      if (path.endsWith('/check-runs'))
        if (new Headers(init.headers).has('Authorization'))
          return Response.json({}, { status: 403 });
      if (path.endsWith('/check-runs'))
        return ok({
          total_count: 2,
          check_runs: [
            {
              name: 'ci',
              app: { id: 15368 },
              status: ready ? 'completed' : 'in_progress',
              conclusion: ready ? 'success' : null,
            },
            {
              name: 'Vercel – website',
              status: 'completed',
              conclusion: 'failure',
            },
          ],
        });
      if (path.endsWith('/status'))
        return ok({
          state: 'failure',
          statuses: [{ context: 'Vercel – website', state: 'failure' }],
        });
      if (path === 'pulls/1/merge') {
        const request = body<{ merge_method: string; sha: string }>();
        assert.ok(pr);
        assert.equal(request.merge_method, 'rebase');
        assert.equal(request.sha, pr.head.sha);
        merges++;
        pr.merged = true;
        pr.merge_commit_sha = 'f'.repeat(40);
        main = pr.merge_commit_sha;
        return ok({ merged: true, sha: main });
      }
      throw new Error(`Unexpected mock path ${path}`);
    };
    try {
      await store.pool.query(
        await readFile('lib/music/migrations/private.sql', 'utf8')
      );
      const revision = await store.save(null, emptyCatalog);
      const first = await publishMusic(revision.id);
      assert.equal(first.status, 'failed');
      const created = pr as MockPullRequest | null;
      assert.ok(created);
      assert.equal(
        commits.get(first.proposalCommit!)?.message.split('\n')[0],
        'feat(music): Republish the music collection'
      );
      assert.match(created.title, /^feat\(music\):/);
      assert.match(created.body, new RegExp(`Music-Revision: ${revision.id}`));
      const recovered = await publishMusic(revision.id);
      assert.equal(recovered.id, first.id);
      assert.equal(recovered.status, 'publishing');
      assert.equal(recovered.pullRequestNumber, 1);
      main = 'b'.repeat(40);
      const rebased = await publishMusic(revision.id);
      assert.equal(rebased.status, 'publishing');
      assert.equal(rebases, 1);
      assert.equal(
        (await store.pool.query('SELECT body FROM music_publications')).rows[0]
          .body.rebase,
        null
      );
      ready = true;
      const merged = await publishMusic(revision.id);
      assert.equal(merged.status, 'deploying');
      assert.equal(merges, 1);
      assert.equal(
        (await musicPublicationStatus(first.id)).status,
        'deploying'
      );
      proof = {
        revisionId: revision.id,
        sourceSha: merged.sourceSha,
        commit: merged.commit,
      };
      assert.equal((await musicPublicationStatus(first.id)).status, 'live');
      assert.equal((await publishMusic(revision.id)).status, 'live');
      assert.equal(merges, 1);
    } finally {
      await store.pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  }
);
