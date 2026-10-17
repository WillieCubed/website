import { redirect } from 'next/navigation';

import { PREVIEW_ORIGIN } from '@/lib/studio/config';

export const metadata = {
  title: 'Admin',
};
export default function Admin() {
  redirect(`${PREVIEW_ORIGIN}/studio`);
}
