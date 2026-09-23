import type { Metadata } from 'next';

import ServerError from '@/components/error/ServerError';

export const metadata: Metadata = {
  title: 'Something went wrong',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ServerErrorPage() {
  return <ServerError />;
}
