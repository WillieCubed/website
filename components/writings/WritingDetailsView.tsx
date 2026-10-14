import { MDXRemote } from 'next-mdx-remote/rsc';
import type { PropsWithChildren } from 'react';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';

import { mdxComponents } from '@/components/mdx';

import { remarkBrews } from '@/lib/writings/remark-brews';
import { remarkMentions } from '@/lib/writings/remark-mentions';
import { remarkSidenotes } from '@/lib/writings/remark-sidenotes';
import { remarkSpotify } from '@/lib/writings/remark-spotify';
import { rehypeShiki } from '@/lib/writings/shiki-plugin';

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
  return (
    <article
      className={`prose prose-theme max-w-none prose-headings:scroll-mt-20 ${largeText ? 'prose-xl' : 'prose-lg'}`}
    >
      <MDXRemote
        source={source}
        components={largeText ? noteComponents : mdxComponents}
        options={{
          parseFrontmatter: true,
          mdxOptions: {
            remarkPlugins: [
              remarkFrontmatter,
              remarkGfm,
              remarkSidenotes,
              remarkSpotify,
              remarkMentions,
              remarkBrews,
            ],
            rehypePlugins: [
              rehypeSlug,
              [rehypeAutolinkHeadings, { behavior: 'wrap' }],
              rehypeShiki,
            ],
          },
        }}
      />
    </article>
  );
}
