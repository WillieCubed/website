const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

/** Both limits apply to lexicon strings, including the truncation marker. */
export function clipText(
  value: string,
  graphemes: number,
  bytes: number
): string {
  if (
    Buffer.byteLength(value) <= bytes &&
    [...segmenter.segment(value)].length <= graphemes
  )
    return value;
  let result = '';
  let count = 0;
  for (const { segment } of segmenter.segment(value)) {
    if (
      count >= graphemes - 1 ||
      Buffer.byteLength(result + segment + '…') > bytes
    )
      break;
    result += segment;
    count++;
  }
  return result + '…';
}
