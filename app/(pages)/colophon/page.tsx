export default function ColophonPage() {
  return (
    <div className="min-h-[75vh]">
      <main className="p-lg gridded max-w-breakpoint-2xl mx-auto">
        <div className="mt-8 mb-8 tablet:row-span-1 tablet:col-start-2 tablet:col-span-8">
          <div className="text-display-small font-display">Colophon</div>
          <div className="mt-lg space-y-lg *:text-body-medium">
            <p>
              This site is built with Next.js, Tailwind CSS, and TypeScript.
            </p>
            <p>
              The source code is available on{' '}
              <a
                href="https://github.com/WillieCubed/website"
                className="text-primary hover:underline focus:underline underline-offset-2"
              >
                GitHub
              </a>
              .
            </p>
            <p>
              The site-wide font used is{' '}
              <a href="https://fonts.google.com/specimen/Work+Sans">
                Work Sans
              </a>
              .
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
