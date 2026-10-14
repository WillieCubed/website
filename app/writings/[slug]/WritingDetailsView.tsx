import type { PropsWithChildren } from 'react';

import { mdxComponents } from '@/components/mdx';

import { getCompiledMdx } from '@/lib/mdx/compiled';

interface WritingDetailsViewProps {
  source: string;
  largeText?: boolean;
}

const noteComponents = {
  ...mdxComponents,
  p: ({ children }: PropsWithChildren) => (
    <p className="my-4 text-body-large leading-relaxed text-on-surface">
      {children}
    </p>
  ),
};

export default function WritingDetailsView({
  source,
  largeText = false,
}: WritingDetailsViewProps) {
  const Content = getCompiledMdx('writing', source);
  return (
    <article
      className={`prose prose-theme max-w-none prose-headings:scroll-mt-20 ${largeText ? 'prose-xl' : 'prose-lg'}`}
    >
      <Content components={largeText ? noteComponents : mdxComponents} />
    </article>
  );
}
