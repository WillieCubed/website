'use client';
import type { ReactNode } from 'react';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';

import type { MusicPublication } from '@/lib/music/types';

interface MusicOperationNoticeProps {
  error: string;
  onDismiss: () => void;
  children?: ReactNode;
}

function MusicOperationNotice({
  error,
  onDismiss,
  children,
}: MusicOperationNoticeProps) {
  if (error.length === 0) return null;
  return (
    <div className="music-admin-notice" role="alert">
      <p>{error}</p>
      <div className="music-admin-notice__actions">
        {children}
        <button
          className="music-admin-notice__close"
          aria-label="Dismiss message"
          onClick={onDismiss}
        >
          <Icon name="x" size={18} />
        </button>
      </div>
    </div>
  );
}

interface SaveNoticeProps {
  error: string;
  blocked: boolean;
  conflict: boolean;
  reconnect: boolean;
  onRetry: () => Promise<void>;
  onUseSaved: () => Promise<void>;
  onConnect: () => Promise<void>;
  onDismiss: () => void;
}
export function MusicSaveNotice({
  error,
  blocked,
  conflict,
  reconnect,
  onRetry,
  onUseSaved,
  onConnect,
  onDismiss,
}: SaveNoticeProps) {
  return (
    error.length > 0 && (
      <div className="music-admin-notice" role="alert">
        <p>{error}</p>
        <div className="music-admin-notice__actions">
          {blocked && (
            <button
              className="mp-button mp-tonal"
              onClick={() => void onRetry()}
            >
              {conflict ? 'Save my version' : 'Retry save'}
            </button>
          )}
          {conflict && (
            <button
              className="mp-button mp-tonal"
              onClick={() => void onUseSaved()}
            >
              Use current saved draft
            </button>
          )}
          {reconnect && (
            <button className="mp-button" onClick={() => void onConnect()}>
              Reconnect Spotify
            </button>
          )}
          {!blocked && !reconnect && (
            <button
              className="music-admin-notice__close"
              aria-label="Dismiss message"
              onClick={() => onDismiss()}
            >
              <Icon name="x" size={18} />
            </button>
          )}
        </div>
      </div>
    )
  );
}

interface RecoveryNoticeProps {
  available: boolean;
  disabled: boolean;
  onRecover: () => void;
  onDiscard: () => void;
}
export function MusicRecoveryNotice({
  available,
  disabled,
  onRecover,
  onDiscard,
}: RecoveryNoticeProps) {
  return (
    available && (
      <div className="music-admin-notice" role="status">
        <p>This browser has an unsaved draft.</p>
        <div className="music-admin-notice__actions">
          <button className="mp-button" disabled={disabled} onClick={onRecover}>
            Recover draft
          </button>
          <button
            className="mp-button mp-tonal"
            disabled={disabled}
            onClick={onDiscard}
          >
            Use saved draft
          </button>
        </div>
      </div>
    )
  );
}

interface PublicationNoticeProps {
  publication: MusicPublication | null;
  visible: boolean;
  onRetry: () => Promise<void>;
  onDismiss: () => void;
}
export function MusicPublicationNotice({
  publication,
  visible,
  onRetry,
  onDismiss,
}: PublicationNoticeProps) {
  return (
    publication !== null &&
    visible && (
      <div className="music-admin-notice" role="status">
        <p>{publicationStatusMessage(publication)}</p>
        <div className="music-admin-notice__actions">
          {publication.status === 'failed' && (
            <button className="mp-button" onClick={() => void onRetry()}>
              Retry publication
            </button>
          )}
          {publication.pullRequestUrl && publication.status !== 'live' && (
            <SiteLink
              href={publication.pullRequestUrl}
              target="_blank"
              preview={false}
            >
              View publication
            </SiteLink>
          )}
          {publication.status === 'live' && (
            <SiteLink href="https://willie.page/music" preview={false}>
              View gallery
            </SiteLink>
          )}
          {publication.status !== 'publishing' &&
            publication.status !== 'deploying' && (
              <button
                className="music-admin-notice__close"
                aria-label="Dismiss publication message"
                onClick={() => onDismiss()}
              >
                <Icon name="x" size={18} />
              </button>
            )}
        </div>
      </div>
    )
  );
}

function publicationStatusMessage(publication: MusicPublication) {
  if (publication.status === 'live') return 'The collection is live.';
  if (publication.status === 'deploying') return 'Deploying the collection…';
  if (publication.status === 'publishing')
    return 'Publishing the reviewed collection…';
  return publication.error ?? 'Publication failed.';
}

interface MusicOperationError {
  error: string;
  onDismiss: () => void;
  action?: ReactNode;
}
interface MusicOperationErrorsProps {
  notices: MusicOperationError[];
}
export function MusicOperationErrors({ notices }: MusicOperationErrorsProps) {
  return notices.map(({ error, onDismiss, action }, index) => (
    <MusicOperationNotice key={index} error={error} onDismiss={onDismiss}>
      {action}
    </MusicOperationNotice>
  ));
}

interface MusicLibraryNoticesProps {
  loadError: string;
  connectError: string;
  refreshError: string;
  onDismissLoad: () => void;
  onDismissConnect: () => void;
  onDismissRefresh: () => void;
  reconnect: boolean;
  onRetry: () => void;
  onConnect: () => Promise<void>;
}
export function MusicLibraryNotices({
  loadError,
  connectError,
  refreshError,
  onDismissLoad,
  onDismissConnect,
  onDismissRefresh,
  reconnect,
  onRetry,
  onConnect,
}: MusicLibraryNoticesProps) {
  return (
    <>
      <MusicOperationNotice error={loadError} onDismiss={onDismissLoad}>
        <button className="mp-button mp-tonal" onClick={onRetry}>
          Try again
        </button>
      </MusicOperationNotice>
      <MusicOperationNotice error={connectError} onDismiss={onDismissConnect} />
      <MusicOperationNotice error={refreshError} onDismiss={onDismissRefresh}>
        {reconnect && (
          <button className="mp-button" onClick={() => void onConnect()}>
            Reconnect Spotify
          </button>
        )}
      </MusicOperationNotice>
    </>
  );
}
