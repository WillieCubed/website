import { createHash } from 'node:crypto';

import { promoteAssets } from './assets';
import { catalogEntry } from './catalog';
import { compileSandbox } from './components';
import { exportMdx, validatePublication } from './document';
import { StudioError } from './errors';
import { required } from './oauth';
import { getStudioPool, getStudioStore } from './store';
import type { DraftContent, EditorNode, Publication } from './types';

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
    `https://api.github.com/repos/${repository}/${path}`,
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
  if (!response.ok)
    throw new StudioError(
      response.status === 409 || response.status === 422 ? 409 : 502,
      `GitHub publication failed (${response.status}).`
    );
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
  const publication = await store.publication(documentId, revisionId);
  if (publication.commit || publication.status === 'live') return publication;
  const lock = await getStudioPool().connect();
  try {
    await lock.query('SELECT pg_advisory_lock(hashtext($1))', [
      `studio-publish:${documentId}`,
    ]);
    const current = await store.getPublication(publication.id);
    if (current?.commit) return current;
    const newerCommitted = await getStudioPool().query(
      `SELECT 1 FROM studio_publications p JOIN studio_revisions r ON r.id=p.revision_id WHERE p.document_id=$1 AND p.body->>'commit' IS NOT NULL AND r.number > $2 LIMIT 1`,
      [documentId, revision.number]
    );
    if (newerCommitted.rowCount)
      throw new StudioError(
        409,
        'Restore this earlier revision as a new working revision before publishing it.'
      );
    const latestDraft = await store.get(documentId);
    const liveRevision = latestDraft?.liveRevisionId
      ? await store.revision(latestDraft.liveRevisionId)
      : null;
    if (liveRevision && revision.number < liveRevision.number)
      throw new StudioError(
        409,
        'Restore this earlier revision as a new working revision before publishing it.'
      );
    await store.updatePublication(publication.id, {
      status: 'publishing',
      error: null,
    });
    const branch = required('STUDIO_GITHUB_BRANCH');
    const ref = await github(`git/ref/heads/${encodeURIComponent(branch)}`),
      base = (ref.object as { sha: string }).sha;
    const path = `content/writings/${draft.slug}.mdx`;
    const rememberFile = async (sha: string) => {
      await getStudioPool().query(
        'UPDATE studio_publications SET body=body || $2::jsonb WHERE id=$1',
        [publication.id, JSON.stringify({ publishedFileSha: sha })]
      );
    };
    const commits = (await github(
      `commits?sha=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}&per_page=100`
    )) as unknown as { sha: string; commit: { message: string } }[];
    // Recover a commit created before the process stopped, including after a ref update.
    const recovered = commits.find(
      (commit) => commit.commit.message === messageFor(publication.id)
    );
    if (recovered) {
      const recoveredCommit = await github(`git/commits/${recovered.sha}`);
      const recoveredTree = await github(
        `git/trees/${(recoveredCommit.tree as { sha: string }).sha}?recursive=1`
      );
      const recoveredFile = (
        recoveredTree.tree as { path: string; sha: string }[]
      ).find((entry) => entry.path === path);
      if (!recoveredFile)
        throw new StudioError(502, 'Published commit is missing its source.');
      await rememberFile(recoveredFile.sha);
      await store.updatePublication(publication.id, {
        status: 'deploying',
        commit: recovered.sha,
        error: null,
      });
      return (await store.getPublication(publication.id))!;
    }
    const baseCommit = await github(`git/commits/${base}`);
    const tree = await github(
      `git/trees/${(baseCommit.tree as { sha: string }).sha}?recursive=1`
    );
    if (tree.truncated)
      throw new StudioError(
        502,
        'Repository tree is too large to validate safely.'
      );
    const existing = (tree.tree as { path: string; sha: string }[]).find(
      (entry) => entry.path === path
    );
    if ((existing?.sha ?? undefined) !== revision.body.baseFileSha) {
      // A later private revision may build on our own previous publication. Permit
      // only an exact known published blob, whose commit is still an ancestor.
      const prior = await getStudioPool().query(
        `SELECT p.body,r.number FROM studio_publications p
        JOIN studio_revisions r ON r.id=p.revision_id
        WHERE p.document_id=$1 AND p.body->>'publishedFileSha'=$2
        AND p.body->>'commit' IS NOT NULL AND r.number <= $3 ORDER BY r.number DESC LIMIT 1`,
        [documentId, existing?.sha ?? '', revision.number]
      );
      const previous = prior.rows[0]?.body as Publication | undefined;
      if (!previous?.commit)
        throw new StudioError(
          409,
          'The published source changed. Reimport it before publishing.'
        );
      const comparison = await github(`compare/${previous.commit}...${base}`);
      if (comparison.status !== 'ahead' && comparison.status !== 'identical')
        throw new StudioError(
          409,
          'The publication history changed. Reimport the published source.'
        );
    }
    const resolved = await artifacts(revision.body, false);
    const initialIssues = (await validatePublication(resolved.body)).filter(
      (issue) => issue !== 'Private assets must be promoted before publication.'
    );
    if (initialIssues.length)
      throw new StudioError(422, initialIssues.join(' '));
    const promoted = await promoteAssets(resolved.body, publication.id);
    const final = await artifacts(promoted, true, true);
    const issues = await validatePublication(final.body);
    if (issues.length) throw new StudioError(422, issues.join(' '));
    const files = [
      ...final.files,
      { path, content: exportMdx(final.body, draft.slug, revisionId) },
    ];
    const newTree = await github('git/trees', 'POST', {
      base_tree: (baseCommit.tree as { sha: string }).sha,
      tree: files.map((file) => ({ ...file, mode: '100644', type: 'blob' })),
    });
    const commit = await github('git/commits', 'POST', {
      message: messageFor(publication.id),
      tree: newTree.sha,
      parents: [base],
    });
    // Non-force update guarantees unrelated concurrent branch changes are never overwritten.
    await github(`git/refs/heads/${encodeURIComponent(branch)}`, 'PATCH', {
      sha: commit.sha,
      force: false,
    });
    const source = files[files.length - 1].content;
    const fileSha = createHash('sha1')
      .update(`blob ${Buffer.byteLength(source)}\0`)
      .update(source)
      .digest('hex');
    await rememberFile(fileSha);
    await store.updatePublication(publication.id, {
      status: 'deploying',
      commit: String(commit.sha),
      error: null,
    });
  } catch (error) {
    await store.updatePublication(publication.id, {
      status: 'failed',
      error:
        error instanceof StudioError
          ? error.message
          : 'Publication failed. Retry to reconcile the durable publication.',
    });
    throw error;
  } finally {
    await lock.query('SELECT pg_advisory_unlock(hashtext($1))', [
      `studio-publish:${documentId}`,
    ]);
    lock.release();
  }
  return (await store.getPublication(publication.id))!;
}
export async function publicationStatus(id: string): Promise<Publication> {
  const store = getStudioStore(),
    publication = await store.getPublication(id);
  if (!publication) throw new StudioError(404, 'Publication not found.');
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
