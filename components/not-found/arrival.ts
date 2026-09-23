/**
 * What the 404 log says about a visitor who arrived without a referrer. A
 * browser sends none for a typed address or a bookmark, but also for a link
 * in an email or chat app and for any link that withholds it, so this
 * claims no more than that they came with nothing pointing the way.
 */
export const NO_REFERRER = 'came straight here';

interface Arrival {
  /** `document.referrer`, empty when the browser sent none. */
  referrer: string;
  /** The host serving the 404, to tell in-site links from outside ones. */
  host: string;
  /**
   * Whether the document was loaded at this address. After in-site
   * navigation without a reload the referrer names whatever loaded the
   * document first, so it no longer says where the visitor came from.
   */
  loadedHere: boolean;
}

/**
 * How the visitor reached the missing page, phrased for the last frame of
 * the 404 log's trace.
 */
export function describeArrival({
  referrer,
  host,
  loadedHere,
}: Arrival): string {
  if (!loadedHere) return 'followed a link on this site';
  if (!referrer) return NO_REFERRER;
  let from: URL;
  try {
    from = new URL(referrer);
  } catch {
    // A malformed referrer reads the same as none.
    return NO_REFERRER;
  }
  return from.host === host
    ? `followed a link on ${from.pathname}`
    : `followed a link from ${from.host.replace(/^www\./, '')}`;
}
