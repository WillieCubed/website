import { type DefaultTreeAdapterMap, parse, serializeOuter } from 'parse5';

type Element = DefaultTreeAdapterMap['element'];
type Parent = DefaultTreeAdapterMap['parentNode'];
function* elements(node: Parent): Generator<Element> {
  for (const child of node.childNodes) {
    if (!('tagName' in child)) continue;
    yield child;
    yield* elements(child);
  }
}
const attribute = (node: Element, name: string) =>
  node.attrs.find((attr) => attr.name === name)?.value;
export function resolvedDocumentLinks(
  html: string,
  finalUrl: string
): {
  base: string;
  links: string[];
  entries: { html: string; links: string[] }[];
} {
  const document = parse(html);
  let base = finalUrl;
  const firstBase = [...elements(document)].find(
    (element) =>
      element.tagName === 'base' && attribute(element, 'href') !== undefined
  );
  try {
    const candidate = new URL(
      firstBase ? attribute(firstBase, 'href')! : finalUrl,
      finalUrl
    );
    if (
      ['http:', 'https:'].includes(candidate.protocol) &&
      !candidate.username &&
      !candidate.password
    )
      base = candidate.href;
  } catch {
    /* A missing or invalid base leaves the final response URL in force. */
  }
  const linksIn = (parent: Parent): string[] =>
    [...elements(parent)].flatMap((element) => {
      const value =
        element.tagName === 'base'
          ? undefined
          : (attribute(element, 'href') ?? attribute(element, 'src'));
      if (value === undefined) return [];
      try {
        const url = new URL(value, base);
        return ['http:', 'https:'].includes(url.protocol) ? [url.href] : [];
      } catch {
        return [];
      }
    });
  return {
    base,
    links: linksIn(document),
    entries: [...elements(document)]
      .filter((element) =>
        attribute(element, 'class')?.split(/\s+/).includes('h-entry')
      )
      .map((entry) => ({ html: serializeOuter(entry), links: linksIn(entry) })),
  };
}
export function sameDocumentUrl(left: string, right: string): boolean {
  try {
    return new URL(left).href === new URL(right).href;
  } catch {
    return false;
  }
}
