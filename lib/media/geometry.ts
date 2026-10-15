import { imageDimensions } from '@/lib/content/generated-content';

/** Source metadata and a presentation slot are distinct: unknown size stays unknown. */
export function imageMetadata(
  src: string | undefined,
  width?: unknown,
  height?: unknown
) {
  const w = Number(width),
    h = Number(height);
  if (
    Number.isFinite(w) &&
    Number.isFinite(h) &&
    w > 0 &&
    h > 0 &&
    w <= 16384 &&
    h <= 16384
  )
    return { width: w, height: h };
  return src ? imageDimensions[src.split(/[?#]/)[0]] : undefined;
}
