import Image from 'next/image';

import SiteLink from '@/components/link/SiteLink';
import ProfileWork from '@/components/profile/ProfileWork';
import '@/components/profile/profile.css';
import JsonLd from '@/components/seo/JsonLd';
import SharedTitle from '@/components/site/SharedTitle';
import TopBar, { COLUMN } from '@/components/site/TopBar';

import { focuses } from '@/lib/home/focuses';
import { ventures } from '@/lib/home/ventures';
import { graph, personLd, webPageLd, websiteLd } from '@/lib/seo/jsonld';
import { pageMetadata, site, sitePage } from '@/lib/site';

const aboutPage = sitePage('/about');
const publicFocusIds = new Set(
  ventures
    .filter((venture) => !venture.hidden)
    .flatMap((venture) => venture.focuses)
);

export const metadata = pageMetadata({
  title: aboutPage.label,
  description: aboutPage.description,
  path: aboutPage.path,
  type: 'profile',
});

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={graph(
          webPageLd({
            name: aboutPage.label,
            description: aboutPage.description,
            path: aboutPage.path,
          }),
          websiteLd(),
          personLd()
        )}
      />
      <TopBar
        column="content"
        crumbs={[{ label: aboutPage.label, href: aboutPage.path }]}
      />
      <main
        id="main"
        className={`profile-page mx-auto pb-20 ${COLUMN.content}`}
      >
        <header className="profile-page__header">
          <SharedTitle id="page-about" size="large">
            <h1 className="inline-block text-display-small">
              {aboutPage.label}
            </h1>
          </SharedTitle>
          <div className="profile-page__intro profile-page__intro--portrait">
            <div>
              <p className="profile-page__lede">
                I build software and systems for people.
              </p>
              <p className="profile-page__summary text-body-large text-muted">
                I&apos;m Willie Chalmers III. I run{' '}
                <SiteLink href="/?detail=lvbt" className="link-animated">
                  Las Vegans for Better Transit
                </SiteLink>
                , the design lab{' '}
                <SiteLink href="/?detail=hypertext" className="link-animated">
                  Hypertext Studio
                </SiteLink>
                , and the{' '}
                <SiteLink href="/?detail=rtc" className="link-animated">
                  Reasonable Tech Company
                </SiteLink>
                .
              </p>
            </div>
            <Image
              src="/assets/headshot.jpg"
              width={1157}
              height={1157}
              sizes="(min-width: 600px) 176px, 144px"
              alt="Willie Chalmers III smiling, wearing glasses, a white shirt, and a red tie."
              className="profile-page__portrait"
            />
          </div>
        </header>

        <section className="profile-section" aria-labelledby="about-focus">
          <h2 id="about-focus" className="text-headline-small">
            What I&apos;m working toward
          </h2>
          <ul className="profile-focuses text-body-large">
            {focuses
              .filter((focus) => publicFocusIds.has(focus.id))
              .map((focus) => (
                <li key={focus.id}>{focus.line}</li>
              ))}
          </ul>
        </section>

        <section className="profile-section" aria-labelledby="about-work">
          <h2 id="about-work" className="text-headline-small">
            Where that work lives
          </h2>
          <ProfileWork ids={['lvbt', 'hypertext', 'rtc']} />
        </section>

        <section className="profile-section" aria-labelledby="about-background">
          <h2 id="about-background" className="text-headline-small">
            A little background
          </h2>
          <div className="profile-background text-body-large text-muted">
            <p>
              I earned a Bachelor of Science in Computer Science at The
              University of Texas at Dallas in August 2023. From 2019 to 2023,
              my work there included AI research and service in the Student
              Senate.
            </p>
            <p>
              My research included computer vision and learning concepts from
              vision and language. I&apos;ve kept the questions that interest me
              on my{' '}
              <SiteLink href="/research" className="link-animated">
                research page
              </SiteLink>
              .
            </p>
          </div>
        </section>

        <div className="profile-page__contact text-body-large">
          <SiteLink
            href={`mailto:${site.emails.hello}`}
            className="link-animated"
          >
            Say hello
          </SiteLink>
          <SiteLink href="/media" className="link-animated">
            Media mentions and appearances
          </SiteLink>
        </div>
      </main>
    </>
  );
}
