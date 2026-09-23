import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';

/**
 * A page that redirects to a random page on the site.
 */
export default function RandomPage() {
  return (
    <Suspense fallback={null}>
      <RandomRedirect />
    </Suspense>
  );
}

async function RandomRedirect() {
  await connection();
  redirect(getRandomPage());
  return null;
}

// TODO: Actually use all possible pages.
const PAGES = [
  '/projects/hackportal',
  '/projects/logdate',
  '/research/concept-learning',
  '/research/court-polarization',
];

/**
 * Returns a random page from the list of possible pages.
 *
 * @return The route to a random page
 */
function getRandomPage() {
  return PAGES[Math.floor(Math.random() * PAGES.length)];
}
