import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';

import { isPlainClick } from '@/lib/dom/click';
import type { MusicEnding } from '@/lib/music/easter-eggs';

interface Props {
  ending: MusicEnding;
  href?: string;
  onOpen: (id: string) => void;
}

/** A quiet, static discovery after the last song; native navigation is the baseline. */
export default function PlaylistEnding({ ending, href, onOpen }: Props) {
  return (
    <aside className="mp-playlist-ending" aria-label="Playlist ending">
      <Icon name="music" size={20} />
      <p>
        {ending.message}
        {ending.link && href && (
          <>
            {' '}
            <SiteLink
              href={href}
              preview={false}
              className="mp-playlist-ending-link"
              onClick={(event) => {
                if (!isPlainClick(event)) return;
                event.preventDefault();
                onOpen(ending.link!.id);
              }}
            >
              {ending.link.title}
              <Icon name="arrow-right" size={16} />
            </SiteLink>
          </>
        )}
      </p>
    </aside>
  );
}
