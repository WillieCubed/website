import { randomUUID } from 'node:crypto';

import { required } from '../studio/config';
import { StudioError } from '../studio/errors';
import { GitHubError, github } from '../studio/github';
import { approvedManifest, cacheApproved, suppressApproved } from './public';
import { matchesMusicProof, musicArtifact } from './publication-artifact';
import { musicPublicationMessage } from './publication-message';
import { parseCatalog } from './schema';
import { SpotifyClient } from './spotify/client';
import { importPlaylist } from './spotify/import';
import { accessToken } from './spotify/tokens';
import { musicStore } from './store';
import type { MusicPublication } from './types';
import { emptyCatalog } from './types';

type Publication = MusicPublication & {
  source?: string;
  message?: string;
  tree?: string;
  rebase?: { before: string; after: string; parent: string } | null;
};
const path = 'content/music/catalog.json';
async function githubCatalog(ref: string) {
  const file = await optional(
    `contents/${path}?ref=${encodeURIComponent(ref)}`
  );
  if (!file) return { sha: null, catalog: emptyCatalog };
  if (file.encoding !== 'base64' || typeof file.content !== 'string')
    throw new StudioError(
      502,
      'GitHub did not return the published collection.'
    );
  try {
    const source = JSON.parse(
      Buffer.from(file.content, 'base64').toString('utf8')
    );
    return { sha: file.sha as string, catalog: parseCatalog(source.catalog) };
  } catch {
    throw new StudioError(
      502,
      'GitHub returned an invalid published collection.'
    );
  }
}
async function get(id: string): Promise<Publication> {
  const row = (
    await musicStore().pool.query(
      'SELECT body FROM music_publications WHERE id=$1',
      [id]
    )
  ).rows[0];
  if (!row) throw new StudioError(404, 'Publication not found.');
  return row.body;
}
async function patch(id: string, value: Partial<Publication>) {
  await musicStore().pool.query(
    'UPDATE music_publications SET body=body||$2::jsonb WHERE id=$1',
    [id, JSON.stringify(value)]
  );
  return get(id);
}
async function optional(path: string): Promise<any> {
  try {
    return await github(path);
  } catch (e) {
    if (e instanceof GitHubError && e.githubStatus === 404) return null;
    throw e;
  }
}
async function fileSha(ref: string) {
  const file = await optional(
    `contents/${path}?ref=${encodeURIComponent(ref)}`
  );
  return file?.sha ?? null;
}
const message = (p: Publication) =>
  p.message ?? `feat(music): Publish collection ${p.revisionId}`;
