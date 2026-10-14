import { hasImageDescription } from '@/lib/accessibility/alt-policy';

export class MicropubValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MicropubValidationError';
  }
}
export function assertPhotoAlts(photos: readonly { alt?: unknown }[]): void {
  const index = photos.findIndex((photo) => !hasImageDescription(photo.alt));
  if (index >= 0) {
    throw new MicropubValidationError(
      `Photo ${index + 1} needs nonblank alt text. Send each photo as a JSON object with value and alt.`
    );
  }
}
export function photoUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      return url.toString();
    }
  } catch {
    // Falls through to the rejection below.
  }
  throw new Error('invalid_request');
}
