/** Plain output contains no escapes; ANSI output adds foreground color and bold. */
export type TerminalFormat = 'plain' | 'ansi';

type TextSubtype = 'plain' | 'html';
type MediaSpecificity = -1 | 0 | 1 | 2;

interface MediaPreference {
  quality: number;
  mediaSpecificity: MediaSpecificity;
  parameterCount: number;
}

const CURL_USER_AGENT = /^curl\/\S+/i;
const EXPLICIT_PLAIN_TEXT = /(?:^|,)\s*text\/plain\s*(?:;|,|$)/i;
const QUALITY_PARAMETER = /^q=(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;
const UTF8_PARAMETER = /^charset=(?:utf-8|"utf-8")$/;

function mediaSpecificity(
  mediaType: string,
  subtype: TextSubtype
): MediaSpecificity {
  if (mediaType === `text/${subtype}`) return 2;
  if (mediaType === 'text/*') return 1;
  if (mediaType === '*/*') return 0;
  return -1;
}

function parseQuality(parameter: string | undefined): number {
  if (parameter === undefined) return 1;
  return QUALITY_PARAMETER.test(parameter) ? Number(parameter.slice(2)) : 0;
}

function parseMediaRange(
  range: string,
  subtype: TextSubtype
): MediaPreference | undefined {
  const [mediaType, ...rawParameters] = range.trim().toLowerCase().split(';');
  const specificity = mediaSpecificity(mediaType.trim(), subtype);
  if (specificity === -1) return undefined;

  const parameters = rawParameters.map((parameter) => parameter.trim());
  const qualityIndex = parameters.findIndex((parameter) =>
    parameter.startsWith('q=')
  );
  const mediaParameters =
    qualityIndex === -1 ? parameters : parameters.slice(0, qualityIndex);
  // Neither response can satisfy a different charset or format=flowed.
  if (!mediaParameters.every((parameter) => UTF8_PARAMETER.test(parameter)))
    return undefined;

  return {
    quality: parseQuality(
      qualityIndex === -1 ? undefined : parameters[qualityIndex]
    ),
    mediaSpecificity: specificity,
    parameterCount: mediaParameters.length,
  };
}

function compareSpecificity(
  left: MediaPreference,
  right: MediaPreference
): number {
  return (
    left.mediaSpecificity - right.mediaSpecificity ||
    left.parameterCount - right.parameterCount
  );
}

function preferenceFor(accept: string, subtype: TextSubtype): MediaPreference {
  let best: MediaPreference = {
    quality: 0,
    mediaSpecificity: -1,
    parameterCount: 0,
  };
  for (const range of accept.split(',')) {
    const candidate = parseMediaRange(range, subtype);
    if (candidate === undefined) continue;
    const specificity = compareSpecificity(candidate, best);
    // A specific q=0 exclusion must beat an acceptable wildcard.
    if (
      specificity > 0 ||
      (specificity === 0 && candidate.quality > best.quality)
    )
      best = candidate;
  }
  return best;
}

function prefersTerminal(accept: string, curl: boolean): boolean {
  const plain = preferenceFor(accept, 'plain');
  const html = preferenceFor(accept, 'html');
  if (plain.quality === 0 || plain.quality < html.quality) return false;
  if (plain.quality > html.quality) return true;
  // Curl only breaks ties when the client has not explicitly selected HTML.
  if (html.mediaSpecificity === 2) return false;
  return compareSpecificity(plain, html) > 0 || curl;
}

/**
 * Choose the terminal format allowed by Accept, or leave HTML routing in place.
 * Media-range specificity determines each type's quality before their qualities
 * are compared. Higher-quality HTML wins, and an exact HTML range wins a quality
 * tie. Curl breaks otherwise undecided ties without overriding a plain-text
 * exclusion.
 *
 * An explicit text/plain range always disables ANSI styling. Without that
 * override, only curl receives ANSI; other clients selecting text receive plain
 * output. This function does not check the path, method, or authentication.
 */
export function selectTerminalFormat(
  headers: Headers
): TerminalFormat | undefined {
  const accept = headers.get('Accept') ?? '*/*';
  const curl = CURL_USER_AGENT.test(headers.get('User-Agent') ?? '');
  if (!prefersTerminal(accept, curl)) return undefined;
  return curl && !EXPLICIT_PLAIN_TEXT.test(accept) ? 'ansi' : 'plain';
}
