import { type JsonLdNode, serializeJsonLd } from '@/lib/seo/jsonld';

/** Renders one JSON-LD script tag. The data is escaped by serializeJsonLd. */
interface JsonLdProps {
  data: JsonLdNode;
}

export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
