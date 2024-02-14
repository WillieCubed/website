'use client';

import { MDXRemote } from 'next-mdx-remote';
import { PropsWithChildren, ReactNode } from 'react';
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
  h3: ({ children }: PropsWithChildren) => (
    <h3 className="text-title-small font-bold text-on-surface-foreground dark:text-on-surface-foreground-dark">
      {children}
    </h3>
  ),
  p: ({ children }: PropsWithChildren) => (
    <p className="text-body-medium text-on-surface-foreground dark:text-on-surface-foreground-dark">
      {children}
    </p>
  ),
  strong: ({ children }: PropsWithChildren) => (
    <strong className="text-body-medium text-on-surface-foreground dark:text-on-surface-foreground-dark">
      {children}
    </strong>
  ),
  a: ({ children, ...props }: PropsWithChildren) => (
    <a
      {...props}
      className="text-primary hover:underline focus:underline underline-offset-2"
    >
      {children}
    </a>
  ),
  ul: ({ children }: PropsWithChildren) => (
    <ul className="list-disc">{children}</ul>
  ),
  li: ({ children }: PropsWithChildren) => (
    <li className="text-body-medium text-on-surface-foreground dark:text-on-surface-foreground-dark">
      {children}
    </li>
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
        components={mdxComponentsMap as MDXComponents}
        compiledSource={compiledSource}
        scope={scope}
        frontmatter={frontmatter}
      />
    </article>
  );
}
