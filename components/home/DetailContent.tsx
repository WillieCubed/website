import { Constellation } from '@/components/home/Constellation';
import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';

import { isPlainClick } from '@/lib/dom/click';
import { type Detail, type DetailMedia } from '@/lib/home/ventures';

interface MediaProps {
  id: string;
  media: DetailMedia;
  countdown: React.ReactNode;
}

export function Media({ id, media, countdown }: MediaProps) {
  switch (media.kind) {
    case 'countdown':
      return (
        <div className="d-count">
          <b data-morph={id}>{countdown}</b>
          <span>{media.caption}</span>
        </div>
      );
    case 'image':
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={media.src}
          width={media.width}
          height={media.height}
          alt={media.alt}
          className={media.fromLeft ? 'from-left' : undefined}
          data-morph={id}
        />
      );
    case 'stack':
      return (
        <div className="d-stack">
          {media.images.map((image) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={image.src}
              src={image.src}
              width={image.width}
              height={image.height}
              alt={image.alt}
            />
          ))}
        </div>
      );
    case 'constellation':
      return <Constellation morph={id} />;
  }
}
interface BodyProps {
  detail: Detail;
  onOpen: (id: string) => void;
}

export function Body({ detail, onOpen }: BodyProps) {
  return (
    <div className="d-body">
      {detail.body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {detail.list && (
        <ul className="d-list">
          {detail.list.map((item) => (
            <li key={item.title}>
              {item.opens ? (
                <SiteLink
                  href={`/?detail=${item.opens}`}
                  preview={false}
                  onClick={(event) => {
                    if (!isPlainClick(event)) return;
                    event.preventDefault();
                    onOpen(item.opens!);
                  }}
                >
                  <b>
                    {item.title}
                    <Icon name="forward" className="icon" />
                  </b>
                  <span>{item.text}</span>
                </SiteLink>
              ) : (
                <>
                  <b>{item.title}</b>
                  <span>{item.text}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="d-links">
        {detail.links.map((link) => (
          <a key={link.href} href={link.href}>
            {link.label}
            <Icon name="outward" className="icon" />
          </a>
        ))}
      </div>
    </div>
  );
}
