/** A description must contain visible text. Empty alt is reserved for decoration. */
export function hasImageDescription(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function imageAltIssue(alt: unknown, decorative = false): string | null {
  if (decorative) {
    return alt === '' ? null : 'Decorative images must explicitly use alt="".';
  }
  return hasImageDescription(alt)
    ? null
    : 'Image needs nonblank alt text, or an explicit decorative marker and alt="".';
}

export function validatePhotoAlts(
  photos: readonly { alt?: unknown }[]
): string | null {
  const index = photos.findIndex((photo) => !hasImageDescription(photo.alt));
  return index < 0
    ? null
    : `Photo ${index + 1} needs nonblank alt text. Send each photo as a JSON object with value and alt.`;
}
