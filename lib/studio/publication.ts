import { createHash } from 'node:crypto';

import {
  findOrOpenPullRequest,
  github,
  githubOptional,
  rebaseMergePullRequest,
} from '../github/client';
import type { GitHubObject, GitHubTreeEntry } from '../github/types';
import { promoteAssets } from './assets';
import { required } from './config';
import { exportMdx, validatePublication } from './document';
import { StudioError } from './errors';
import { publicationArtifacts } from './publication-artifacts';
import { getStudioPool, getStudioStore } from './store';
import type { Draft, Publication, Revision } from './types';

export { preparePublicationPreview } from './publication-artifacts';

const messageFor = (id: string) =>
  `feat(writings): publish studio revision ${id}`;
// Publication metadata lives in the durable JSON body; the store's status updater
// deliberately only permits its public status/commit/error fields.
async function persistProposal(id: string, patch: Partial<Publication>) {
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
    `git/trees/${(object.tree as GitHubObject).sha}?recursive=1`
  );
  if (tree.truncated)
    throw new StudioError(
      502,
      'Repository tree is too large to validate safely.'
    );
  return (
    (tree.tree as GitHubTreeEntry[]).find((entry) => entry.path === path)
      ?.sha ?? null
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
    await persistProposal(publication.id, { rebaseInput: pending });
  }
  const current = await github(
    `git/ref/heads/${encodeURIComponent(privateBranch)}`
  );
  const currentSha = (current.object as GitHubObject).sha;
  if (currentSha !== pending.after) {
    if (currentSha !== pending.before)
      throw new StudioError(
        409,
        'The publication proposal changed. Review it before retrying.'
      );
    // This branch belongs to one publication and is serialized by its advisory
    // lock. Recheck its head before the forced update so a changed proposal is
    // never knowingly overwritten. The scoped token supports Git refs via REST.
    await github(
      `git/refs/heads/${encodeURIComponent(privateBranch)}`,
      'PATCH',
      { sha: pending.after, force: true }
    );
    const updated = await github(
      `git/ref/heads/${encodeURIComponent(privateBranch)}`
    );
    if ((updated.object as GitHubObject).sha !== pending.after)
      throw new StudioError(
        409,
        'The publication branch could not be rebased. Review the pull request and retry.'
      );
  }
  await persistProposal(publication.id, {
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
  if (
    publication.artifactManifest === undefined ||
    publication.artifactManifest.length === 0
  )
    throw new StudioError(
      409,
      'The publication branch needs a rebase. Review and rebase its pull request before retrying.'
    );
  const baseCommit = await github(`git/commits/${base}`);
  const currentTree = await github(
    `git/trees/${(baseCommit.tree as GitHubObject).sha}?recursive=1`
  );
  if (currentTree.truncated)
    throw new StudioError(
      502,
      'Repository tree is too large to validate safely.'
    );
  const currentEntries = currentTree.tree as GitHubTreeEntry[];
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
    base_tree: (baseCommit.tree as GitHubObject).sha,
    tree: publication.artifactManifest.map(({ path, sha }) => ({
      path,
      sha,
      mode: '100644',
      type: 'blob',
    })),
  });
  await persistProposal(publication.id, {
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

function proposalBody(publication: Publication): string {
  // Keep these headings in the same order as the repository pull request template.
  // Workers cannot read repository files from process.cwd() at request time.
  return `## TL;DR

Publish the selected immutable Studio revision ${publication.revisionId}.

## Changes

Export the selected revision and its approved assets in one commit. Publication ID: ${publication.id}.

## Verification

Studio validates the selected revision before creating this proposal. Required GitHub checks and branch protections must pass before rebase merging. Public revision verification follows deployment.

## Follow-ups and Next Work

Verify the deployed revision and merged commit through the Studio publication status endpoint.
`;
}

async function publicationPullRequest(
  publication: Publication,
  branch: string
): Promise<Record<string, unknown>> {
  let pr: Record<string, unknown>;
  if (publication.pullRequestNumber !== undefined) {
    pr = await github(`pulls/${publication.pullRequestNumber}`);
  } else {
    pr = await findOrOpenPullRequest({
      title: messageFor(publication.id),
      head: publication.publicationBranch!,
      base: branch,
      body: await proposalBody(publication),
    });
    await persistProposal(publication.id, {
      pullRequestNumber: Number(pr.number),
      pullRequestUrl: String(pr.html_url),
    });
    pr = await github(`pulls/${pr.number}`);
  }

  return pr;
}

async function reconcilePullRequest(
  publication: Publication,
  branch: string
): Promise<void> {
  const pr = await publicationPullRequest(publication, branch);
  if ((pr.head as GitHubObject).sha !== publication.proposalCommit)
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
    await markPublicationDeploying(publication.id, String(pr.merge_commit_sha));
    return;
  }
  if (pr.state !== 'open')
    throw new StudioError(
      409,
      'The publication pull request was closed without merging.'
    );
  const base = await reconcilePublicationBase(publication, branch);
  if (base.kind === 'rebased') return;
  // GitHub's protected merge is authoritative for required checks, reviews,
  // rulesets and permissions. Fine-grained repository tokens cannot call the
  // Checks API, so never make a separate check-run request here. An
  // unknown/blocked/behind state never initiates a merge.
  if (
    pr.mergeable !== true ||
    pr.mergeable_state !== 'clean' ||
    (pr.base as GitHubObject).sha !== base.sha
  )
    return;
  if (!(await publicationBaseUnchanged(publication, branch, base.sha))) return;
  await mergePublication(publication, pr);
}

interface CurrentPublicationBase {
  kind: 'current';
  sha: string;
}
interface RebasedPublicationBase {
  kind: 'rebased';
}
type PublicationBase = CurrentPublicationBase | RebasedPublicationBase;

async function reconcilePublicationBase(
  publication: Publication,
  branch: string
): Promise<PublicationBase> {
  const current = await github(`git/ref/heads/${encodeURIComponent(branch)}`);
  const base = (current.object as GitHubObject).sha;
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
    return { kind: 'rebased' }; // The same PR now reruns required checks on its new head.
  }

  return { kind: 'current', sha: base };
}

