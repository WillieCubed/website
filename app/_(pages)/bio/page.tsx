import { redirect } from 'next/navigation';

/**
 * A page with a more detailed biography of me.
 *
 * Route: /bio
 */
export default function BioPage() {
  // TODO: Actually write a bio
  redirect('/about');
}
