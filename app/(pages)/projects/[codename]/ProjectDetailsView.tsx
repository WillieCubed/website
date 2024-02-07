'use client';

import { MDXRemote } from 'next-mdx-remote';
import { PropsWithChildren } from 'react';
import Features from '../../../../components/projects/FeatureList';

const mdxComponentsMap = {
  h1: ({ children }: PropsWithChildren) => (
    <h1 className="text-headline-small font-bold text-on-surface-foreground dark:text-on-surface-foreground-dark">
      {children}
    </h1>
  ),
  h2: ({ children }: PropsWithChildren) => (
    <h2 className="text-title-medium font-bold text-on-surface-foreground dark:text-on-surface-foreground-dark">
      {children}
    </h2>
  ),
  p: ({ children }: PropsWithChildren) => (
    <p className="text-body-medium text-on-surface-foreground dark:text-on-surface-foreground-dark">
      {children}
    </p>
  ),
  FeatureList: ({ children }: PropsWithChildren) => <Features></Features>,
};

interface ProjectDetailViewProps {
  compiledSource: string;
  scope: Record<string, unknown>;
  frontmatter: Record<string, unknown>;
}

export default function ProjectDetailView({
  compiledSource,
  scope,
  frontmatter,
}: ProjectDetailViewProps) {
  return (
    <article className="prose">
      <MDXRemote
        components={mdxComponentsMap}
        compiledSource={compiledSource}
        scope={scope}
        frontmatter={frontmatter}
      />
    </article>
  );
}
