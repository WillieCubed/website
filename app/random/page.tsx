import { redirect } from 'next/navigation';

/**
 * A page that redirects to a random page on the site.
 */
export default function RandomPage() {
  redirect(getRandomPage());
}

// TODO: Actually use all possible pages.
const PAGES = [
  '/projects/hackportal',
  '/projects/logdate',
  '/research/concept-learning',
  '/research/court-polarization',
  '/media/playlists',
];

/**
 * Returns a random page from the list of possible pages.
 *
 * @return The route to a random page
 */
function getRandomPage() {
  return PAGES[Math.floor(Math.random() * PAGES.length)];
}
