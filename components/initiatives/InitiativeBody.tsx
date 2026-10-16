import { mdxComponents } from '@/components/mdx';

import { getCompiledMdx } from '@/lib/mdx/compiled';

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
interface InitiativeBodyProps {
  source: string;
}

export default function InitiativeBody({ source }: InitiativeBodyProps) {
  const Content = getCompiledMdx('narrative', source);
  return (
    <div className="initiative-prose prose prose-lg max-w-none">
      <Content components={components} />
    </div>
  );
}
