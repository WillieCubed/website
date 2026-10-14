import { createHash } from 'node:crypto';
import type { ComponentType } from 'react';

import { generatedMdx } from '@/lib/generated-mdx';

export type CompiledMdxKind = 'writing' | 'narrative';

type MdxComponent = ComponentType<{
  components?: Record<string, unknown>;
}>;

/** Match a repository body to the component bundled for this exact build. */
export function getCompiledMdx(
  kind: CompiledMdxKind,
  source: string
): MdxComponent {
  const key = createHash('sha256').update(`${kind}\0${source}`).digest('hex');
  const component = (generatedMdx as Record<string, MdxComponent>)[key];
  if (!component)
    throw new Error(`Missing bundled ${kind} MDX. Rebuild the site content.`);
  return component;
}
