import Button from '@/components/site/Button';

interface WritingNoticesProps {
  conflict: boolean;
  recovery: boolean;
  onRecover: () => void;
  onDiscard: () => void;
  onRebase: () => Promise<void>;
}

export default function WritingNotices({
  conflict,
  recovery,
  onRecover,
  onDiscard,
  onRebase,
}: WritingNoticesProps) {
  return (
    <>
      {recovery && (
        <section className="studio-notice" aria-label="Recovered writing">
          <p>There are unsaved changes from your last visit.</p>
          <Button onClick={onRecover}>Recover changes</Button>
          <Button onClick={onDiscard}>Keep saved revision</Button>
        </section>
      )}
      {conflict && (
        <section className="studio-notice" role="alert">
          <p>
            A newer revision exists. Your writing is still here. Load its
            revision number before explicitly saving your retained changes.
          </p>
          <Button onClick={onRebase}>
            Keep my changes against latest revision
          </Button>
        </section>
      )}
    </>
  );
}
