import { absoluteUrl, site } from '@/lib/site';

export const OPENSEARCH_CONTENT_TYPE =
  'application/opensearchdescription+xml; charset=utf-8';

/**
 * The OpenSearch description browsers use to offer this site as a search
 * engine in the address bar. It sends the query to the on-site search page.
 */
export function buildOpenSearchXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>${site.shortName}</ShortName>
  <Description>Search ${site.name}</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image width="16" height="16" type="image/x-icon">${absoluteUrl('/favicon.ico')}</Image>
  <Url type="text/html" method="get" template="${site.origin}/search?q={searchTerms}" />
</OpenSearchDescription>
`;
}
