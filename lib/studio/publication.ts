import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { promoteAssets } from './assets';
import { catalogEntry } from './catalog';
import { compileSandbox } from './components';
import { exportMdx, validatePublication } from './document';
import { StudioError } from './errors';
import { required } from './oauth';
import { getStudioPool, getStudioStore } from './store';
import type { DraftContent, EditorNode, Publication } from './types';

class GitHubError extends StudioError {
  constructor(readonly githubStatus: number) {
    super(
      githubStatus === 409 || githubStatus === 422 ? 409 : 502,
      `GitHub publication failed (${githubStatus}).`
    );
  }
}

const messageFor = (id: string) =>
  `feat(writings): publish studio revision ${id}`;
async function github(
  path: string,
  method = 'GET',
  body?: unknown
): Promise<Record<string, unknown>> {
  const repository = required('STUDIO_GITHUB_REPOSITORY');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))
    throw new StudioError(503, 'Invalid publication repository.');
  const response = await fetch(
    path === '$graphql'
      ? 'https://api.github.com/graphql'
      : `https://api.github.com/repos/${repository}/${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${required('STUDIO_GITHUB_TOKEN')}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    }
  );
  if (!response.ok) throw new GitHubError(response.status);
  return response.json();
}
async function artifacts(
  body: DraftContent,
  compileBundles = true,
  preservePortable = false
): Promise<{ body: DraftContent; files: { path: string; content: string }[] }> {
  const copy = structuredClone(body),
    files: { path: string; content: string }[] = [],
    store = getStudioStore();
  async function walk(node: EditorNode): Promise<void> {
    if (node.type === 'catalogBlock') {
      const attrs = node.attrs ?? {},
        id = String(attrs.id ?? '');
      const proposal = /^[a-f0-9-]{36}$/i.test(id)
        ? await store.proposal(id)
        : null;
      if (!proposal && !catalogEntry(id, String(attrs.version)))
        throw new StudioError(422, 'Unknown or unapproved catalog block.');
      if (proposal) {
        if (
          proposal.status !== 'approved' ||
          proposal.version !== String(attrs.version)
        )
          throw new StudioError(
            422,
            'Generated block must use an explicitly approved version.'
          );
        const props = (attrs.props ?? proposal.example) as Record<
          string,
          unknown
        >;
        if (!props || typeof props !== 'object' || Array.isArray(props))
          throw new StudioError(422, 'Component properties must be an object.');
        for (const [name, definition] of Object.entries(proposal.properties)) {
          const property = definition as { type: string; required?: boolean };
          if (
            (property.required || props[name] !== undefined) &&
            typeof props[name] !== property.type
          )
            throw new StudioError(
              422,
              `Component property ${name} is invalid.`
            );
        }
        const hash = createHash('sha256')
          .update(JSON.stringify(props))
          .digest('hex')
          .slice(0, 20);
        const src = `/generated-blocks/${proposal.id}/${proposal.version}-${hash}.html`;
        if (/\/api\/studio\/assets\//.test(proposal.source))
          throw new StudioError(
            422,
            'Generated components must receive media through their properties.'
          );
        if (compileBundles)
          files.push({
            path: `public${src}`,
            content: await compileSandbox(proposal, props),
          });
        node.attrs = {
          ...attrs,
          src,
          portable: preservePortable ? attrs.portable : proposal.portableText,
        };
      }
    }
    await Promise.all((node.content ?? []).map(walk));
  }
  await walk(copy.document);
  return {
    body: copy,
    files: [...new Map(files.map((file) => [file.path, file])).values()],
  };
}
export async function preparePublicationPreview(
  body: DraftContent
): Promise<DraftContent> {
  return (await artifacts(body, false)).body;
}

async function optionalGithub(path: string) {
  try {
    return await github(path);
  } catch (error) {
    if (error instanceof GitHubError && error.githubStatus === 404) return null;
    throw error;
  }
}

// Publication metadata lives in the durable JSON body; the store's status updater
// deliberately only permits its public status/commit/error fields.
async function remember(id: string, patch: Partial<Publication>) {
  await getStudioPool().query(
    'UPDATE studio_publications SET body=body || $2::jsonb WHERE id=$1',
    [id, JSON.stringify(patch)]
  );
}
async function sourceBlob(
  commit: string,
  path: string
): Promise<string | null> {
  const object = await github(`git/commits/${commit}`);
  const tree = await github(
    `git/trees/${(object.tree as { sha: string }).sha}?recursive=1`
  );
  if (tree.truncated)
    throw new StudioError(
      502,
      'Repository tree is too large to validate safely.'
    );
  return (
    (tree.tree as { path: string; sha: string }[]).find(
      (entry) => entry.path === path
    )?.sha ?? null
  );
}

function commitIdentity(publication: Publication) {
  return {
    name: process.env.STUDIO_GITHUB_AUTHOR_NAME || 'WillieChalmers',
    email:
      process.env.STUDIO_GITHUB_AUTHOR_EMAIL ||
      '16641570+WillieCubed@users.noreply.github.com',
    date: publication.createdAt,
  };
}

async function completeRebase(
  publication: Publication,
  protectedBranch: string
): Promise<void> {
  const pending = publication.rebaseInput!;
  const privateBranch = `codex/studio-publish-${publication.id}`;
  if (
    publication.publicationBranch !== privateBranch ||
    protectedBranch === privateBranch
  )
    throw new StudioError(
      409,
      'Only the private publication branch can be rebased.'
    );
  if (!pending.after) {
    const identity = commitIdentity(publication);
    const commit = await github('git/commits', 'POST', {
      message: messageFor(publication.id),
      tree: pending.tree,
      parents: [pending.parent],
      author: identity,
      committer: identity,
    });
    pending.after = String(commit.sha);
    await remember(publication.id, { rebaseInput: pending });
  }
  const current = await github(
    `git/ref/heads/${encodeURIComponent(privateBranch)}`
  );
  const currentSha = (current.object as { sha: string }).sha;
  if (currentSha !== pending.after) {
    if (currentSha !== pending.before)
      throw new StudioError(
        409,
        'The publication proposal changed. Review it before retrying.'
      );
    const repository = await github('');
    const result = await github('$graphql', 'POST', {
      query:
        'mutation StudioRebase($input: UpdateRefsInput!) { updateRefs(input: $input) { clientMutationId } }',
      variables: {
        input: {
          repositoryId: repository.node_id,
          clientMutationId: `${publication.id}:${pending.parent}`,
          refUpdates: [
            {
              name: `refs/heads/${privateBranch}`,
              beforeOid: pending.before,
              afterOid: pending.after,
              force: true,
            },
          ],
        },
      },
    });
    if (result.errors)
      throw new StudioError(
        409,
        'The publication branch could not be rebased. Review the pull request and retry.'
      );
  }
  await remember(publication.id, {
    proposalCommit: pending.after,
    proposalInput: { tree: pending.tree, parent: pending.parent },
    rebaseInput: null,
  });
}

async function rebaseArtifacts(
  publication: Publication,
  base: string,
  protectedBranch: string
): Promise<void> {
  if (!publication.artifactManifest?.length)
    throw new StudioError(
      409,
      'The publication branch needs a rebase. Review and rebase its pull request before retrying.'
    );
  const baseCommit = await github(`git/commits/${base}`);
  const currentTree = await github(
    `git/trees/${(baseCommit.tree as { sha: string }).sha}?recursive=1`
  );
  if (currentTree.truncated)
    throw new StudioError(
      502,
      'Repository tree is too large to validate safely.'
    );
  const currentEntries = currentTree.tree as { path: string; sha: string }[];
  for (const entry of publication.artifactManifest) {
    const actual =
      currentEntries.find((file) => file.path === entry.path)?.sha ?? null;
    if (actual !== entry.baseSha && actual !== entry.sha)
      throw new StudioError(
        409,
        'A publication artifact changed on the protected branch. Reimport it before publishing.'
      );
  }
  const tree = await github('git/trees', 'POST', {
    base_tree: (baseCommit.tree as { sha: string }).sha,
    tree: publication.artifactManifest.map(({ path, sha }) => ({
      path,
      sha,
      mode: '100644',
      type: 'blob',
    })),
  });
  await remember(publication.id, {
    rebaseInput: {
      before: publication.proposalCommit!,
      tree: String(tree.sha),
      parent: base,
    },
  });
  await completeRebase(
    (await getStudioStore().getPublication(publication.id))!,
    protectedBranch
  );
}

async function proposalBody(publication: Publication): Promise<string> {
  // Keep the actual repository template's headings and order. This is operational
  // PR metadata, never authored writing or generated editorial content.
  const template = await readFile(
    join(process.cwd(), '.github/pull_request_template.md'),
    'utf8'
  );
  const answers = [
    `Publish the selected immutable Studio revision ${publication.revisionId}.`,
    `Export the selected revision and its approved assets in one commit. Publication ID: ${publication.id}.`,
    'Studio validates the selected revision before creating this proposal. Required GitHub checks and branch protections must pass before rebase merging. Public revision verification follows deployment.',
    'Verify the deployed revision and merged commit through the Studio publication status endpoint.',
  ];
  let index = 0;
  return template.replace(
    /<!--[\s\S]*?-->/g,
    () => answers[index++] ?? 'None.'
  );
}

async function publicationChecks(commit: string) {
  const runs: { status: string; conclusion: string }[] = [];
  for (let page = 1; page <= 10; page++) {
    const result = await github(
      `commits/${commit}/check-runs?per_page=100&page=${page}`
    );
    const entries = result.check_runs as {
      status: string;
      conclusion: string;
    }[];
    runs.push(...entries);
    if (runs.length >= Number(result.total_count)) return runs;
    if (!entries.length) break;
  }
  throw new StudioError(
    502,
    'Publication checks could not be fully inspected. Review the pull request and retry.'
  );
}

async function reconcilePullRequest(
  publication: Publication,
  branch: string
): Promise<void> {
  const store = getStudioStore();
  let pr: Record<string, unknown>;
  if (publication.pullRequestNumber) {
    pr = await github(`pulls/${publication.pullRequestNumber}`);
  } else {
    const owner = required('STUDIO_GITHUB_REPOSITORY').split('/')[0];
    const pulls = (await github(
      `pulls?state=all&head=${encodeURIComponent(`${owner}:${publication.publicationBranch}`)}&base=${encodeURIComponent(branch)}&per_page=100`
    )) as unknown as Record<string, unknown>[];
    pr =
      pulls[0] ??
      (await github('pulls', 'POST', {
        title: messageFor(publication.id),
        head: publication.publicationBranch,
        base: branch,
        body: await proposalBody(publication),
      }));
    await remember(publication.id, {
      pullRequestNumber: Number(pr.number),
      pullRequestUrl: String(pr.html_url),
    });
    pr = await github(`pulls/${pr.number}`);
  }
  if ((pr.head as { sha: string }).sha !== publication.proposalCommit)
    throw new StudioError(
      409,
      'The publication proposal changed. Review it before retrying.'
    );
  if (pr.merged) {
    if (!/^[a-f0-9]{40}$/.test(String(pr.merge_commit_sha)))
      throw new StudioError(
        502,
        'GitHub has not reported the merged publication commit.'
      );
    await store.updatePublication(publication.id, {
      status: 'deploying',
      commit: String(pr.merge_commit_sha),
      error: null,
    });
    return;
  }
  if (pr.state !== 'open')
    throw new StudioError(
      409,
      'The publication pull request was closed without merging.'
    );
  const current = await github(`git/ref/heads/${encodeURIComponent(branch)}`);
  const base = (current.object as { sha: string }).sha;
  if (
    (await sourceBlob(base, publication.sourcePath!)) !==
    publication.sourceFileSha
  )
    throw new StudioError(
      409,
      'The published source changed. Reimport it before publishing.'
    );
  if (publication.proposalInput?.parent !== base) {
    await rebaseArtifacts(publication, base, branch);
    return; // The same PR now reruns required checks on its new head.
  }
  const [runs, statuses] = await Promise.all([
    publicationChecks(publication.proposalCommit!),
    github(`commits/${publication.proposalCommit}/status?per_page=100`),
  ]);
  if (
    runs.some(
      (run) =>
        run.status === 'completed' &&
        !['success', 'neutral', 'skipped'].includes(run.conclusion)
    ) ||
    ['failure', 'error'].includes(String(statuses.state))
  )
    throw new StudioError(
      409,
      `Publication checks failed. Review and rerun the failed checks in ${publication.pullRequestUrl ?? String(pr.html_url)}, then retry publication.`
    );
  // GitHub remains authoritative for required contexts, reviews, rulesets and
  // permissions. An unknown/blocked/behind state never initiates a merge.
  if (
    pr.mergeable !== true ||
    pr.mergeable_state !== 'clean' ||
    (pr.base as { sha: string }).sha !== base ||
    runs.some(
      (run) =>
        run.status !== 'completed' ||
        !['success', 'neutral', 'skipped'].includes(run.conclusion)
    ) ||
    !['success', 'pending'].includes(String(statuses.state)) ||
    ((statuses.statuses as unknown[]).length > 0 &&
      statuses.state !== 'success')
  )
    return;
  // Re-read after polling checks: they can take time, and publication must stop
  // if source changed while checks were being inspected. GitHub's protected
  // merge remains the atomic authority for required up-to-date checks/reviews.
  const latest = await github(`git/ref/heads/${encodeURIComponent(branch)}`);
  const latestBase = (latest.object as { sha: string }).sha;
  if (latestBase !== base) {
    if (
      (await sourceBlob(latestBase, publication.sourcePath!)) !==
      publication.sourceFileSha
    )
      throw new StudioError(
        409,
        'The published source changed. Reimport it before publishing.'
      );
    return;
  }
  try {
    const result = await github(`pulls/${pr.number}/merge`, 'PUT', {
      sha: publication.proposalCommit,
      merge_method: 'rebase',
    });
    if (result.merged) {
      await store.updatePublication(publication.id, {
        status: 'deploying',
        commit: String(result.sha),
        error: null,
      });
    }
  } catch (error) {
    // Policy/review/check races are waiting states, never a reason to bypass.
    if (
      !(error instanceof GitHubError) ||
      ![405, 409].includes(error.githubStatus)
    )
      throw error;
  }
}

export async function publishRevision(
  documentId: string,
  revisionId: string
): Promise<Publication> {
  const store = getStudioStore(),
    draft = await store.get(documentId),
    revision = await store.revision(revisionId);
  if (!draft || !revision || revision.documentId !== documentId)
    throw new StudioError(404, 'Selected revision not found.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug))
    throw new StudioError(422, 'Invalid publication slug.');
  const initial = await store.publication(documentId, revisionId);
  if (initial.commit || initial.status === 'live') return initial;
  const lock = await getStudioPool().connect();
  try {
    await lock.query('SELECT pg_advisory_lock(hashtext($1))', [
      `studio-publish:${documentId}`,
    ]);
    let publication = (await store.getPublication(initial.id))!;
    if (publication.commit) return publication;
    const newer = await getStudioPool().query(
      `SELECT 1 FROM studio_publications p JOIN studio_revisions r ON r.id=p.revision_id WHERE p.document_id=$1 AND p.body->>'commit' IS NOT NULL AND r.number > $2 LIMIT 1`,
      [documentId, revision.number]
    );
    const latestDraft = await store.get(documentId);
    const live = latestDraft?.liveRevisionId
      ? await store.revision(latestDraft.liveRevisionId)
      : null;
    if (newer.rowCount || (live && live.number > revision.number))
      throw new StudioError(
        409,
        'Restore this earlier revision as a new working revision before publishing it.'
      );
    await store.updatePublication(publication.id, {
      status: 'publishing',
      error: null,
    });
    const branch = required('STUDIO_GITHUB_BRANCH');
    const publicationBranch = `codex/studio-publish-${publication.id}`;
    const path = `content/writings/${draft.slug}.mdx`;
    await remember(publication.id, { publicationBranch, sourcePath: path });
    publication = (await store.getPublication(initial.id))!;
    if (publication.rebaseInput) {
      await completeRebase(publication, branch);
      publication = (await store.getPublication(initial.id))!;
    }
    const proposalRef = await optionalGithub(
      `git/ref/heads/${encodeURIComponent(publicationBranch)}`
    );
    if (proposalRef) {
      const sha = (proposalRef.object as { sha: string }).sha;
      const proposal = await github(`git/commits/${sha}`);
      if (
        proposal.message !== messageFor(publication.id) ||
        (publication.proposalCommit && publication.proposalCommit !== sha)
      )
        throw new StudioError(
          409,
          'The publication branch changed. Review it before retrying.'
        );
      await remember(publication.id, { proposalCommit: sha });
    } else {
      if (!publication.proposalCommit && !publication.proposalInput) {
        const ref = await github(`git/ref/heads/${encodeURIComponent(branch)}`);
        const base = (ref.object as { sha: string }).sha;
        const existing = await sourceBlob(base, path);
        if (existing !== (revision.body.baseFileSha ?? null)) {
          const prior = await getStudioPool().query(
            `SELECT p.body FROM studio_publications p JOIN studio_revisions r ON r.id=p.revision_id WHERE p.document_id=$1 AND p.body->>'publishedFileSha'=$2 AND p.body->>'commit' IS NOT NULL AND r.number <= $3 ORDER BY r.number DESC LIMIT 1`,
            [documentId, existing ?? '', revision.number]
          );
          const previous = prior.rows[0]?.body as Publication | undefined;
          if (!previous?.commit)
            throw new StudioError(
              409,
              'The published source changed. Reimport it before publishing.'
            );
          const comparison = await github(
            `compare/${previous.commit}...${base}`
          );
          if (!['ahead', 'identical'].includes(String(comparison.status)))
            throw new StudioError(
              409,
              'The publication history changed. Reimport the published source.'
            );
        }
        const resolved = await artifacts(revision.body, false);
        const initialIssues = (await validatePublication(resolved.body)).filter(
          (issue) =>
            issue !== 'Private assets must be promoted before publication.'
        );
        if (initialIssues.length)
          throw new StudioError(422, initialIssues.join(' '));
        const promoted = await promoteAssets(resolved.body, publication.id);
        const final = await artifacts(promoted, true, true);
        const issues = await validatePublication(final.body);
        if (issues.length) throw new StudioError(422, issues.join(' '));
        const source = exportMdx(final.body, draft.slug, revisionId);
        const files = [...final.files, { path, content: source }];
        const baseCommit = await github(`git/commits/${base}`);
        const baseTree = await github(
          `git/trees/${(baseCommit.tree as { sha: string }).sha}?recursive=1`
        );
        if (baseTree.truncated)
          throw new StudioError(
            502,
            'Repository tree is too large to validate safely.'
          );
        const baseEntries = baseTree.tree as { path: string; sha: string }[];
        const tree = await github('git/trees', 'POST', {
          base_tree: (baseCommit.tree as { sha: string }).sha,
          tree: files.map((file) => ({
            ...file,
            mode: '100644',
            type: 'blob',
          })),
        });
        const fileSha = createHash('sha1')
          .update(`blob ${Buffer.byteLength(source)}\0`)
          .update(source)
          .digest('hex');
        await remember(publication.id, {
          proposalInput: { tree: String(tree.sha), parent: base },
          artifactManifest: files.map((file) => ({
            path: file.path,
            sha: createHash('sha1')
              .update(`blob ${Buffer.byteLength(file.content)}\0`)
              .update(file.content)
              .digest('hex'),
            baseSha:
              baseEntries.find((entry) => entry.path === file.path)?.sha ??
              null,
          })),
          sourceFileSha: existing,
          publishedFileSha: fileSha,
        });
        publication = (await store.getPublication(initial.id))!;
      }
      if (!publication.proposalCommit) {
        const identity = commitIdentity(publication);
        // Persisted tree, parent and timestamp make object creation idempotent
        // even when GitHub accepted the request but its response was lost.
        const commit = await github('git/commits', 'POST', {
          message: messageFor(publication.id),
          tree: publication.proposalInput!.tree,
          parents: [publication.proposalInput!.parent],
          author: identity,
          committer: identity,
        });
        await remember(publication.id, { proposalCommit: String(commit.sha) });
        publication = (await store.getPublication(initial.id))!;
      }
      await github('git/refs', 'POST', {
        ref: `refs/heads/${publicationBranch}`,
        sha: publication.proposalCommit,
      });
    }
    publication = (await store.getPublication(initial.id))!;
    await reconcilePullRequest(publication, branch);
  } catch (error) {
    await store.updatePublication(initial.id, {
      status: 'failed',
      error:
        error instanceof StudioError
          ? error.message
          : 'Publication failed. Retry to reconcile the durable publication.',
    });
  } finally {
    await lock.query('SELECT pg_advisory_unlock(hashtext($1))', [
      `studio-publish:${documentId}`,
    ]);
    lock.release();
  }
  return (await store.getPublication(initial.id))!;
}
export async function publicationStatus(id: string): Promise<Publication> {
  const store = getStudioStore(),
    publication = await store.getPublication(id);
  if (!publication) throw new StudioError(404, 'Publication not found.');
  if (publication.status === 'publishing') {
    return publishRevision(publication.documentId, publication.revisionId);
  }
  if (publication.status !== 'deploying' || !publication.commit)
    return publication;
  const draft = await store.get(publication.documentId);
  if (!draft) return publication;
  try {
    const origin = new URL(required('STUDIO_PUBLIC_ORIGIN'));
    const url = new URL(
      `/api/studio-publication/${encodeURIComponent(draft.slug)}`,
      origin
    );
    url.searchParams.set('revision', publication.revisionId);
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.json();
    let commitMatches = result.commit === publication.commit;
    if (
      response.ok &&
      result.revisionId === publication.revisionId &&
      !commitMatches &&
      /^[a-f0-9]{40}$/.test(String(result.commit))
    ) {
      const comparison = await github(
        `compare/${publication.commit}...${result.commit}`
      );
      commitMatches =
        comparison.status === 'ahead' || comparison.status === 'identical';
    }
    if (
      response.ok &&
      result.revisionId === publication.revisionId &&
      Boolean(publication.publishedFileSha) &&
      result.sourceSha === publication.publishedFileSha &&
      commitMatches
    ) {
      await store.updatePublication(id, { status: 'live', error: null });
      return { ...publication, status: 'live', error: null };
    }
  } catch {
    /* A deployment still starting remains deploying. */
  }
  return publication;
}
