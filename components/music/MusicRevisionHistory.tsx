import Button from '@/components/site/Button';
import Modal from '@/components/site/Modal';

import type { MusicRevision } from '@/lib/music/types';

interface Props {
  revisions: MusicRevision[] | null;
  busy: boolean;
  currentRevisionId: string | null;
  onClose: () => void;
  onRestore: (revisionId: string) => Promise<void>;
}
export default function MusicRevisionHistory({
  revisions,
  busy,
  currentRevisionId,
  onClose,
  onRestore,
}: Props) {
  return (
    revisions && (
      <Modal
        open
        className="music-history"
        onDismiss={onClose}
        aria-labelledby="music-history-title"
      >
        <div>
          <h2 id="music-history-title">Saved revisions</h2>
          <Button variant="quiet" size="small" onClick={() => onClose()}>
            Close history
          </Button>
          <ol>
            {revisions.map((r) => (
              <li key={r.id}>
                <span>
                  {new Date(r.createdAt).toLocaleString()} ·{' '}
                  {r.body.selected.length} playlists
                  {r.conflict ? ' · Conflict copy' : ''}
                </span>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={busy || r.id === currentRevisionId}
                  onClick={() => void onRestore(r.id)}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ol>
        </div>
      </Modal>
    )
  );
}
