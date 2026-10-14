import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';
import Popover from '@/components/site/Popover';

import { type KitDownload, formatBytes, kit } from '@/lib/brand/kit';

/**
 * A kit file. These are files, not pages, so they stay plain anchors, like
 * the feed links in the footer: a SiteLink would prefetch each one as a
 * route and look it up for a hover card it cannot have.
 */
function Download({
  file,
  showSize = false,
  label,
  shortLabel,
}: {
  file: KitDownload;
  showSize?: boolean;
  label?: string;
  shortLabel?: string;
}) {
  return (
    <a href={file.href} download aria-label={shortLabel ? label : undefined}>
      {shortLabel ? (
        <>
          <span className="brand-download-label-full">{label}</span>
          <span className="brand-download-label-short">{shortLabel}</span>
        </>
      ) : (
        (label ?? file.label)
      )}
      {showSize && (
        <span className="brand-size">{formatBytes(file.bytes)}</span>
      )}
    </a>
  );
}
export function Downloads({
  files,
  showSize = false,
}: {
  files: KitDownload[];
  showSize?: boolean;
}) {
  return (
    <p className="brand-downloads">
      {files.map((file) => (
        <Download key={file.href} file={file} showSize={showSize} />
      ))}
    </p>
  );
}
export function AssetDownloads({
  files,
  png: pngLabel = 'PNG 1024',
}: {
  files: KitDownload[];
  /** The PNG offered beside the SVG; the rest wait under More formats. */
  png?: string;
}) {
  const svg = files.find((file) => file.label === 'SVG');
  const png =
    files.find((file) => file.label === pngLabel) ??
    files.find((file) => file.label === 'PNG');
  const primary = [svg, png].filter((file): file is KitDownload =>
    Boolean(file)
  );
  const other = files.filter((file) => !primary.includes(file));
  return (
    <div className="brand-asset-downloads">
      <p className="brand-downloads">
        {primary.map((file) => (
          <Download
            key={file.href}
            file={file}
            label={`Download ${file === svg ? 'SVG' : 'PNG'}`}
            shortLabel={file === svg ? 'SVG' : 'PNG'}
          />
        ))}
      </p>
      {other.length > 0 && (
        <Popover
          label="More formats"
          trigger={<Icon name="more-horizontal" size={18} />}
          triggerClassName="brand-more-formats"
          panelClassName="brand-picker-panel"
          align="end"
        >
          {other.map((file) => (
            <Download key={file.href} file={file} />
          ))}
        </Popover>
      )}
    </div>
  );
}
function PlatformGuidance({ title }: { title: string }) {
  if (title === 'Web and PWA') {
    return (
      <div className="brand-platform-guide">
        <p>
          Use <code>favicon.svg</code> for browser tabs and{' '}
          <code>apple-touch-icon.png</code> for saved Home Screen shortcuts.
        </p>
        <p>
          For an installable site, the manifest lists the icon sizes and
          maskable versions. Update its name, URLs, and icon paths for the
          project using it.
        </p>
      </div>
    );
  }
  if (title === 'Apple platforms') {
    return (
      <div className="brand-platform-guide">
        <p>
          Open the kit’s complete <code>apple/WillieCubed.icon</code> package in
          Icon Composer, or add it to Xcode 26. Keep its <code>Assets</code>{' '}
          folder with it; <code>icon.json</code> alone does not contain the
          artwork.
        </p>
        <p>
          The kit also includes a macOS <code>.icns</code> file and a flat{' '}
          <code>AppIcon.appiconset</code> for older Xcode projects.
        </p>
        <SiteLink href="https://developer.apple.com/documentation/xcode/creating-your-app-icon-using-icon-composer">
          Apple’s setup guide
        </SiteLink>
      </div>
    );
  }
  return (
    <div className="brand-platform-guide">
      <p>
        Use <code>android/res/</code> as a set. Its foreground, background, and
        monochrome layers let the launcher apply its shape and theme. The PNG
        sizes support older devices.
      </p>
      <p>
        <code>play-store-512.png</code> is for the store listing. Use the
        layered resources for the app’s launcher icon.
      </p>
      <SiteLink href="https://developer.android.com/develop/ui/views/launch/icon_design_adaptive">
        Android’s adaptive icon guide
      </SiteLink>
    </div>
  );
}
export function PlatformFiles({ title }: { title: string }) {
  const group = kit.platforms.find((entry) => entry.title === title);
  if (!group) return null;
  return (
    <div className="brand-platform">
      <details>
        <summary aria-label={`${title}: browse files`}>
          {title}: files and setup
        </summary>
        <h4>{title}</h4>
        <PlatformGuidance title={title} />
        <ul className="brand-files">
          {group.files.map((file) => (
            <li key={file.href}>
              <a href={file.href} download>
                <code>{file.name}</code>
                <span className="brand-size">{formatBytes(file.bytes)}</span>
              </a>
              <span className="brand-purpose">{file.purpose}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
export const capitalize = (word: string) =>
  word[0].toUpperCase() + word.slice(1);
