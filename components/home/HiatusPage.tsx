/** The placeholder shown at `/` while SITE_MODE=hiatus. */
export function HiatusPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-surface-container px-lg">
      <h1 className="text-center font-display text-display-small text-on-surface tablet:text-display-medium">
        <span className="text-primary">Willie</span> will return shortly.
      </h1>
    </main>
  );
}
