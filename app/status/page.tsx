import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';
import TopBar from '@/components/site/TopBar';
import LocalConditions from '@/components/status/LocalConditions';
import '@/components/status/status.css';

import { detailHref } from '@/lib/entities/ventures';
import { ventures } from '@/lib/home/ventures';
import { pageMetadata, sitePage } from '@/lib/site';
import { getAllWritings } from '@/lib/writings';

const PAGE = sitePage('/status');

export const metadata = pageMetadata({
  title: PAGE.label,
  description: PAGE.description,
  path: PAGE.path,
});

export default async function StatusPage() {
  const writings = (await getAllWritings(false)).slice(0, 2);
  const work = ventures.filter(
    (item) => !item.hidden && ['lvbt', 'hypertext', 'rtc'].includes(item.id)
  );
  return (
    <>
      <TopBar
        column="content"
        crumbs={[{ label: PAGE.label, href: PAGE.path }]}
      />
      <main id="main" className="status-page">
        <header className="status-page__intro">
          <p className="status-page__eyebrow">Here & lately</p>
          <h1>A little of life lately.</h1>
          <p>A few things I’m making, sharing, and looking out at.</p>
        </header>
        <div className="status-page__present">
          <LocalConditions />
          <section className="status-work" aria-labelledby="work-heading">
            <h2 id="work-heading">Keeping busy with</h2>
            <p>Software, design, and better transit.</p>
            <ul>
              {work.map((item) => (
                <li key={item.id}>
                  <SiteLink
                    href={detailHref(item.id)}
                    className="status-work__link"
                  >
                    <span>{item.name}</span>
                    <Icon name="arrow-right" />
                  </SiteLink>
                </li>
              ))}
            </ul>
            <SiteLink href="/projects" className="status-page__more">
              More of my work <Icon name="arrow-right" />
            </SiteLink>
          </section>
        </div>
        {writings.length > 0 && (
          <section className="status-writing" aria-labelledby="writing-heading">
            <div className="status-writing__heading">
              <h2 id="writing-heading">Latest writing</h2>
              <SiteLink href="/writings" className="status-page__more">
                All writings <Icon name="arrow-right" />
              </SiteLink>
            </div>
            <div className="status-writing__list">
              {writings.map((writing) => (
                <SiteLink
                  key={writing.slug}
                  href={`/writings/${writing.slug}`}
                  preview={false}
                  className="status-writing__item"
                >
                  <time dateTime={writing.published.toISOString()}>
                    {new Intl.DateTimeFormat('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      timeZone: 'America/Los_Angeles',
                    }).format(writing.published)}
                  </time>
                  <h3>{writing.title}</h3>
                  {writing.description && <p>{writing.description}</p>}
                  <span className="status-writing__read">
                    Read <Icon name="arrow-right" />
                  </span>
                </SiteLink>
              ))}
            </div>
          </section>
        )}
        <p className="status-page__footnote">
          The city is chosen by me. The clock follows local time, and the
          weather updates about every 15 minutes.
        </p>
      </main>
    </>
  );
}
