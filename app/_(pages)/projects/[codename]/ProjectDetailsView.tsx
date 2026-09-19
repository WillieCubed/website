import { MDXRemote } from 'next-mdx-remote/rsc';
import { PropsWithChildren } from 'react';
import rehypeSlug from 'rehype-slug';

import Features from '@/components/projects/FeatureList';

const mdxComponentsMap = {
  h1: ({ children }: PropsWithChildren) => (
    <h1 className="text-headline-small font-bold text-on-surface">
      {children}
    </h1>
  ),
  h2: ({ children }: PropsWithChildren) => (
    <h2 className="text-title-medium font-bold text-on-surface">{children}</h2>
  ),
  h3: ({ children }: PropsWithChildren) => (
    <h3 className="text-title-small font-bold text-on-surface">{children}</h3>
  ),
  p: ({ children }: PropsWithChildren) => (
    <p className="text-body-medium text-on-surface">{children}</p>
  ),
  strong: ({ children }: PropsWithChildren) => (
    <strong className="text-body-medium text-on-surface">{children}</strong>
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
    <li className="text-body-medium text-on-surface">{children}</li>
  ),
  FeatureList: ({ children }: PropsWithChildren) => <Features></Features>,
};

interface ProjectDetailViewProps {
  source: string;
}

export default function ProjectDetailView({ source }: ProjectDetailViewProps) {
  return (
    <article className="prose">
      <MDXRemote
        source={source}
        components={mdxComponentsMap}
        options={{ mdxOptions: { rehypePlugins: [rehypeSlug] } }}
      />
    </article>
  );
}
