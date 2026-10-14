'use client';

import Button from '@/components/site/Button';

import type { WritingController } from './useWritingController';

export default function WritingNotices({
  controller,
}: {
  controller: Pick<
    WritingController,
    | 'conflict'
    | 'recovery'
    | 'setRecovery'
    | 'recoveryKey'
    | 'update'
    | 'editor'
    | 'reloadHead'
  >;
}) {
  const {
    conflict,
    recovery,
    setRecovery,
    recoveryKey,
    update,
    editor,
    reloadHead,
  } = controller;
  return (
    <>
      {recovery && (
        <section className="studio-notice" aria-label="Recovered writing">
          <p>There are unsaved changes from your last visit.</p>
          <Button
            onClick={() => {
              editor?.commands.setContent(recovery.document);
              update(recovery);
              setRecovery(null);
            }}
          >
            Recover changes
          </Button>
          <Button
            onClick={() => {
              sessionStorage.removeItem(recoveryKey);
              setRecovery(null);
            }}
          >
            Keep saved revision
          </Button>
        </section>
      )}
      {conflict && (
        <section className="studio-notice" role="alert">
          <p>
            A newer revision exists. Your writing is still here. Load its
            revision number before explicitly saving your retained changes.
          </p>
          <Button onClick={reloadHead}>
            Keep my changes against latest revision
          </Button>
        </section>
      )}
    </>
  );
}