async function makeCommit(p: Publication, base: string) {
  const parent = await github(`git/commits/${base}`);
  const tree = await github('git/trees', 'POST', {
    base_tree: (parent.tree as any).sha,
    tree: [{ path, mode: '100644', type: 'blob', content: p.source }],
  });
  const identity = {
    name: process.env.STUDIO_GITHUB_AUTHOR_NAME || 'WillieChalmers',
    email:
      process.env.STUDIO_GITHUB_AUTHOR_EMAIL ||
      '16641570+WillieCubed@users.noreply.github.com',
    date: p.createdAt,
  };
  const commit = await github('git/commits', 'POST', {
    message: message(p),
    tree: tree.sha,
    parents: [base],
    author: identity,
    committer: identity,
  });
  return String(commit.sha);
}
async function rebase(p: Publication, base: string) {
  if (!p.rebase) {
    const after = await makeCommit(p, base);
    p = await patch(p.id, {
      rebase: { before: p.proposalCommit!, after, parent: base },
    });
  }
  const ref = await github(`git/ref/heads/${encodeURIComponent(p.branch!)}`),
    current = (ref.object as any).sha;
  if (current !== p.rebase!.after) {
    if (current !== p.rebase!.before)
      throw new StudioError(
        409,
        'The publication branch changed outside Music. Review its pull request.'
      );
    const repo = await github('');
    const result = await github('$graphql', 'POST', {
      query:
        'mutation MusicRebase($input: UpdateRefsInput!) { updateRefs(input: $input) { clientMutationId } }',
      variables: {
        input: {
          repositoryId: repo.node_id,
          clientMutationId: `${p.id}:${base}`,
          refUpdates: [
            {
              name: `refs/heads/${p.branch}`,
              beforeOid: p.rebase!.before,
              afterOid: p.rebase!.after,
              force: true,
            },
          ],
        },
      },
    });
    if (result.errors)
      throw new StudioError(
        409,
        'GitHub could not rebase the publication. Retry.'
      );
  }
  return patch(p.id, {
    proposalCommit: p.rebase!.after,
    base: p.rebase!.parent,
    rebase: null,
  });
}
async function advance(p: Publication): Promise<Publication> {
  const branch = required('STUDIO_GITHUB_BRANCH');
  if (branch === p.branch || p.branch !== `codex/music-publish-${p.id}`)
    throw new StudioError(409, 'Invalid publication branch.');
  if (p.rebase) p = await rebase(p, p.rebase.parent);
  if (p.pullRequestNumber) {
    const existing = await github(`pulls/${p.pullRequestNumber}`);
    if (existing.merged) {
      if ((existing.head as any).sha !== p.proposalCommit)
        throw new StudioError(
          409,
          'The merged proposal changed outside Music.'
        );
      return patch(p.id, {
        status: 'deploying',
        commit: String(existing.merge_commit_sha),
        error: null,
      });
    }
  }
  const ref = await github(`git/ref/heads/${encodeURIComponent(branch)}`),
    base = (ref.object as any).sha;
  const currentSha = await fileSha(base);
  if (currentSha !== p.baseFileSha)
    throw new StudioError(
      409,
      'The published collection changed. Reload and review the current collection before publishing.'
    );
  if (!p.proposalCommit) {
    const existing = await optional(
      `git/ref/heads/${encodeURIComponent(p.branch!)}`
    );
    if (existing) {
      const commit = await github(`git/commits/${existing.object.sha}`);
      if (
        commit.message !== message(p) ||
        (await fileSha(existing.object.sha)) !== p.sourceSha
      )
        throw new StudioError(
          409,
          'The publication branch contains unexpected content.'
        );
      p = await patch(p.id, {
        proposalCommit: existing.object.sha,
        base: (commit.parents as any[])[0].sha,
      });
    } else {
      const commit = await makeCommit(p, base);
      p = await patch(p.id, { proposalCommit: commit, base });
    }
  }
  let branchRef = await optional(
    `git/ref/heads/${encodeURIComponent(p.branch!)}`
  );
  if (!branchRef) {
    await github('git/refs', 'POST', {
      ref: `refs/heads/${p.branch}`,
      sha: p.proposalCommit,
    });
    branchRef = { object: { sha: p.proposalCommit } };
  }
  if (branchRef.object.sha !== p.proposalCommit)
    throw new StudioError(
      409,
      'The publication proposal changed outside Music.'
    );
  if (p.base !== base) {
    p = await rebase(p, base);
    return p;
  }
  if (!p.pullRequestNumber) {
    const owner = required('STUDIO_GITHUB_REPOSITORY').split('/')[0];
    const matches = (await github(
      `pulls?state=all&head=${encodeURIComponent(`${owner}:${p.branch}`)}&base=${encodeURIComponent(branch)}`
    )) as unknown as any[];
    const pr =
      matches[0] ??
      (await github('pulls', 'POST', {
        title: message(p).split('\n')[0],
        head: p.branch,
        base: branch,
        body: `## TL;DR\n\nPublish the reviewed Music collection.\n\n## Changes\n\n${message(p).split('\n\n').slice(1).join('\n\n')}\n\n## Verification\n\nMusic validated the immutable revision and rechecked each selected playlist with Spotify. Required repository checks must pass before rebase merge.\n\n## Follow-ups and Next Work\n\nMusic verifies the deployed revision and source hash before reporting Live.`,
      }));
    p = await patch(p.id, {
      pullRequestNumber: Number(pr.number),
      pullRequestUrl: String(pr.html_url),
    });
  }
  const pr = await github(`pulls/${p.pullRequestNumber}`);
  if ((pr.head as any).sha !== p.proposalCommit)
    throw new StudioError(
      409,
      'The publication proposal changed outside Music.'
    );
  if (pr.merged)
    return patch(p.id, {
      status: 'deploying',
      commit: String(pr.merge_commit_sha),
    });
  if (pr.state !== 'open')
    throw new StudioError(409, 'The publication pull request was closed.');
  const runs: any[] = [];
  for (let page = 1; page <= 10; page++) {
    const checkPath = `commits/${p.proposalCommit}/check-runs?per_page=100&page=${page}`;
    let checks: Record<string, unknown>;
    try {
      checks = await github(checkPath);
    } catch (error) {
      // Public repositories expose check runs without a token even when the
      // publisher token cannot request GitHub's separate Checks permission.
      if (!(error instanceof GitHubError) || error.githubStatus !== 403)
        throw error;
      checks = await github(checkPath, 'GET', undefined, false);
    }
    runs.push(...(checks.check_runs as any[]));
    if (runs.length >= Number(checks.total_count)) break;
    if (page === 10)
      throw new StudioError(502, 'GitHub returned too many checks to verify.');
  }
  // The default branch ruleset requires GitHub Actions' ci check. Other
  // integrations may fail to make optional previews without blocking merge.
  const requiredRuns = runs.filter(
    (run) => run.name === 'ci' && run.app?.id === 15368
  );
  if (
    requiredRuns.some(
      (run) =>
        run.status === 'completed' &&
        !['success', 'neutral'].includes(run.conclusion)
    )
  )
    throw new StudioError(
      409,
      'The required CI check failed. Open the publication to inspect it, then retry.'
    );
  if (
    pr.mergeable !== true ||
    !['clean', 'unstable'].includes(String(pr.mergeable_state)) ||
    (pr.base as any).sha !== base ||
    !requiredRuns.some(
      (run) => run.status === 'completed' && run.conclusion === 'success'
    )
  )
    return p;
  const latest = await github(`git/ref/heads/${encodeURIComponent(branch)}`);
  if ((latest.object as any).sha !== base) return p;
  const store = musicStore(),
    revision = await store.revision(p.revisionId);
  if (!revision || (await store.head())?.id !== p.revisionId)
    throw new StudioError(
      409,
      'The draft changed. Review the current saved collection.'
    );
  if (revision.body.selected.length) {
    const auth = await accessToken(),
      client = new SpotifyClient(auth.token),
      cached = await store.playlists();
    for (const id of revision.body.selected) {
      const playlist = await importPlaylist(
        client,
        id,
        auth.ownerId,
        cached.find((item) => item.id === id)
      );
      await store.cache(playlist);
      if (!playlist.eligible) {
        await suppressApproved(id);
        throw new StudioError(
          422,
          'A selected playlist is no longer public. Update your selection.'
        );
      }
      await cacheApproved([playlist]);
    }
  }
  if ((await store.head())?.id !== p.revisionId)
    throw new StudioError(
      409,
      'The draft changed during publication. Review it again.'
    );
  const mergeBase = await github(`git/ref/heads/${encodeURIComponent(branch)}`);
  if ((mergeBase.object as { sha: string }).sha !== base) return p;
  try {
    const merged = await github(`pulls/${p.pullRequestNumber}/merge`, 'PUT', {
      sha: p.proposalCommit,
      merge_method: 'rebase',
    });
    if (merged.merged)
      return patch(p.id, { status: 'deploying', commit: String(merged.sha) });
  } catch (e) {
    if (!(e instanceof GitHubError) || ![405, 409].includes(e.githubStatus))
      throw e;
  }
  return p;
}
export async function publishMusic(
  revisionId: string
): Promise<MusicPublication> {
  const store = musicStore(),
    db = await store.pool.connect();
  let publication: Publication | null = null;
  try {
    if (
      !(
        await db.query(
          "SELECT pg_try_advisory_lock(hashtext('music-publication')) AS locked"
        )
      ).rows[0].locked
    )
      throw new StudioError(
        409,
        'A publication is already being checked. Retry shortly.'
      );
    const revision = await store.revision(revisionId);
    if (!revision || (await store.head())?.id !== revisionId)
      throw new StudioError(
        409,
        'The draft changed after review. Review the latest saved draft.'
      );
    const existing = (
      await store.pool.query(
        'SELECT body FROM music_publications WHERE revision_id=$1',
        [revisionId]
      )
    ).rows[0]?.body as Publication | undefined;
    if (existing && ['deploying', 'live'].includes(existing.status))
      return existing;
    publication = existing ?? null;
    if (!publication) {
      const auth = revision.body.selected.length ? await accessToken() : null,
        client = new SpotifyClient(auth?.token ?? ''),
        cached = await store.playlists(),
        fresh = [];
      for (const id of revision.body.selected) {
        const playlist = await importPlaylist(
          client,
          id,
          auth!.ownerId,
          cached.find((p) => p.id === id)
        );
        await store.cache(playlist);
        if (!playlist.eligible) {
          await suppressApproved(playlist.id);
          throw new StudioError(
            422,
            `${playlist.title} must be an owned public playlist before publication.`
          );
        }
        fresh.push(playlist);
      }
      if ((await store.head())?.id !== revisionId)
        throw new StudioError(
          409,
          'The draft changed during review. Review it again.'
        );
      await cacheApproved(fresh);
      const artifact = musicArtifact(revisionId, revision.body),
        branch = required('STUDIO_GITHUB_BRANCH'),
        base = await github(`git/ref/heads/${encodeURIComponent(branch)}`),
        published = await githubCatalog((base.object as any).sha),
        baseSha = published.sha;
      const manifest = await approvedManifest();
      if (baseSha !== manifest.sourceSha) {
        const known = (
          await store.pool.query(
            "SELECT 1 FROM music_publications WHERE body->>'sourceSha'=$1 AND body->>'commit' IS NOT NULL",
            [baseSha]
          )
        ).rowCount;
        if (!known)
          throw new StudioError(
            409,
            'The public collection changed outside this admin. Reload the current deployment before publishing.'
          );
      }
      const id = randomUUID();
      publication = {
        id,
        revisionId,
        status: 'publishing',
        error: null,
        createdAt: new Date().toISOString(),
        branch: `codex/music-publish-${id}`,
        baseFileSha: baseSha,
        sourceSha: artifact.sha,
        source: artifact.content,
        message: musicPublicationMessage(
          published.catalog,
          revision.body,
          [...cached, ...fresh],
          revisionId
        ).message,
      };
      await store.pool.query(
        'INSERT INTO music_publications(id,revision_id,body) VALUES($1,$2,$3)',
        [id, revisionId, JSON.stringify(publication)]
      );
    }
    publication = await patch(publication.id, {
      status: 'publishing',
      error: null,
    });
    return await advance(publication);
  } catch (error) {
    if (!publication) throw error;
    return patch(publication.id, {
      status: 'failed',
      error:
        error instanceof StudioError
          ? error.message
          : 'Publication could not finish. Retry to resume the saved publication.',
    });
  } finally {
    await db.query("SELECT pg_advisory_unlock(hashtext('music-publication'))");
    await db.release();
  }
}
export async function musicPublicationStatus(
  id: string
): Promise<MusicPublication> {
  let p = await get(id);
  if (p.status === 'publishing') p = await publishMusic(p.revisionId);
  if (p.status === 'deploying' && p.commit) {
    try {
      const result = await fetch(
        new URL('/api/music/publication', required('STUDIO_PUBLIC_ORIGIN')),
        { cache: 'no-store', signal: AbortSignal.timeout(10000) }
      );
      const proof = await result.json();
      let ancestor = false;
      if (
        result.ok &&
        proof.revisionId === p.revisionId &&
        proof.sourceSha === p.sourceSha &&
        proof.commit !== p.commit &&
        /^[a-f0-9]{40}$/.test(proof.commit ?? '')
      ) {
        const compare = await github(`compare/${p.commit}...${proof.commit}`);
        ancestor = ['ahead', 'identical'].includes(String(compare.status));
      }
      if (result.ok && matchesMusicProof(p, proof, ancestor))
        p = await patch(p.id, { status: 'live', error: null });
    } catch {
      /* A starting deployment remains deploying until its proof matches. */
    }
  }
  return p;
}
export function publicationResponse(p: MusicPublication): MusicPublication {
  return {
    id: p.id,
    revisionId: p.revisionId,
    status: p.status,
    error: p.error,
    createdAt: p.createdAt,
    pullRequestUrl: p.pullRequestUrl,
    commit: p.commit,
  };
}
