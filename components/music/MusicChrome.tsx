'use client';
import type { RefObject } from 'react';

import Icon from '@/components/icons/Icon';
import type { BreadcrumbMenuItem } from '@/components/site/BreadcrumbMenu';
import TopBar from '@/components/site/TopBar';

import type { MusicMode } from '@/lib/music/presentation';

interface Props {
  mode: MusicMode;
  editing: boolean;
  onToggleCuration: () => void;
  onOpenSetup: () => void;
  onRefresh: (() => Promise<void>) | undefined;
  setupToggle: RefObject<HTMLButtonElement | null>;
  curateToggle: RefObject<HTMLButtonElement | null>;
  adminMenuItems?: BreadcrumbMenuItem[];
}
export default function MusicChrome({
  mode,
  editing,
  onToggleCuration,
  onOpenSetup,
  onRefresh,
  setupToggle,
  curateToggle,
  adminMenuItems,
}: Props) {
  return (
    <>
      {mode === 'prototype' && (
        <div className="mp-prototype-bar">
          <span>
            <>
              Local prototype
              <span className="mp-prototype-sample-label">
                {' '}
                · Sample content
              </span>
            </>
          </span>
          <div className="mp-prototype-actions">
            {onRefresh && (
              <button
                className="mp-text-button"
                onClick={() => void onRefresh()}
              >
                Refresh Spotify
              </button>
            )}
            <button
              ref={setupToggle}
              className="mp-text-button"
              onClick={onOpenSetup}
            >
              Show setup
            </button>
            <button
              ref={curateToggle}
              className="mp-text-button"
              onClick={onToggleCuration}
            >
              {editing ? 'View gallery' : 'Curate music'}
              <Icon name={editing ? 'arrow-right' : 'file'} />
            </button>
          </div>
        </div>
      )}
      <MusicTopBar
        mode={mode}
        editing={editing}
        onToggleCuration={onToggleCuration}
        onOpenSetup={onOpenSetup}
        onRefresh={onRefresh}
        adminMenuItems={adminMenuItems}
      />
    </>
  );
}

interface MusicTopBarProps {
  mode: MusicMode;
  editing: boolean;
  onToggleCuration: () => void;
  onOpenSetup: () => void;
  onRefresh: (() => Promise<void>) | undefined;
  adminMenuItems?: BreadcrumbMenuItem[];
}

function MusicTopBar({
  mode,
  editing,
  onToggleCuration,
  onOpenSetup,
  onRefresh,
  adminMenuItems = [],
}: MusicTopBarProps) {
  return (
    <TopBar
      column="wide"
      crumbs={[
        {
          label: 'Music',
          menuItems:
            mode === 'admin'
              ? [
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
                ]
              : undefined,
          href:
            mode === 'prototype'
              ? '/prototypes/music'
              : mode === 'admin'
                ? '/studio/music'
                : '/music',
        },
      ]}
    />
  );
}
