import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Pool } from 'pg';

import {
  createGeneration,
  dispatchGeneration,
  generationAction,
  queueGeneration,
  requireComponentGeneration,
  runtimeSelection,
  selectRuntime,
} from '../../../lib/studio/lattice.ts';
import { seal } from '../../../lib/studio/oauth.ts';
import { getStudioPool, getStudioStore } from '../../../lib/studio/store.ts';

const widgetPackage = JSON.stringify({
  name: 'CounterWidget',
  description: 'An interactive counter.',
  version: '1.0.0',
  source:
    'export default function CounterWidget() { return <output>0</output>; }',
  portableHtml: '<p>0</p>',
  portableText: '0',
  properties: {},
  example: {},
  accessibility: 'A semantic count with a static equivalent.',
});

test(
  'personal-runtime proposals persist while unavailable, retry explicitly and never overwrite later edits',
  { skip: !process.env.STUDIO_TEST_DATABASE_URL },
  async () => {
    const admin = new Pool({
        connectionString: process.env.STUDIO_TEST_DATABASE_URL,
      }),
      schema = `studio_lattice_${randomUUID().replaceAll('-', '')}`;
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
      await pool.query(
        await readFile(
          new URL(
            '../../../lib/db/migrations/006_studio_lattice.sql',
            import.meta.url
          ),
          'utf8'
        )
      );
      process.env.STUDIO_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString(
        'base64'
      );
      process.env.STUDIO_LATTICE_GATEWAY = 'https://lattice.example';
      delete process.env.STUDIO_LATTICE_RUNTIME_ID;
      assert.deepEqual(await runtimeSelection(), {
        connected: false,
        devices: [],
        selectedRuntimeId: null,
      });
      const devices = [
        {
          latticeId: 'runtime-mine',
          displayName: 'My Laptop',
          status: 'reachable',
        },
        {
          latticeId: 'runtime-offline',
          displayName: 'Home Computer',
          status: 'offline',
        },
        {
          latticeId: 'runtime-revoked',
          displayName: 'Old Computer',
          status: 'revoked',
        },
      ];
      let dispatchFetch: typeof fetch = async () => {
        throw new Error('Unexpected inference dispatch');
      };
      globalThis.fetch = async (input, init) => {
        if (String(input).endsWith('/v1/personal-runtimes')) {
          assert.equal(
            new Headers(init?.headers).get('authorization'),
            'Bearer user-token'
          );
          return Response.json({ runtimes: devices });
        }
        return dispatchFetch(input, init);
      };
      await pool.query(
        "INSERT INTO studio_connections(id,credential) VALUES('lattice',$1)",
        [
          seal({
            accessToken: 'user-token',
            refreshToken: null,
            expiresAt: Date.now() + 3600_000,
          }),
        ]
      );
      const choices = await runtimeSelection();
      assert.equal(choices.connected, true);
      assert.equal(choices.selectedRuntimeId, null);
      assert.equal(choices.devices[0].name, 'My Laptop');
      await assert.rejects(selectRuntime('other-persons-device'), /authorized/);
      await assert.rejects(selectRuntime('runtime-revoked'), /authorized/);
      await selectRuntime('runtime-offline');
      assert.equal(
        (await runtimeSelection()).selectedRuntimeId,
        'runtime-offline'
      );
      await selectRuntime('runtime-mine');
      assert.equal(
        (await runtimeSelection()).selectedRuntimeId,
        'runtime-mine'
      );
      const store = getStudioStore(),
        draft = await store.create('personal-proposal', {
          title: 'PRIVATE_AUTHOR_TITLE',
          description: 'Test',
          postType: 'note',
          tags: [],
          document: { type: 'doc', content: [] },
        });
      await pool.query(
        "DELETE FROM studio_connections WHERE id='lattice-runtime'"
      );
      const unselected = await createGeneration({
        documentId: draft.id,
        revisionId: draft.head.id,
        kind: 'component',
        prompt: 'Keep this request until I choose a device',
      });
      assert.equal(unselected.status, 'waiting');
      await selectRuntime('runtime-offline');
      const offline = await createGeneration({
        documentId: draft.id,
        revisionId: draft.head.id,
        kind: 'component',
        prompt: 'Wait for my offline device',
      });
      assert.equal(offline.status, 'waiting');
      await selectRuntime('runtime-mine');
      let calls = 0;
      dispatchFetch = async (input, init) => {
        calls++;
        assert.match(String(input), /^https:\/\/lattice.example\//);
        assert.equal(
          new Headers(init?.headers).get('authorization'),
          'Bearer user-token'
        );
        const body = JSON.parse(String(init?.body));
        assert.match(JSON.stringify(body), /runtime-mine/);
        assert.match(body.input, /Reply with exactly one JSON object/);
        assert.match(body.input, /Build an interactive chart/);
        assert.equal(body.temperature, 0);
        assert.doesNotMatch(
          JSON.stringify(body),
          /PRIVATE_AUTHOR_TITLE|Source document/
        );
        return Response.json({ error: 'runtime_unreachable' }, { status: 409 });
      };
      const pending = await createGeneration({
        documentId: draft.id,
        revisionId: draft.head.id,
        kind: 'component',
        prompt: 'Build an interactive chart',
      });
      assert.equal(pending.status, 'waiting');
      assert.equal(calls, 1);
      assert.equal((await store.get(draft.id))!.head.id, draft.head.id);
      dispatchFetch = async () =>
        Response.json({
          taskId: 't',
          task: 'text_generation',
          providerId: 'personal',
          model: 'runtime',
          outputText: widgetPackage,
        });
      const validDispatch = dispatchFetch;
      dispatchFetch = async () =>
        Response.json({
          outputText: '```jsx\nexport default function Counter() {}\n```',
        });
      const malformed = await generationAction(
        pending.id,
        'retry',
        draft.head.id
      );
      assert.equal(malformed.status, 'failed');
      assert.match(malformed.error!, /valid JSON/);
      assert.equal(
        malformed.result,
        '```jsx\nexport default function Counter() {}\n```'
      );
      assert.ok(malformed.inferenceKey);
      assert.notEqual(malformed.inferenceKey, malformed.id);
      assert.equal((await store.get(draft.id))!.head.id, draft.head.id);
      dispatchFetch = async (input, init) => {
        assert.equal(
          new Headers(init?.headers).get('idempotency-key'),
          malformed.inferenceKey
        );
        return validDispatch(input, init);
      };
      const ready = await generationAction(pending.id, 'retry', draft.head.id);
      assert.equal(ready.status, 'ready');
      dispatchFetch = async () =>
        Response.json({
          outputText: JSON.stringify({
            ...JSON.parse(widgetPackage),
            source: 'export default function Broken() { return <span>0</p>; }',
          }),
        });
      const broken = await createGeneration({
        documentId: draft.id,
        revisionId: draft.head.id,
        kind: 'component',
        prompt: 'Build another counter',
      });
      assert.equal(broken.status, 'failed');
      assert.match(broken.error!, /valid TSX/);
      assert.ok(broken.result);
      assert.ok(broken.inferenceKey);
      assert.equal((await store.get(draft.id))!.head.id, draft.head.id);

      const edited = await store.save(draft.id, draft.head.id, {
        ...draft.head.body,
        title: 'An independent edit',
      });
      await assert.rejects(
        generationAction(ready.id, 'accept', edited.head.id),
        /approve a component/
      );
      assert.equal(
        (await store.get(draft.id))!.head.body.title,
        'An independent edit'
      );
      assert.equal((await store.getGeneration(ready.id))!.status, 'ready');
      const claimed = await store.generation({
        documentId: draft.id,
        revisionId: edited.head.id,
        kind: 'component',
        prompt: 'Build a widget',
      });
      let release!: () => void, started!: () => void;
      const gate = new Promise<void>((resolve) => {
          release = resolve;
        }),
        begin = new Promise<void>((resolve) => {
          started = resolve;
        });
      calls = 0;
      dispatchFetch = async () => {
        calls++;
        started();
        await gate;
        return Response.json({ outputText: widgetPackage });
      };
      const running = dispatchGeneration(claimed);
      await begin;
      const duplicate = await dispatchGeneration(claimed);
      assert.equal(duplicate.status, 'running');
      assert.equal(calls, 1);
      await assert.rejects(
        generationAction(claimed.id, 'retry', edited.head.id),
        /cannot be retried/
      );
      await generationAction(claimed.id, 'reject', edited.head.id);
      release();
      await running;
      assert.equal((await store.getGeneration(claimed.id))!.status, 'rejected');
      const interrupted = await store.generation({
        documentId: draft.id,
        revisionId: edited.head.id,
        kind: 'component',
        prompt: 'Build a chart',
      });
      await pool.query(
        'UPDATE studio_generations SET body=body || $2::jsonb WHERE id=$1',
        [
          interrupted.id,
          JSON.stringify({
            status: 'running',
            startedAt: new Date(Date.now() - 181_000).toISOString(),
          }),
        ]
      );
      dispatchFetch = async () => Response.json({ outputText: widgetPackage });
      assert.equal(
        (await generationAction(interrupted.id, 'retry', edited.head.id))
          .status,
        'ready'
      );
      assert.equal((await store.get(draft.id))!.head.id, edited.head.id);
      for (const kind of ['writing', 'selection', 'block']) {
        const legacy = await store.generation({
          documentId: draft.id,
          revisionId: edited.head.id,
          kind: kind as 'component',
          prompt: 'Legacy request',
        });
        await assert.rejects(dispatchGeneration(legacy), /components only/);
        await assert.rejects(
          generationAction(legacy.id, 'retry', edited.head.id),
          /components only/
        );
        await pool.query(
          'UPDATE studio_generations SET body=body || $2::jsonb WHERE id=$1',
          [
            legacy.id,
            JSON.stringify({ status: 'ready', result: 'Unwanted prose' }),
          ]
        );
        await assert.rejects(
          generationAction(legacy.id, 'accept', edited.head.id),
          /components only/
        );
        assert.equal((await store.get(draft.id))!.head.id, edited.head.id);
      }
    } finally {
      globalThis.fetch = original;
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  }
);

test('Lattice accepts widget implementations only, including direct and legacy dispatch calls', async () => {
  for (const kind of ['writing', 'selection', 'block', undefined, 'unknown']) {
    assert.throws(() => requireComponentGeneration(kind), /components only/);
    await assert.rejects(
      queueGeneration({
        kind,
        prompt: 'Request',
        documentId: 'missing',
        revisionId: 'missing',
      } as never),
      /components only/
    );
    await assert.rejects(
      dispatchGeneration({ kind } as never),
      /components only/
    );
  }
  assert.doesNotThrow(() => requireComponentGeneration('component'));
});
