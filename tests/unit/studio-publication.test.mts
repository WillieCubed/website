import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Pool } from 'pg';

import {
  approveProposal,
  parseComponent,
} from '../../lib/studio/components.ts';
import { documentSource } from '../../lib/studio/document.ts';
import {
  preparePublicationPreview,
  publicationStatus,
  publishRevision,
} from '../../lib/studio/publication.ts';
import { safeReadingHtml } from '../../lib/studio/reading.ts';
import { getStudioPool, getStudioStore } from '../../lib/studio/store.ts';

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
          new URL('../../lib/db/migrations/005_studio.sql', import.meta.url),
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
        marker = { revisionId: 'other', commit: 'other' };
      const history: { sha: string; commit: { message: string } }[] = [];
      globalThis.fetch = async (input, init) => {
        const endpoint = new URL(String(input)),
          path = endpoint.pathname.replace('/repos/owner/site/', '');
        if (endpoint.origin === 'https://public.example')
          return Response.json(marker);
        assert.equal(endpoint.origin, 'https://api.github.com');
        if (path === 'git/ref/heads/main')
          return Response.json({ object: { sha: head } });
        if (path === 'commits') return Response.json(history);
        if (path.startsWith('compare/'))
          return Response.json({ status: 'ahead' });
        if (path.startsWith('git/commits/') && !init?.body)
          return Response.json({ tree: { sha: 'tree-base' } });
        if (path.startsWith('git/trees/') && !init?.body)
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
        const body = JSON.parse(String(init?.body));
        if (path === 'git/trees') {
          const writing = body.tree.find(
            (entry: { path: string }) =>
              entry.path === 'content/writings/selected-revision.mdx'
          );
          assert.ok(writing);
          source = writing.content;
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
        if (path === 'git/commits') {
          writeCount++;
          history.unshift({
            sha: String(writeCount).repeat(40),
            commit: { message: body.message },
          });
          return Response.json({ sha: history[0].sha });
        }
        if (path === 'git/refs/heads/main') {
          assert.equal(body.force, false);
          head = body.sha;
          fileSha = createHash('sha1')
            .update(`blob ${Buffer.byteLength(source)}\0`)
            .update(source)
            .digest('hex');
          return Response.json({ object: { sha: head } });
        }
        throw new Error(`Unexpected request: ${path}`);
      };
      const published = await publishRevision(draft.id, draft.head.id);
      assert.equal(published.status, 'deploying');
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
      marker = { revisionId: draft.head.id, commit: published.commit! };
      assert.equal((await publicationStatus(published.id)).status, 'live');
      const second = await publishRevision(draft.id, newer.head.id);
      assert.equal(second.status, 'deploying');
      assert.match(source, /Newer private title/);
      assert.equal(writeCount, 2);
      const third = await store.save(draft.id, newer.head.id, {
        ...newer.head.body,
        title: 'Third revision',
      });
      const ownedSha = fileSha;
      fileSha = 'external-edit';
      await assert.rejects(
        publishRevision(draft.id, third.head.id),
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
      const blockDraft = await store.save(draft.id, third.head.id, {
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
      await assert.rejects(
        publishRevision(draft.id, blockDraft.head.id),
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
      const blockPublication = await publishRevision(
        draft.id,
        blockDraft.head.id
      );
      assert.equal(blockPublication.status, 'deploying');
      assert.equal(writeCount, 3);
      assert.match(source, /StudioBlock/);
      assert.match(source, /generated-blocks/);
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
      };
      assert.equal(
        (await publicationStatus(mediaPublication.id)).status,
        'live'
      );
      await assert.rejects(
        publishRevision(draft.id, third.head.id),
        /Restore this earlier revision/
      );
      assert.equal(writeCount, 4);
    } finally {
      globalThis.fetch = original;
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  }
);
