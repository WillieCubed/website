import taglines from './tagline_data.json';

/**
 * Generate a random tagline quote.
 */
export function randomlyChooseTagline() {
  const count = taglines.length;
  const index = Math.floor(Math.random() * count);
  return taglines[index];
}
