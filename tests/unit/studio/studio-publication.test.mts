import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Pool } from 'pg';

import {
  approveProposal,
  parseComponent,
} from '../../../lib/studio/components.ts';
import { documentSource } from '../../../lib/studio/document.ts';
import {
  preparePublicationPreview,
  publicationStatus,
  publishRevision,
} from '../../../lib/studio/publication.ts';
import { safeReadingHtml } from '../../../lib/studio/reading.ts';
import { getStudioPool, getStudioStore } from '../../../lib/studio/store.ts';

test(
  'publication exports the selected revision atomically, retries idempotently and verifies actual deployment',
  { skip: !process.env.STUDIO_TEST_DATABASE_URL },
  async () => {
    const admin = new Pool({
        connectionString: process.env.STUDIO_TEST_DATABASE_URL,
      }),
      schema = `studio_publication_${randomUUID().replaceAll('-', '')}`;
    await admin.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(process.env.STUDIO_TEST_DATABASE_URL!);
    url.searchParams.set('options', `-c search_path=${schema}`);
    process.env.STUDIO_DATABASE_URL = url.href;
    const pool = getStudioPool(),
      original = globalThis.fetch;
    try {
      await pool.query(
        await readFile(
          new URL('../../../lib/db/migrations/005_studio.sql', import.meta.url),
          'utf8'
        )
      );
      Object.assign(process.env, {
        STUDIO_GITHUB_REPOSITORY: 'owner/site',
        STUDIO_GITHUB_BRANCH: 'main',
        STUDIO_GITHUB_TOKEN: 'test-only',
        STUDIO_PUBLIC_ORIGIN: 'https://public.example',
      });
      const store = getStudioStore(),
        draft = await store.create('selected-revision', {
          title: 'Selected title',
          description: 'A note',
          postType: 'note',
          tags: [],
          document: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Selected source.' }],
              },
            ],
          },
        });
      const newer = await store.save(draft.id, draft.head.id, {
        ...draft.head.body,
        title: 'Newer private title',
      });
      let head = 'a'.repeat(40),
        fileSha: string | undefined,
        writeCount = 0,
        source = '',
        marker = { revisionId: 'other', commit: 'other', sourceSha: 'other' };
      const branches = new Map<string, string>();
      const pulls = new Map<number, Record<string, unknown>>();
      let checksReady = false,
        prCount = 0,
        mergeCount = 0,
        failCreateResponse = false,
        failBranchResponse = false,
        failMergeResponse = false,
        failRebaseResponse = false,
        failedChecks = false,
        rebaseCount = 0;
      const history: { sha: string; commit: { message: string } }[] = [];
      function writeTree(init?: RequestInit): Response {
        const body = JSON.parse(String(init?.body));

        const writing = body.tree.find(
          (entry: { path: string }) =>
            entry.path === 'content/writings/selected-revision.mdx'
        );
        assert.ok(writing);
        if (writing.content !== undefined) source = writing.content;
        for (const entry of body.tree.filter(
          (entry: { path: string }) =>
            entry.path !== 'content/writings/selected-revision.mdx'
        )) {
          assert.match(entry.path, /^public\/generated-blocks\//);
          assert.match(entry.content, /connect-src 'none'/);
          assert.doesNotMatch(entry.content, /\/api\/studio\/assets\//);
        }
        return Response.json({ sha: 'tree-new' });
      }
      function writeCommit(init?: RequestInit): Response {
        const body = JSON.parse(String(init?.body));

        assert.equal(
          body.author.name,
          process.env.STUDIO_GITHUB_AUTHOR_NAME || 'WillieChalmers'
        );
        assert.equal(
          body.author.email,
          process.env.STUDIO_GITHUB_AUTHOR_EMAIL ||
            '16641570+WillieCubed@users.noreply.github.com'
        );
        assert.deepEqual(body.author, body.committer);
        writeCount++;
        history.unshift({
          sha: String(writeCount).repeat(40),
          commit: { message: body.message },
        });
        return Response.json({ sha: history[0].sha });
      }
      function createBranch(init?: RequestInit): Response {
        const body = JSON.parse(String(init?.body));

        assert.match(body.ref, /^refs\/heads\/codex\/studio-publish-/);
        branches.set(body.ref.replace('refs/heads/', ''), body.sha);
        if (failBranchResponse) {
          failBranchResponse = false;
          throw new Error('Connection lost after branch creation');
        }
        return Response.json({ object: { sha: body.sha } });
      }
      function createPull(init?: RequestInit): Response {
        const body = JSON.parse(String(init?.body));

        prCount++;
        assert.match(
          body.body,
          /## TL;DR[\s\S]*## Changes[\s\S]*## Verification[\s\S]*## Follow-ups and Next Work/
        );
        assert.doesNotMatch(body.body, /<!--/);
        const pr = {
          number: prCount,
          html_url: `https://github.com/owner/site/pull/${prCount}`,
          head: { sha: branches.get(body.head), ref: body.head },
          base: { sha: head },
          state: 'open',
          mergeable: true,
          mergeable_state: 'clean',
        };
        pulls.set(prCount, pr);
        if (failCreateResponse) {
          failCreateResponse = false;
          throw new Error('Connection lost after PR created');
        }
        return Response.json(pr);
      }
      function mergePull(path: string, init?: RequestInit): Response {
        const body = JSON.parse(String(init?.body));

        assert.equal(body.merge_method, 'rebase');
        const pr = pulls.get(Number(path.split('/')[1]))!;
        assert.equal(body.sha, (pr.head as { sha: string }).sha);
        mergeCount++;
        head = (mergeCount + 5).toString(16).repeat(40);
        Object.assign(pr, {
          merged: true,
          merge_commit_sha: head,
          state: 'closed',
        });
        branches.delete((pr.head as { ref: string }).ref);
        fileSha = createHash('sha1')
          .update(`blob ${Buffer.byteLength(source)}\0`)
          .update(source)
          .digest('hex');
        if (failMergeResponse) {
          failMergeResponse = false;
          throw new Error('Connection lost after merge');
        }
        return Response.json({ merged: true, sha: head });
      }
      function updatePrivateBranch(path: string, init: RequestInit): Response {
        const update = JSON.parse(String(init.body));
        assert.equal(update.force, true);
        assert.match(
          decodeURIComponent(path),
          /^git\/refs\/heads\/codex\/studio-publish-/
        );
        const branch = decodeURIComponent(path.replace('git/refs/heads/', ''));
        const pr = [...pulls.values()].find(
          (pr) => (pr.head as { ref: string }).ref === branch
        )!;
        assert.equal(branches.get(branch), (pr.head as { sha: string }).sha);
        branches.set(branch, update.sha);
        Object.assign(pr, {
          head: { ref: branch, sha: update.sha },
          base: { sha: head },
        });
        rebaseCount++;
        if (failRebaseResponse) {
          failRebaseResponse = false;
          throw new Error('Connection lost after ref update');
        }
        return Response.json({ object: { sha: update.sha } });
      }
      function readPulls(
        path: string,
        endpoint: URL,
        init?: RequestInit
      ): Response | undefined {
        if (path === 'pulls' && init?.body == null) {
          const branch = endpoint.searchParams.get('head')!.split(':')[1];
          return Response.json(
            [...pulls.values()].filter(
              (pr) => (pr.head as { ref: string }).ref === branch
            )
          );
        }
        if (/^pulls\/\d+$/.test(path)) {
          const pr = pulls.get(Number(path.split('/')[1]))!;
          return Response.json({
            ...pr,
            mergeable_state: failedChecks
              ? 'unstable'
              : checksReady
                ? 'clean'
                : 'blocked',
          });
        }
      }
      function readGit(path: string, init?: RequestInit): Response | undefined {
        if (path === 'commits') return Response.json(history);
        if (path.startsWith('compare/'))
          return Response.json({ status: 'ahead' });
        if (init?.body != null) return undefined;
        if (path.startsWith('git/commits/'))
          return Response.json({
            tree: { sha: 'tree-base' },
            message: history.find((commit) => path.endsWith(commit.sha))?.commit
              .message,
          });
        if (path.startsWith('git/trees/'))
          return Response.json({
            truncated: false,
            tree: fileSha
              ? [
                  {
                    path: 'content/writings/selected-revision.mdx',
                    sha: fileSha,
                  },
                ]
              : [],
          });
      }
      function mutateGithub(path: string, init?: RequestInit): Response {
        if (path === 'git/trees') return writeTree(init);
        if (path === 'git/commits') return writeCommit(init);
        if (path === 'git/refs') return createBranch(init);
        if (path === 'pulls') return createPull(init);
        if (/^pulls\/\d+\/merge$/.test(path)) return mergePull(path, init);
        throw new Error(`Unexpected request: ${path}`);
      }
      function readReference(path: string): Response | undefined {
        if (path === 'git/ref/heads/main')
          return Response.json({ object: { sha: head } });
        if (path.startsWith('git/ref/heads/codex')) {
          const sha = branches.get(
            decodeURIComponent(path.replace('git/ref/heads/', ''))
          );
          return sha
            ? Response.json({ object: { sha } })
            : Response.json({}, { status: 404 });
        }
      }
      globalThis.fetch = async (input, init) => {
        const endpoint = new URL(String(input)),
          path = endpoint.pathname.replace('/repos/owner/site/', '');
        if (endpoint.origin === 'https://public.example')
          return Response.json(marker);
        assert.equal(endpoint.origin, 'https://api.github.com');
        if (path.startsWith('git/refs/heads/codex') && init?.method === 'PATCH')
          return updatePrivateBranch(path, init);
        if (path === '') return Response.json({ node_id: 'repository-node' });
        const reference = readReference(path);
        if (reference) return reference;
        const readPullsResponse = readPulls(path, endpoint, init);
        if (readPullsResponse) return readPullsResponse;
        const readGitResponse = readGit(path, init);
        if (readGitResponse) return readGitResponse;
        return mutateGithub(path, init);
      };
      const published = await publishRevision(draft.id, draft.head.id);
      assert.equal(published.status, 'publishing');
      assert.equal(published.commit, null);
      assert.ok(published.proposalCommit);
      assert.equal(mergeCount, 0);
      checksReady = true;
      const merged = await publicationStatus(published.id);
      assert.equal(merged.status, 'deploying');
      assert.notEqual(merged.commit, merged.proposalCommit);
      assert.match(source, /Selected title/);
      assert.doesNotMatch(source, /Newer private title/);
      assert.match(source, new RegExp(draft.head.id));
      assert.equal(writeCount, 1);
      assert.equal(
        (await publishRevision(draft.id, draft.head.id)).id,
        published.id
      );
      assert.equal(writeCount, 1);
      assert.equal((await publicationStatus(published.id)).status, 'deploying');
      marker = {
        revisionId: draft.head.id,
        commit: merged.commit!,
        sourceSha: 'wrong-source-hash',
      };
      assert.equal((await publicationStatus(published.id)).status, 'deploying');
      marker.commit = 'e'.repeat(40); // A later deployment descended from the merged commit.
      assert.equal((await publicationStatus(published.id)).status, 'deploying');
      marker.sourceSha = merged.publishedFileSha!;
      assert.equal((await publicationStatus(published.id)).status, 'live');
      failCreateResponse = true;
      const interrupted = await publishRevision(draft.id, newer.head.id);
      assert.equal(interrupted.status, 'failed');
      assert.ok(interrupted.id);
      assert.equal(prCount, 2);
      const second = await publishRevision(draft.id, newer.head.id);
      assert.equal(prCount, 2);
      assert.equal(second.status, 'deploying');
      assert.match(source, /Newer private title/);
      assert.equal(writeCount, 2);
      const third = await store.save(draft.id, newer.head.id, {
        ...newer.head.body,
        title: 'Third revision',
      });
      const ownedSha = fileSha;
      fileSha = 'external-edit';
      assert.match(
        (await publishRevision(draft.id, third.head.id)).error!,
        /published source changed/
      );
      assert.equal(writeCount, 2);
      fileSha = ownedSha;
      const component = parseComponent(
        JSON.stringify({
          name: 'Counter',
          description: 'Counter',
          version: '1.0.0',
          source:
            'export default function Counter(){return <button>Count</button>}',
          portableHtml: '<p>Counter</p>',
          portableText: 'Counter',
          properties: {},
          example: {},
          accessibility: 'Native button.',
        })
      );
      await store.saveProposal(component);
      let blockDraft = await store.save(draft.id, third.head.id, {
        ...third.head.body,
        document: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'An interactive component.' }],
            },
            {
              type: 'catalogBlock',
              attrs: {
                id: component.id,
                version: component.version,
                props: {},
              },
            },
          ],
        },
      });
      assert.match(
        (await publishRevision(draft.id, blockDraft.head.id)).error!,
        /explicitly approved/
      );
      assert.equal(writeCount, 2);
      await approveProposal(component.id);
      // The reading overlay resolves approved portable metadata without publishing
      // or mutating the immutable stored revision.
      const prepared = await preparePublicationPreview(blockDraft.head.body);
      const reading = await safeReadingHtml(
        documentSource(prepared.document),
        '/writings/selected-revision'
      );
      assert.match(reading, /An interactive component/);
      assert.match(reading, /Counter/);
      assert.doesNotMatch(reading, /iframe|generated-blocks/);
      assert.equal(
        blockDraft.head.body.document.content?.[1].attrs?.portable,
        undefined
      );
      assert.equal(writeCount, 2);
      blockDraft = await store.save(draft.id, blockDraft.head.id, {
        ...blockDraft.head.body,
        document: {
          ...blockDraft.head.body.document,
          content: blockDraft.head.body.document.content!.map((node) =>
            node.type === 'catalogBlock'
              ? {
                  ...node,
                  attrs: {
                    ...node.attrs,
                    portable: 'The counter currently shows five.',
                  },
                }
              : node
          ),
        },
      });
      const authoredPreview = await preparePublicationPreview(
        blockDraft.head.body
      );
      assert.equal(
        authoredPreview.document.content?.[1].attrs?.portable,
        'The counter currently shows five.'
      );
      const blockPublication = await publishRevision(
        draft.id,
        blockDraft.head.id
      );
      assert.equal(blockPublication.status, 'deploying');
      assert.equal(writeCount, 3);
      assert.match(source, /StudioBlock/);
      assert.match(source, /generated-blocks/);
      const exportedAlternative = source.match(/ portable="([^"]*)"/)?.[1];
      assert.ok(exportedAlternative);
      assert.equal(
        Buffer.from(exportedAlternative, 'base64url').toString('utf8'),
        'The counter currently shows five.'
      );
      const assetId = randomUUID(),
        privateUrl = `/api/studio/assets/${assetId}`,
        publicUrl = 'https://media.example/published.png';
      const media = parseComponent(
        JSON.stringify({
          name: 'Media',
          description: 'Media',
          version: '1.0.0',
          source:
            'export default function Media(props){return <p>{props.url}</p>}',
          portableHtml: '<p>A descriptive image</p>',
          portableText: `![A descriptive image](${privateUrl})`,
          properties: {
            url: { type: 'string', required: true, description: 'Media URL' },
          },
          example: { url: privateUrl },
          accessibility: 'Descriptive image alternative.',
        })
      );
      await store.saveProposal({ ...media, status: 'approved' });
      const mediaDraft = await store.save(draft.id, blockDraft.head.id, {
        ...blockDraft.head.body,
        document: {
          type: 'doc',
          content: [
            {
              type: 'catalogBlock',
              attrs: {
                id: media.id,
                version: media.version,
                props: { url: privateUrl },
              },
            },
          ],
        },
      });
      const mediaJob = await store.publication(draft.id, mediaDraft.head.id);
      await pool.query(
        'INSERT INTO studio_assets(id,pathname,content_type,original_name) VALUES($1,$2,$3,$4)',
        [assetId, 'fixture.png', 'image/png', 'fixture.png']
      );
      await pool.query(
        'INSERT INTO studio_asset_promotions(publication_id,asset_id,public_url) VALUES($1,$2,$3)',
        [mediaJob.id, assetId, publicUrl]
      );
      const mediaPublication = await publishRevision(
        draft.id,
        mediaDraft.head.id
      );
      assert.equal(mediaPublication.status, 'deploying');
      assert.equal(writeCount, 4);
      marker = {
        revisionId: mediaDraft.head.id,
        commit: mediaPublication.commit!,
        sourceSha: mediaPublication.publishedFileSha!,
      };
      assert.equal(
        (await publicationStatus(mediaPublication.id)).status,
        'live'
      );
      assert.match(
        (await publishRevision(draft.id, third.head.id)).error!,
        /Restore this earlier revision/
      );
      assert.equal(writeCount, 4);
      const conflictDraft = await store.save(draft.id, mediaDraft.head.id, {
        ...draft.head.body,
        title: 'Concurrent source test',
      });
      checksReady = false;
      const waiting = await publishRevision(draft.id, conflictDraft.head.id);
      assert.equal(waiting.status, 'publishing');
      const beforeConflict = fileSha;
      fileSha = 'external-change-after-proposal';
      checksReady = true;
      const conflict = await publicationStatus(waiting.id);
      assert.equal(conflict.status, 'failed');
      assert.match(conflict.error!, /published source changed/);
      assert.equal(mergeCount, 4);
      fileSha = beforeConflict;
      failMergeResponse = true;
      const lostMergeResponse = await publishRevision(
        draft.id,
        conflictDraft.head.id
      );
      assert.equal(lostMergeResponse.status, 'failed');
      const recoveredMerge = await publishRevision(
        draft.id,
        conflictDraft.head.id
      );
      assert.equal(recoveredMerge.status, 'deploying');
      assert.equal(mergeCount, 5);
      assert.equal(prCount, 5);
      const afterMerge = await store.save(draft.id, conflictDraft.head.id, {
        ...draft.head.body,
        title: 'Branch retry test',
      });
      failBranchResponse = true;
      const interruptedBranch = await publishRevision(
        draft.id,
        afterMerge.head.id
      );
      assert.equal(interruptedBranch.status, 'failed');
      assert.ok(interruptedBranch.proposalCommit);
      assert.equal(writeCount, 6);
      const recoveredBranch = await publishRevision(
        draft.id,
        afterMerge.head.id
      );
      assert.equal(recoveredBranch.status, 'deploying');
      assert.equal(writeCount, 6);
      assert.equal(prCount, 6);
      const rebaseDraft = await store.save(draft.id, afterMerge.head.id, {
        ...draft.head.body,
        title: 'Same artifacts after unrelated main update',
      });
      checksReady = false;
      const beforeRebase = await publishRevision(draft.id, rebaseDraft.head.id);
      assert.equal(beforeRebase.status, 'publishing');
      const reviewedSha = beforeRebase.proposalCommit;
      head = 'f'.repeat(40); // Another post changed; this source blob is unchanged.
      failRebaseResponse = true;
      const interruptedRebase = await publicationStatus(beforeRebase.id);
      assert.equal(interruptedRebase.status, 'failed');
      assert.equal(rebaseCount, 1);
      const afterRebase = await publishRevision(draft.id, rebaseDraft.head.id);
      assert.equal(afterRebase.status, 'publishing');
      assert.notEqual(afterRebase.proposalCommit, reviewedSha);
      assert.deepEqual(
        afterRebase.artifactManifest,
        beforeRebase.artifactManifest
      );
      assert.equal(
        afterRebase.pullRequestNumber,
        beforeRebase.pullRequestNumber
      );
      assert.equal(rebaseCount, 1);
      assert.equal(writeCount, 8);
      checksReady = true;
      assert.equal(
        (await publicationStatus(beforeRebase.id)).status,
        'deploying'
      );
      assert.equal(prCount, 7);
      const failedDraft = await store.save(draft.id, rebaseDraft.head.id, {
        ...draft.head.body,
        title: 'Terminal checks test',
      });
      failedChecks = true;
      const failed = await publishRevision(draft.id, failedDraft.head.id);
      assert.equal(failed.status, 'publishing');
      assert.equal(mergeCount, 7);
      assert.equal(
        failed.pullRequestUrl,
        'https://github.com/owner/site/pull/8'
      );
      failedChecks = false; // Maintainer reran the checks on GitHub.
      assert.equal(
        (await publishRevision(draft.id, failedDraft.head.id)).status,
        'deploying'
      );
      assert.equal(prCount, 8);
    } finally {
      globalThis.fetch = original;
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  }
);
