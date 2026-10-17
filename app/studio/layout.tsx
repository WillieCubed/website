import type { Metadata } from 'next';

import { privateRobots } from '@/lib/seo/metadata';

/** Everything under /studio is the owner's, so no page here is indexed. */
export const metadata: Metadata = { robots: privateRobots };

export default function Layout({ children }: LayoutProps<'/studio'>) {
  return children;
}
