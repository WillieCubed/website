import assert from 'node:assert/strict';

type WaitUntil = (
  name: string,
  test: () => Promise<boolean>,
  seconds?: number
) => Promise<void>;
export async function verifyVideoCdn(
  indexedPlaylist: string,
  until: WaitUntil
) {
  const cdnDeadline = AbortSignal.timeout(240000);
  let readyResources: { playlists: number; segments: number } | undefined;
  let lastCdnFailure = 'No successful CDN response.';
  await until('actual video CDN playlists and segments', async () => {
    try {
      const { playlists, assets } = await playlistGraph(
        indexedPlaylist,
        cdnDeadline
      );
      await verifySegments(assets, cdnDeadline);
      readyResources = { playlists: playlists.size, segments: assets.size };
      return true;
    } catch (error) {
      lastCdnFailure =
        error instanceof Error ? error.message : 'CDN fetch failed.';
      cdnDeadline.throwIfAborted();
      return false;
    }
  }).catch((error) => {
    throw new Error(`Video CDN readiness failed: ${lastCdnFailure}`, {
      cause: error,
    });
  });
  return readyResources;
}

async function playlistGraph(
  indexedPlaylist: string,
  cdnDeadline: AbortSignal
) {
  const pending = [indexedPlaylist];
  const playlists = new Set<string>();
  const assets = new Set<string>();
  while (pending.length > 0) {
    const url = new URL(pending.shift()!);
    assert.equal(url.protocol, 'https:');
    if (playlists.has(url.href)) continue;
    assert(playlists.size < 32, 'Unexpected video playlist graph.');
    playlists.add(url.href);
    const response = await fetch(url, {
      signal: AbortSignal.any([cdnDeadline, AbortSignal.timeout(10000)]),
    });
    if (response.status !== 200) await response.body?.cancel();
    assert.equal(
      response.status,
      200,
      `Video playlist HTTP ${response.status}.`
    );
    const lines = (await response.text())
      .split(/\r?\n/)
      .map((line) => line.trim());
    assert.equal(lines[0], '#EXTM3U');
    const references = lines.filter(
      (line) => line.length > 0 && !line.startsWith('#')
    );
    assert(references.length > 0, 'The CDN playlist has no media references.');
    collectPlaylistReferences(lines, references, response.url, pending, assets);
  }
  return { playlists, assets };
}
async function verifySegments(assets: Set<string>, cdnDeadline: AbortSignal) {
  assert(assets.size > 0 && assets.size <= 64);
  for (const asset of assets) {
    assert.equal(new URL(asset).protocol, 'https:');
    const response = await fetch(asset, {
      headers: { range: 'bytes=0-1023' },
      signal: AbortSignal.any([cdnDeadline, AbortSignal.timeout(10000)]),
    });
    const reader = response.body?.getReader();
    try {
      assert(
        [200, 206].includes(response.status),
        `Video segment HTTP ${response.status}.`
      );
      const first = await reader?.read();
      assert(
        (first?.value?.byteLength ?? 0) > 0,
        'The CDN segment returned no bytes.'
      );
    } finally {
      await reader?.cancel().catch(() => {});
      reader?.releaseLock();
    }
  }
}

function collectPlaylistReferences(
  lines: string[],
  references: string[],
  responseUrl: string,
  pending: string[],
  assets: Set<string>
) {
  if (lines.some((line) => line.startsWith('#EXT-X-STREAM-INF:'))) {
    pending.push(
      ...references.map((reference) => new URL(reference, responseUrl).href)
    );
    for (const line of lines.filter((line) =>
      line.startsWith('#EXT-X-MEDIA:')
    )) {
      const uri = /(?:[:,])URI="([^"]+)"/.exec(line)?.[1];
      if (uri) pending.push(new URL(uri, responseUrl).href);
    }
  } else {
    assert(
      lines.includes('#EXT-X-ENDLIST'),
      'The fixture video is not yet complete.'
    );
    for (const reference of references)
      assets.add(new URL(reference, responseUrl).href);
    for (const line of lines.filter((line) => line.startsWith('#EXT-X-MAP:'))) {
      const uri = /(?:[:,])URI="([^"]+)"/.exec(line)?.[1];
      assert(uri);
      assets.add(new URL(uri, responseUrl).href);
    }
  }
}
