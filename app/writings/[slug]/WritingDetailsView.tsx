import { MDXRemote } from 'next-mdx-remote/rsc';
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
}

export default function WritingDetailsView({
  source,
}: WritingDetailsViewProps) {
  return (
    <article className="prose prose-theme prose-lg max-w-none prose-headings:scroll-mt-20">
      <MDXRemote
        source={source}
        components={mdxComponents}
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
