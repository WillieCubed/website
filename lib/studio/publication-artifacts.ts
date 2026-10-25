import { createHash } from 'node:crypto';

import { type CatalogProperty, catalogEntry } from './catalog';
import { compileSandbox } from './components';
import { StudioError } from './errors';
import { effectivePortable } from './portable';
import { getStudioStore } from './store';
import type { ComponentProposal, DraftContent, EditorNode } from './types';

interface PublicationArtifactFile {
  path: string;
  content: string;
}
interface PublicationArtifacts {
  body: DraftContent;
  files: PublicationArtifactFile[];
}

interface PublicationArtifactOptions {
  compileBundles?: boolean;
}

export async function publicationArtifacts(
  body: DraftContent,
  { compileBundles = true }: PublicationArtifactOptions = {}
): Promise<PublicationArtifacts> {
  const copy = structuredClone(body),
    files: PublicationArtifactFile[] = [],
    store = getStudioStore();
  async function resolveBlock(node: EditorNode): Promise<void> {
    if (node.type !== 'catalogBlock') return;
    const attrs = node.attrs ?? {},
      id = String(attrs.id ?? '');
    const proposal = /^[a-f0-9-]{36}$/i.test(id)
      ? await store.proposal(id)
      : null;
    if (!proposal && !catalogEntry(id, String(attrs.version)))
      throw new StudioError(422, 'Unknown or unapproved catalog block.');
    if (proposal) await resolveGenerated(node, attrs, proposal);
  }
  async function resolveGenerated(
    node: EditorNode,
    attrs: Record<string, unknown>,
    proposal: ComponentProposal
  ): Promise<void> {
    if (
      proposal.status !== 'approved' ||
      proposal.version !== String(attrs.version)
    )
      throw new StudioError(
        422,
        'Generated block must use an explicitly approved version.'
      );
    const props = approvedProperties(attrs, proposal);
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
      portable: effectivePortable(attrs, proposal.portableText),
    };
  }
  async function walk(node: EditorNode): Promise<void> {
    await resolveBlock(node);
    await Promise.all((node.content ?? []).map(walk));
  }
  await walk(copy.document);
  return {
    body: copy,
    files: [...new Map(files.map((file) => [file.path, file])).values()],
  };
}
function approvedProperties(
  attrs: Record<string, unknown>,
  proposal: ComponentProposal
): Record<string, unknown> {
  const props = (attrs.props ?? proposal.example) as Record<string, unknown>;
  if (props == null || typeof props !== 'object' || Array.isArray(props))
    throw new StudioError(422, 'Component properties must be an object.');
  for (const [name, definition] of Object.entries(proposal.properties)) {
    const property = definition as CatalogProperty;
    if (
      (property.required || props[name] !== undefined) &&
      typeof props[name] !== property.type
    )
      throw new StudioError(422, `Component property ${name} is invalid.`);
  }

  return props;
}
export async function preparePublicationPreview(
  body: DraftContent
): Promise<DraftContent> {
  return (await publicationArtifacts(body, { compileBundles: false })).body;
}
