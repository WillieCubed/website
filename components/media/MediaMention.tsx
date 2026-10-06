import clsx from 'clsx';
import Image from 'next/image';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';

import type { MediaMention as Mention } from '@/lib/media';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  // Calendar dates must not shift a day when rendered in the site's zone.
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
});

export default function MediaMention({ mention }: { mention: Mention }) {
  const { featured, image } = mention;
  return (
    <article
      className={clsx('media-mention', {
        'media-mention--image': image,
        'media-mention--featured': featured,
      })}
      aria-labelledby={`media-${mention.id}`}
    >
      {image && (
        <SiteLink
          href={mention.url}
          target="_blank"
          className="media-mention__image"
          aria-label={`Read ${mention.title} at ${mention.publication}`}
          title={image.credit ? `Image: ${image.credit}` : undefined}
        >
          <Image
            src={image.src}
            alt={image.alt}
            fill
            style={{ objectFit: image.fit }}
            sizes={
              featured
                ? '(max-width: 599px) calc(100vw - 48px), (max-width: 839px) 40vw, 320px'
                : '(max-width: 599px) 80px, 128px'
            }
          />
        </SiteLink>
      )}
      <div className="media-mention__content">
        <div>
          <h3
            id={`media-${mention.id}`}
            className={clsx(
              'media-mention__title',
              featured ? 'text-title-large' : 'text-title-medium'
            )}
          >
            <SiteLink href={mention.url} target="_blank">
              {mention.title}
            </SiteLink>
          </h3>
          <p className="media-mention__meta text-label-medium text-muted">
            <SiteLink
              href={mention.url}
              target="_blank"
              className="link-animated media-mention__publication"
            >
              {mention.publication}
              <Icon name="external" size={12} />
            </SiteLink>
            <span aria-hidden="true">·</span>
            <time dateTime={mention.published}>
              {dateFormat.format(new Date(mention.published))}
            </time>
          </p>
          {mention.excerpt && (
            <details className="media-mention__excerpt">
              <summary className="text-label-medium">
                Excerpt
                <Icon name="chevron-down" size={13} />
              </summary>
              <blockquote className="text-body-medium">
                “{mention.excerpt}”
              </blockquote>
            </details>
          )}
        </div>
        {mention.related && (
          <p className="media-mention__related text-label-medium">
            <SiteLink href={mention.related.href} className="link-animated">
              {mention.related.label}
              <Icon name="external" size={13} />
            </SiteLink>
          </p>
        )}
      </div>
    </article>
  );
}
