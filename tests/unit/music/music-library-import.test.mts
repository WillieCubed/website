import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MusicAdminRequestError,
  musicAdminRequest,
} from '../../../components/music/music-admin-request';
import {
  type MusicLibraryImportServices,
  importMusicLibrary,
} from '../../../components/music/music-library-import';
import type { MusicImportProgress } from '../../../lib/music/types';

const startedAt = Date.parse('2026-10-15T12:00:00.000Z');
const completedProgress: MusicImportProgress = {
  total: 3,
  done: 2,
  failed: 1,
  running: false,
  updatedAt: '2026-10-15T12:00:01.000Z',
};

function lostResponse(
  progress: MusicImportProgress | null | undefined,
  failure: Error = new TypeError('The import response was lost.')
) {
  const calls: string[] = [];
  const services: MusicLibraryImportServices = {
    now: () => startedAt,
    async startImport() {
      calls.push('import');
      throw failure;
    },
    async readProgress() {
      calls.push('progress');
      return progress;
    },
  };
  return { services, failure, calls };
}

test('a received import result does not trigger a progress recovery request', async () => {
  const outcome = { failed: 2 };
  const result = await importMusicLibrary({
    now: () => startedAt,
    startImport: async () => outcome,
    readProgress: async () => {
      assert.fail('A successful import needs no recovery request.');
    },
  });
  assert.equal(result, outcome);
});

test('an HTTP import rejection never adopts even fresh completed progress', async () => {
  const rejected = new MusicAdminRequestError('Already importing.', 409);
  const run = lostResponse(completedProgress, rejected);
  await assert.rejects(
    importMusicLibrary(run.services),
    (error) => error === rejected
  );
  assert.deepEqual(run.calls, ['import']);
});

test("a lost import response uses the same run's complete saved progress", async () => {
  const run = lostResponse(completedProgress);
  assert.equal(await importMusicLibrary(run.services), completedProgress);
  assert.deepEqual(run.calls, ['import', 'progress']);
});

const unavailableProgress: {
  name: string;
  progress: MusicImportProgress | null | undefined;
}[] = [
  { name: 'missing progress', progress: undefined },
  { name: 'no retained progress', progress: null },
  {
    name: 'an import still running',
    progress: { ...completedProgress, running: true },
  },
  {
    name: 'an older completed run',
    progress: { ...completedProgress, updatedAt: '2026-10-15T11:59:59.999Z' },
  },
  {
    name: 'progress without a valid completion time',
    progress: { ...completedProgress, updatedAt: 'not a date' },
  },
  {
    name: 'an import with unaccounted playlists',
    progress: { ...completedProgress, total: 4 },
  },
];
for (const { name, progress } of unavailableProgress) {
  test(`a lost response retains its original error for ${name}`, async () => {
    const run = lostResponse(progress);
    await assert.rejects(
      importMusicLibrary(run.services),
      (error) => error === run.failure
    );
    assert.deepEqual(run.calls, ['import', 'progress']);
  });
}

test('completion at the request timestamp remains eligible for recovery', async () => {
  const progress = {
    ...completedProgress,
    updatedAt: new Date(startedAt).toISOString(),
  };
  const run = lostResponse(progress);
  assert.equal(await importMusicLibrary(run.services), progress);
});

test('failed playlists count as accounted for without being reported as successes', async () => {
  const progress = { ...completedProgress, done: 0, failed: 3 };
  const run = lostResponse(progress);
  assert.equal((await importMusicLibrary(run.services)).failed, 3);
});

test('a completed empty library can recover its lost response', async () => {
  const progress = { ...completedProgress, total: 0, done: 0, failed: 0 };
  const run = lostResponse(progress);
  assert.equal(await importMusicLibrary(run.services), progress);
});

test('a failed progress recheck exposes that failure instead of claiming completion', async () => {
  const run = lostResponse(completedProgress);
  const unavailable = new Error('Connection progress is unavailable.');
  run.services.readProgress = async () => {
    throw unavailable;
  };
  await assert.rejects(
    importMusicLibrary(run.services),
    (error) => error === unavailable
  );
});

async function withFetch(
  fetcher: typeof fetch,
  check: () => Promise<void>
): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = fetcher;
  try {
    await check();
  } finally {
    globalThis.fetch = original;
  }
}

test('Music HTTP errors retain their status, provider details, and error message', async () => {
  await withFetch(
    async () =>
      Response.json(
        { error: 'Provider refused.', details: { retryAfter: 60 } },
        { status: 429 }
      ),
    async () => {
      await assert.rejects(musicAdminRequest('/import'), (error) => {
        assert(error instanceof MusicAdminRequestError);
        assert.equal(error.status, 429);
        assert.equal(error.message, 'Provider refused.');
        assert.deepEqual(error.details, { retryAfter: 60 });
        return true;
      });
    }
  );
});

for (const response of [
  () =>
    new Response('<html>Unavailable</html>', {
      status: 502,
      headers: { 'content-type': 'text/html' },
    }),
  () =>
    new Response('{', {
      status: 503,
      headers: { 'content-type': 'application/json' },
    }),
]) {
  test(`an unreadable HTTP ${response().status} response is still a known request failure`, async () => {
    await withFetch(
      async () => response(),
      async () => {
        await assert.rejects(musicAdminRequest('/import'), (error) => {
          assert(error instanceof MusicAdminRequestError);
          assert.equal(error.status, response().status);
          return true;
        });
      }
    );
  });
}

test('a transport loss keeps its identity so import progress can recover it', async () => {
  const lost = new TypeError('Connection closed.');
  await withFetch(
    async () => {
      throw lost;
    },
    async () => {
      await assert.rejects(
        musicAdminRequest('/import'),
        (error) => error === lost
      );
    }
  );
});

test('a successful Music request preserves its URL, options, headers, and JSON data', async () => {
  await withFetch(
    async (input, init) => {
      assert.equal(input, '/api/studio/music/import');
      assert.equal(init?.method, 'POST');
      assert.equal(
        new Headers(init?.headers).get('content-type'),
        'application/json'
      );
      assert.equal(new Headers(init?.headers).get('x-fixture'), 'offline');
      assert(init?.signal);
      return Response.json({ failed: 1 });
    },
    async () => {
      assert.deepEqual(
        await musicAdminRequest('/import', {
          method: 'POST',
          headers: { 'X-Fixture': 'offline' },
        }),
        { failed: 1 }
      );
    }
  );
});
