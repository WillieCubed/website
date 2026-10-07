import { safeParse } from '@atcute/lexicons';
import {
  SiteStandardDocument,
  SiteStandardPublication,
} from '@atcute/standard-site';
import { parse } from 'parse5';

interface HtmlNode {
  tagName?: string;
  attrs?: { name: string; value: string }[];
  childNodes?: HtmlNode[];
}

export function hasDocumentVerification(html: string, uri: string): boolean {
  function visit(node: HtmlNode): boolean {
    const attributes = Object.fromEntries(
      (node.attrs ?? []).map((attr) => [attr.name, attr.value])
    );
    if (
      node.tagName === 'link' &&
      attributes.rel?.split(/\s+/).includes('site.standard.document') &&
      attributes.href === uri
    )
      return true;
    return node.childNodes?.some(visit) ?? false;
  }
  const document = parse(html) as HtmlNode;
  const root = document.childNodes?.find((node) => node.tagName === 'html');
  const head = root?.childNodes?.find((node) => node.tagName === 'head');
  return head ? visit(head) : false;
}

export function publicationIsVerified(
  record: unknown,
  origin: string,
  uri: string,
  endpoint: string
): boolean {
  const checked = safeParse(SiteStandardPublication.mainSchema, record);
  return (
    checked.ok &&
    checked.value.url.replace(/\/$/, '') === origin &&
    endpoint.trim() === uri
  );
}

export function documentIsVerified(
  record: unknown,
  publication: string,
  path: string,
  uri: string,
  html: string
): boolean {
  const checked = safeParse(SiteStandardDocument.mainSchema, record);
  return (
    checked.ok &&
    checked.value.site === publication &&
    checked.value.path === path &&
    hasDocumentVerification(html, uri)
  );
}
