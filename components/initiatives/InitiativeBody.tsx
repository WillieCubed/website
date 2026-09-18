import { MDXRemote } from 'next-mdx-remote/rsc';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

import { mdxComponents } from '@/components/mdx';

import Gallery from './Gallery';
import RouteMap from './RouteMap';
import Scene from './Scene';

const components = {
  ...mdxComponents,
  Scene,
  Gallery,
  RouteMap,
};

/** Renders an initiative or part body with the narrative components. */
export default function InitiativeBody({ source }: { source: string }) {
  return (
    <div className="initiative-prose prose prose-lg max-w-none">
      <MDXRemote
        source={source}
        components={components}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            rehypePlugins: [rehypeSlug],
          },
        }}
      />
    </div>
  );
}
