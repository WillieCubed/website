import SiteLink from '@/components/link/SiteLink';

import { siteBuild } from '@/lib/site/build';
import { site } from '@/lib/site/identity';

/** Source acknowledgments and the build record share the page’s credits section. */
export default function Credits() {
  return (
    <section className="colophon-credits" aria-labelledby="credits-title">
      <h2 id="credits-title">Credits</h2>
      <p>
        The source is on{' '}
        <SiteLink href="https://github.com/WillieCubed/website">
          GitHub
        </SiteLink>
        . The <SiteLink href="/brand">brand kit</SiteLink> contains the
        WillieCubed mark, colors, and downloadable assets.
      </p>
      <p className="colophon-tools">
        Built with <SiteLink href="https://nextjs.org/">Next.js</SiteLink>,{' '}
        <SiteLink href="https://react.dev/">React</SiteLink>,{' '}
        <SiteLink href="https://www.typescriptlang.org/">TypeScript</SiteLink>,
        and <SiteLink href="https://tailwindcss.com/">Tailwind CSS</SiteLink>;
        hosted on{' '}
        <SiteLink href="https://workers.cloudflare.com/">
          Cloudflare Workers
        </SiteLink>
        .{' '}
        <a
          // eslint-disable-next-line site/no-raw-internal-anchor -- A plain-text route handler, not a page.
          href="/humans.txt"
        >
          Plain-text credits (humans.txt)
        </a>
        .
      </p>
      <BuildDetails />
    </section>
  );
}

/** Present the served artifact’s version, build time, and producing CI run. */
function BuildDetails() {
  const build = siteBuild();
  const builtAt = build.builtAt ? new Date(build.builtAt) : null;
  const buildDate =
    builtAt &&
    new Intl.DateTimeFormat('en-US', {
      timeZone: site.timeZone,
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(builtAt);
  const buildTime =
    builtAt &&
    new Intl.DateTimeFormat('en-US', {
      timeZone: site.timeZone,
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(builtAt);

  return (
    <section className="colophon-edition" aria-labelledby="edition-title">
      <table className="colophon-build">
        <caption id="edition-title">This build</caption>
        <tbody>
          <tr>
            <th scope="row">Version</th>
            <td>
              {build.revision ? (
                <SiteLink
                  className="colophon-revision"
                  href={`https://github.com/WillieCubed/website/commit/${build.revision}`}
                  aria-label={`View source for revision ${build.revision}`}
                >
                  {build.revision.slice(0, 8)}
                </SiteLink>
              ) : (
                'Revision unavailable'
              )}
              {build.development && (
                <span className="colophon-detail">Development</span>
              )}
            </td>
          </tr>
          <tr>
            <th scope="row">Last built</th>
            <td>
              {builtAt ? (
                <time dateTime={build.builtAt!}>
                  {buildDate} · {buildTime}
                </time>
              ) : (
                'Development server'
              )}
            </td>
          </tr>
          <tr>
            <th scope="row">Build record</th>
            <td>
              {build.buildUrl ? (
                <SiteLink href={build.buildUrl}>
                  {build.provider === 'cloudflare'
                    ? 'Cloudflare build'
                    : 'GitHub Actions run'}{' '}
                  <span aria-hidden="true">↗</span>
                </SiteLink>
              ) : (
                'Built locally'
              )}
              {build.provider === 'cloudflare' && (
                <span className="colophon-detail">Sign-in required</span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
