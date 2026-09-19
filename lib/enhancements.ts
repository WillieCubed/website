import taglines from './tagline_data.json';

/**
 * Generate a random tagline quote.
 */
export function randomlyChooseTagline() {
  const count = taglines.length;
  const index = Math.floor(Math.random() * count);
  return taglines[index];
}

/**
 * Where a tagline leads, when it leads anywhere. The one that names HTTP
 * status 418 is a real page: /coffee answers with it.
 */
export function taglineHref(tagline: string): string | undefined {
  return /^418\b/.test(tagline) ? '/coffee' : undefined;
}
