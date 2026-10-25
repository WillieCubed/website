import type { BreadcrumbMenuItem } from '@/components/site/BreadcrumbMenu';
import TopBar from '@/components/site/TopBar';

interface Props {
  editing: boolean;
  onToggleCuration: () => void;
  onOpenSetup: () => void;
  onRefresh: (() => Promise<void>) | undefined;
  adminMenuItems?: BreadcrumbMenuItem[];
}

export default function MusicChrome({
  editing,
  onToggleCuration,
  onOpenSetup,
  onRefresh,
  adminMenuItems = [],
}: Props) {
  return (
    <TopBar
      column="wide"
      crumbs={[
        {
          label: 'Music',
          menuItems: [
            {
              label: editing ? 'View gallery' : 'Curate music',
              onSelect: onToggleCuration,
            },
            {
              label: 'Choose playlists',
              onSelect: onOpenSetup,
            },
            ...(onRefresh
              ? [
                  {
                    label: 'Refresh Spotify',
                    onSelect: () => void onRefresh(),
                  },
                ]
              : []),
            ...adminMenuItems,
            { label: 'Studio', href: '/studio' },
            {
              label: 'Live music page',
              href: 'https://willie.page/music',
            },
          ],
          href: '/studio/music',
        },
      ]}
    />
  );
}
