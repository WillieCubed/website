export interface ByteRange {
  offset: number;
  length: number;
}

/** Unsupported syntax falls back to a full response; valid empty ranges fail. */
export function byteRange(
  value: string | null,
  size: number
): ByteRange | null | undefined {
  const match = value?.match(/^bytes=(?:(\d+)-(\d*)|-(\d+))$/);
  if (!match) return undefined;
  if (size === 0) return null;
  if (match[3]) {
    const length = Math.min(Number(match[3]), size);
    return length > 0 ? { offset: size - length, length } : null;
  }
  const offset = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return offset < size && offset <= end
    ? { offset, length: end - offset + 1 }
    : null;
}

/** If-Range permits strong tags or the exact Last-Modified date. */
export function acceptsRange(
  value: string | null,
  tag: string,
  uploaded: Date
): boolean {
  if (!value) return true;
  if (value.startsWith('"')) return value === tag;
  const time = Date.parse(value);
  return (
    Number.isFinite(time) &&
    time === Math.floor(uploaded.getTime() / 1000) * 1000
  );
}
