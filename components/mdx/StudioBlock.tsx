import SiteLink from '@/components/link/SiteLink';

import { decodePortableMarkdown } from '@/lib/indieweb/feeds/html';

interface StudioBlockProps {
  id: string;
  version: string;
  src: string;
  portable: string;
  title?: string;
}

/** Only publication-produced, immutable bundles may run in an opaque iframe. */
export function approvedBundlePath(
  id: string,
  version: string,
  src: string
): boolean {
  if (
    typeof id !== 'string' ||
    typeof version !== 'string' ||
    typeof src !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      id
    ) ||
    !/^\d+\.\d+\.\d+$/.test(version)
  )
    return false;
  const prefix = `/generated-blocks/${id}/${version}-`;
  return (
    src.startsWith(prefix) &&
    /^[a-f0-9]{20}\.html$/.test(src.slice(prefix.length))
  );
}

export default function StudioBlock({
  id,
  version,
  src,
  portable,
  title = 'Interactive component',
}: StudioBlockProps) {
  const alternative =
    typeof portable === 'string' ? decodePortableMarkdown(portable) : null;
  if (!alternative)
    return (
      <p role="note">
        This component is unavailable because its readable alternative is
        missing.
      </p>
    );
  const safe = approvedBundlePath(id, version, src);
  const blockId = `studio-block-${id}-${version}`;
  const alternativeId = `${blockId}-alternative`;
  return (
    <figure id={blockId} className="my-6 space-y-3">
      {safe && (
        <iframe
          src={src}
          title={title}
          sandbox="allow-scripts"
          loading="lazy"
          referrerPolicy="no-referrer"
          aria-describedby={alternativeId}
          className="h-96 w-full rounded-lg border border-outline-variant"
        />
      )}
      <figcaption
        id={alternativeId}
        className="space-y-2 text-body-medium leading-relaxed text-on-surface"
      >
        <p className="whitespace-pre-wrap">{alternative}</p>
        {safe && (
          <SiteLink
            href={src}
            preview={false}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open interactive version
          </SiteLink>
        )}
      </figcaption>
    </figure>
  );
}
