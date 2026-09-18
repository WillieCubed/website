import SiteLink from '@/components/link/SiteLink';

import type { Initiative, Part } from '@/lib/initiatives';

interface PartNavProps {
  initiative: Initiative;
  part: Part;
}

/** Previous and next act, and the way back to the campaign. */
export default function PartNav({ initiative, part }: PartNavProps) {
  const index = initiative.parts.findIndex((p) => p.number === part.number);
  const previous = initiative.parts[index - 1];
  const next = initiative.parts[index + 1];
  const label = initiative.partLabel;

  return (
    <nav
      aria-label={`${initiative.title} navigation`}
      className="mt-12 grid gap-3 border-t border-line pt-6 medium:grid-cols-3"
    >
      <div>
        {previous && (
          <SiteLink
            preview={false}
            href={`${initiative.href}/${previous.slug}`}
            className="group block rounded-xl p-3 transition-colors hover:bg-tray"
          >
            <span className="block text-label-small text-muted">
              ← {label} {previous.number}
            </span>
            <span className="text-title-small text-ink group-hover:underline">
              {previous.title}
            </span>
          </SiteLink>
        )}
      </div>
      <div className="text-center">
        <SiteLink
          preview={false}
          href={initiative.href}
          className="inline-block rounded-full border border-line px-4 py-2 text-label-large text-ink transition-colors hover:bg-tray"
        >
          All of {initiative.title}
        </SiteLink>
      </div>
      <div className="text-right">
        {next && (
          <SiteLink
            preview={false}
            href={`${initiative.href}/${next.slug}`}
            className="group block rounded-xl p-3 transition-colors hover:bg-tray"
          >
            <span className="block text-label-small text-muted">
              {label} {next.number} →
            </span>
            <span className="text-title-small text-ink group-hover:underline">
              {next.title}
            </span>
          </SiteLink>
        )}
      </div>
    </nav>
  );
}
