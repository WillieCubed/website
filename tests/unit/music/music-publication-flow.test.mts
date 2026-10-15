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
    const provider = new PublicationProvider(mainFile);
    globalThis.fetch = provider.fetch;
    try {
      await store.pool.query(
        await readFile('lib/music/migrations/private.sql', 'utf8')
      );
      const revision = await store.save(null, emptyCatalog);
      const first = await publishMusic(revision.id);
      assert.equal(first.status, 'failed');
      const created = provider.pr as MockPullRequest | null;
      assert.ok(created);
      assert.equal(
        provider.commits.get(first.proposalCommit!)?.message.split('\n')[0],
        'feat(music): Republish the music collection'
      );
      assert.match(created.title, /^feat\(music\):/);
      assert.match(created.body, new RegExp(`Music-Revision: ${revision.id}`));
      const recovered = await publishMusic(revision.id);
      assert.equal(recovered.id, first.id);
      assert.equal(recovered.status, 'publishing');
      assert.equal(recovered.pullRequestNumber, 1);
      provider.main = 'b'.repeat(40);
      const rebased = await publishMusic(revision.id);
      assert.equal(rebased.status, 'publishing');
      assert.equal(provider.rebases, 1);
      assert.equal(
        (await store.pool.query('SELECT body FROM music_publications')).rows[0]
          .body.rebase,
        null
      );
      provider.ready = true;
      const merged = await publishMusic(revision.id);
      assert.equal(merged.status, 'deploying');
      assert.equal(provider.merges, 1);
      assert.equal(
        (await musicPublicationStatus(first.id)).status,
        'deploying'
      );
      provider.proof = {
        revisionId: revision.id,
        sourceSha: merged.sourceSha,
        commit: merged.commit,
      };
      assert.equal((await musicPublicationStatus(first.id)).status, 'live');
      assert.equal((await publishMusic(revision.id)).status, 'live');
      assert.equal(provider.merges, 1);
    } finally {
      await store.pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  }
);

const ok = (data: unknown) => Response.json(data);
const missing = () => Response.json({}, { status: 404 });
const requestBody = <T,>(init: RequestInit) =>
  JSON.parse(String(init.body)) as T;
class PublicationProvider {
  main = 'a'.repeat(40);
  ready = false;
  loseResponse = true;
  rebases = 0;
  merges = 0;
  pr: MockPullRequest | null = null;
  proof: Record<string, unknown> = {};
  refs = new Map<string, string>();
  commits = new Map<string, MockCommit>();
  trees = new Map<string, MockTreeRequest>();
  constructor(readonly mainFile: string | null) {}
  fetch: typeof fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.hostname === 'public.test') return Response.json(this.proof);
    const path = decodeURIComponent(
        url.pathname.replace('/repos/owner/site/', '')
      ),
      method = init.method ?? 'GET';
    if (url.pathname === '/graphql') return this.rebaseBranch(init);
    const contentResponse = this.repositoryContent(path);
    if (contentResponse) return contentResponse;
    const gitResponse = this.gitRequest(path, method, init);
    if (gitResponse) return gitResponse;
    const pullResponse = this.pullRequest(path, method, init);
    if (pullResponse) return pullResponse;
    const checkResponse = this.checks(path, init);
    if (checkResponse) return checkResponse;
    if (path === 'pulls/1/merge') return this.mergeProposal(init);
    throw new Error(`Unexpected mock path ${path}`);
  };
  repositoryContent(path: string) {
    if (path === '') return ok({ node_id: 'repo' });
    if (path === 'git/ref/heads/main')
      return ok({ object: { sha: this.main } });
    if (path.startsWith('contents/'))
      return ok({
        sha: this.mainFile,
        encoding: 'base64',
        content: Buffer.from(
          JSON.stringify({ revisionId: null, catalog: emptyCatalog })
        ).toString('base64'),
      });
  }
  rebaseBranch(init: RequestInit) {
    const update = requestBody<{
      variables: {
        input: {
          refUpdates: {
            name: string;
            beforeOid: string;
            afterOid: string;
          }[];
        };
      };
    }>(init).variables.input.refUpdates[0];
    const branch = update.name.replace('refs/heads/', '');
    assert.equal(this.refs.get(branch), update.beforeOid);
    this.refs.set(branch, update.afterOid);
    this.rebases++;
    if (this.pr) this.pr.head.sha = update.afterOid;
    return ok({ data: { updateRefs: {} } });
  }
  gitRequest(path: string, method: string, init: RequestInit) {
    if (path.startsWith('git/ref/heads/')) {
      const value = this.refs.get(path.slice(14));
      return value ? ok({ object: { sha: value } }) : missing();
    }
    if (path === 'git/refs') {
      const request = requestBody<{ ref: string; sha: string }>(init);
      this.refs.set(request.ref.replace('refs/heads/', ''), request.sha);
      return ok({});
    }
    if (path === 'git/trees') {
      const request = requestBody<MockTreeRequest>(init);
      assert.equal(request.tree.length, 1);
      assert.equal(request.tree[0].path, 'content/music/catalog.json');
      const sha = createHash('sha1')
        .update(JSON.stringify(request))
        .digest('hex');
      this.trees.set(sha, request);
      return ok({ sha });
    }
    if (path === 'git/commits' && method === 'POST') {
      const request = requestBody<MockCommitRequest>(init);
      const sha = createHash('sha1')
        .update(JSON.stringify(request))
        .digest('hex');
      this.commits.set(sha, {
        ...request,
        sha,
        parents: request.parents.map((sha: string) => ({ sha })),
      });
      return ok({ sha });
    }
    if (path.startsWith('git/commits/'))
      return ok(
        this.commits.get(path.slice(12)) ?? {
          tree: { sha: 'base-tree' },
          parents: [],
        }
      );
  }
  pullRequest(path: string, method: string, init: RequestInit) {
    if (path === 'pulls' && method === 'GET')
      return ok(this.pr ? [this.pr] : []);
    if (path === 'pulls' && method === 'POST') {
      const request = requestBody<{
        title: string;
        body: string;
        head: string;
      }>(init);
      const head = this.refs.get(request.head);
      assert.ok(head);
      this.pr = {
        number: 1,
        html_url: 'https://github.com/owner/site/pull/1',
        title: request.title,
        body: request.body,
        state: 'open',
        head: { sha: head },
        base: { sha: this.main },
        merged: false,
      };
      if (this.loseResponse) {
        this.loseResponse = false;
        throw new Error('Lost after creating PR');
      }
      return ok(this.pr);
    }
    if (path === 'pulls/1')
      return ok({
        ...this.pr,
        base: { sha: this.main },
        mergeable: this.ready,
        mergeable_state: this.ready ? 'unstable' : 'unknown',
      });
  }
  checks(path: string, init: RequestInit) {
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
            status: this.ready ? 'completed' : 'in_progress',
            conclusion: this.ready ? 'success' : null,
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
  }
  mergeProposal(init: RequestInit) {
    const request = requestBody<{ merge_method: string; sha: string }>(init);
    assert.ok(this.pr);
    assert.equal(request.merge_method, 'rebase');
    assert.equal(request.sha, this.pr.head.sha);
    this.merges++;
    this.pr.merged = true;
    this.pr.merge_commit_sha = 'f'.repeat(40);
    this.main = this.pr.merge_commit_sha;
    return ok({ merged: true, sha: this.main });
  }
}
