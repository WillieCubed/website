import { type JsonLdNode, serializeJsonLd } from '@/lib/seo/jsonld';

/** Renders one JSON-LD script tag. The data is escaped by serializeJsonLd. */
export default function JsonLd({ data }: { data: JsonLdNode }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