async function publicationBaseUnchanged(
  publication: Publication,
  branch: string,
  base: string
): Promise<boolean> {
  // Re-read after polling checks: they can take time, and publication must stop
  // if source changed while checks were being inspected. GitHub's protected
  // merge remains the atomic authority for required up-to-date checks/reviews.
  const latest = await github(`git/ref/heads/${encodeURIComponent(branch)}`);
  const latestBase = (latest.object as GitHubObject).sha;
  if (latestBase !== base) {
    if (
      (await sourceBlob(latestBase, publication.sourcePath!)) !==
      publication.sourceFileSha
    )
      throw new StudioError(
        409,
        'The published source changed. Reimport it before publishing.'
      );
    return false;
  }
  return true;
}
async function mergePublication(
  publication: Publication,
  pr: Record<string, unknown>
): Promise<void> {
  const commit = await rebaseMergePullRequest(
    Number(pr.number),
    publication.proposalCommit!
  );
  if (commit) await markPublicationDeploying(publication.id, commit);
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
    const publication = (await store.getPublication(initial.id))!;
    if (publication.commit) return publication;
    await requireLatestPublication(documentId, revision);
    await store.updatePublication(publication.id, {
      status: 'publishing',
      error: null,
    });
    await preparePublicationProposal(publication, draft, revision);
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
async function requireLatestPublication(
  documentId: string,
  revision: Revision
): Promise<void> {
  const store = getStudioStore();
  const newer = await getStudioPool().query(
    `SELECT 1 FROM studio_publications p JOIN studio_revisions r ON r.id=p.revision_id WHERE p.document_id=$1 AND p.body->>'commit' IS NOT NULL AND r.number > $2 LIMIT 1`,
    [documentId, revision.number]
  );
  const latestDraft = await store.get(documentId);
  const live = latestDraft?.liveRevisionId
    ? await store.revision(latestDraft.liveRevisionId)
    : null;
  if ((newer.rowCount ?? 0) > 0 || (live && live.number > revision.number))
    throw new StudioError(
      409,
      'Restore this earlier revision as a new working revision before publishing it.'
    );
}
async function preparePublicationProposal(
  publication: Publication,
  draft: Draft,
  revision: Revision
): Promise<void> {
  const store = getStudioStore();
  const branch = required('STUDIO_GITHUB_BRANCH');
  const publicationBranch = `codex/studio-publish-${publication.id}`;
  const path = `content/writings/${draft.slug}.mdx`;
  await persistProposal(publication.id, {
    publicationBranch,
    sourcePath: path,
  });
  publication = (await store.getPublication(publication.id))!;
  if (publication.rebaseInput) {
    await completeRebase(publication, branch);
    publication = (await store.getPublication(publication.id))!;
  }
  const proposalRef = await githubOptional(
    `git/ref/heads/${encodeURIComponent(publicationBranch)}`
  );
  if (proposalRef) {
    const sha = (proposalRef.object as GitHubObject).sha;
    const proposal = await github(`git/commits/${sha}`);
    if (
      proposal.message !== messageFor(publication.id) ||
      (publication.proposalCommit && publication.proposalCommit !== sha)
    )
      throw new StudioError(
        409,
        'The publication branch changed. Review it before retrying.'
      );
    await persistProposal(publication.id, { proposalCommit: sha });
  } else {
    // GitHub can delete the private head branch after a successful merge.
    // Reconcile the durable PR before considering a new proposal.
    if (publication.pullRequestNumber !== undefined) {
      await reconcilePullRequest(publication, branch);
      return;
    }
    if (!publication.proposalCommit && !publication.proposalInput) {
      await createPublicationTree(publication, draft, revision, branch, path);
      publication = (await store.getPublication(publication.id))!;
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
      await persistProposal(publication.id, {
        proposalCommit: String(commit.sha),
      });
      publication = (await store.getPublication(publication.id))!;
    }
    await github('git/refs', 'POST', {
      ref: `refs/heads/${publicationBranch}`,
      sha: publication.proposalCommit,
    });
  }
  publication = (await store.getPublication(publication.id))!;
  await reconcilePullRequest(publication, branch);
}
async function createPublicationTree(
  publication: Publication,
  draft: Draft,
  revision: Revision,
  branch: string,
  path: string
): Promise<void> {
  const revisionId = revision.id;
  const ref = await github(`git/ref/heads/${encodeURIComponent(branch)}`);
  const base = (ref.object as GitHubObject).sha;
  const existing = await sourceBlob(base, path);
  await validateSourceHistory(draft.id, revision, existing, base);
  const resolved = await publicationArtifacts(revision.body, {
    compileBundles: false,
  });
  const initialIssues = (await validatePublication(resolved.body)).filter(
    (issue) => issue !== 'Private assets must be promoted before publication.'
  );
  if (initialIssues.length > 0)
    throw new StudioError(422, initialIssues.join(' '));
  const promoted = await promoteAssets(resolved.body, publication.id);
  const final = await publicationArtifacts(promoted);
  const issues = await validatePublication(final.body);
  if (issues.length > 0) throw new StudioError(422, issues.join(' '));
  const source = exportMdx(final.body, draft.slug, revisionId);
  const files = [...final.files, { path, content: source }];
  const baseCommit = await github(`git/commits/${base}`);
  const baseTree = await github(
    `git/trees/${(baseCommit.tree as GitHubObject).sha}?recursive=1`
  );
  if (baseTree.truncated)
    throw new StudioError(
      502,
      'Repository tree is too large to validate safely.'
    );
  const baseEntries = baseTree.tree as GitHubTreeEntry[];
  const tree = await github('git/trees', 'POST', {
    base_tree: (baseCommit.tree as GitHubObject).sha,
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
  await persistProposal(publication.id, {
    proposalInput: { tree: String(tree.sha), parent: base },
    artifactManifest: files.map((file) => ({
      path: file.path,
      sha: createHash('sha1')
        .update(`blob ${Buffer.byteLength(file.content)}\0`)
        .update(file.content)
        .digest('hex'),
      baseSha:
        baseEntries.find((entry) => entry.path === file.path)?.sha ?? null,
    })),
    sourceFileSha: existing,
    publishedFileSha: fileSha,
  });
}
async function validateSourceHistory(
  documentId: string,
  revision: Revision,
  existing: string | null,
  base: string
): Promise<void> {
  if (existing === (revision.body.baseFileSha ?? null)) return;
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
  const comparison = await github(`compare/${previous.commit}...${base}`);
  if (!['ahead', 'identical'].includes(String(comparison.status)))
    throw new StudioError(
      409,
      'The publication history changed. Reimport the published source.'
    );
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
    if (await deployedPublicationMatches(publication, response.ok, result)) {
      await store.updatePublication(id, { status: 'live', error: null });
      return { ...publication, status: 'live', error: null };
    }
  } catch {
    /* A deployment still starting remains deploying. */
  }
  return publication;
}

interface DeployedPublicationMarker {
  commit?: unknown;
  revisionId?: unknown;
  sourceSha?: unknown;
}

async function deployedPublicationMatches(
  publication: Publication,
  ok: boolean,
  result: DeployedPublicationMarker
): Promise<boolean> {
  let commitMatches = result.commit === publication.commit;
  if (
    ok &&
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

  return (
    ok &&
    result.revisionId === publication.revisionId &&
    Boolean(publication.publishedFileSha) &&
    result.sourceSha === publication.publishedFileSha &&
    commitMatches
  );
}

async function markPublicationDeploying(
  id: string,
  commit: string
): Promise<void> {
  await getStudioStore().updatePublication(id, {
    status: 'deploying',
    commit,
    error: null,
  });
}
