import SiteLink from '@/components/link/SiteLink';

import { normalizeTag, tagPath } from '@/lib/writings/tags';

const FILTER_CHIP =
  'inline-block shrink-0 rounded-full px-3 py-2 text-label-large transition-colors';
const SELECTED = `${FILTER_CHIP} bg-primary text-on-primary`;
const IDLE = `${FILTER_CHIP} border border-line bg-card text-ink hover:border-accent hover:text-accent`;
/** A writing's category chip: its tags, and the people it names. */
export const CATEGORY_CHIP =
  'inline-block rounded-full border border-line bg-ground px-3 py-1 text-label-medium text-ink transition-colors hover:border-accent hover:text-accent';

interface TagChipsProps {
  tags: string[];
  /**
   * Chips that filter a list of writings: they lead with All and mark the
   * tag the page lists. Without it, the chips name a writing's categories.
   */
  filter?: boolean;
  /** The tag the page lists; All is current when it is unset. */
  currentTag?: string;
  /** Extra classes for each tag's link, such as a microformats property. */
  chipClassName?: string;
  className?: string;
  preview?: boolean;
}

/** A writing's tags, or the tags a list of writings can be narrowed to. */
export default function TagChips({
  tags,
  filter = false,
  currentTag,
  chipClassName,
  className = 'flex flex-wrap gap-2',
  preview,
}: TagChipsProps) {
  if (tags.length === 0) return null;
  const chip = (current: boolean) => {
    if (!filter) return CATEGORY_CHIP;
    return current ? SELECTED : IDLE;
  };
  return (
    <ul aria-label={filter ? 'Filter by tag' : 'Tags'} className={className}>
      {filter && (
        <li className="shrink-0">
          <SiteLink
            href="/writings"
            preview={preview}
            aria-current={!currentTag ? 'page' : undefined}
            className={chip(!currentTag)}
          >
            All
          </SiteLink>
        </li>
      )}
      {tags.map((tag) => {
        const current = filter && currentTag === normalizeTag(tag);
        return (
          <li key={tag} className="shrink-0">
            <SiteLink
              href={tagPath(tag)}
              preview={preview}
              aria-current={current ? 'page' : undefined}
              className={`${chip(current)}${chipClassName ? ` ${chipClassName}` : ''}`}
            >
              {tag}
            </SiteLink>
          </li>
        );
      })}
    </ul>
  );
}
