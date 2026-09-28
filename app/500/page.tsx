import type { Metadata } from 'next';

import ServerError from '@/components/error/ServerError';

import { bareSocialMetadata } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Something went wrong',
  ...bareSocialMetadata('Something went wrong'),
  robots: {
    index: false,
    follow: false,
  },
};

export default function ServerErrorPage() {
  return <ServerError />;
}
