import SiteLink from '@/components/link/SiteLink';
import ProfileWork from '@/components/profile/ProfileWork';
import '@/components/profile/profile.css';
import JsonLd from '@/components/seo/JsonLd';
import SharedTitle from '@/components/site/SharedTitle';
import TopBar, { COLUMN } from '@/components/site/TopBar';

import { getMediaMentions } from '@/lib/media';
import { graph, personLd, webPageLd, websiteLd } from '@/lib/seo/jsonld';
import { pageMetadata, sitePage } from '@/lib/site';

const researchPage = sitePage('/research');
const coverageDate = new Intl.DateTimeFormat('en-US', {
  // The media source records a calendar date rather than an instant.
  timeZone: 'UTC',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
const questions = [
  {
    title: 'What is the nature of intelligence?',
    description:
      'How we define intelligence changes what we try to build and how we decide whether it works.',
  },
  {
    title: 'How can knowledge be shared between AI systems?',
    description:
      'Learning something once should be useful beyond the system that learned it. What would it take to share knowledge across different models?',
  },
  {
    title: 'How does higher-order reasoning arise from lower-order functions?',
    description:
      'Understanding the mechanisms behind reasoning could help explain how learned representations become useful behavior.',
  },
];

export const metadata = pageMetadata({
  title: researchPage.label,
  description: researchPage.description,
  path: researchPage.path,
});

export default function ResearchPage() {
  const coverage = getMediaMentions({ includeDrafts: false }).find(
    (mention) => mention.id === 'ut-dallas-clark-scholars'
  );

  return (
    <>
      <JsonLd
        data={graph(
          webPageLd({
            name: researchPage.label,
            description: researchPage.description,
            path: researchPage.path,
          }),
          websiteLd(),
          personLd()
        )}
      />
      <TopBar
        column="content"
        crumbs={[{ label: researchPage.label, href: researchPage.path }]}
      />
      <main
        id="main"
        className={`profile-page mx-auto pb-20 ${COLUMN.content}`}
      >
        <header className="profile-page__header">
          <SharedTitle id="page-research" size="large">
            <h1 className="inline-block text-display-small">
              {researchPage.label}
            </h1>
          </SharedTitle>
          <div className="profile-page__intro">
            <p className="profile-page__lede">
              What does it take to build an intelligent computer for everyone?
            </p>
            <p className="text-body-large text-muted profile-background">
              My research interests include machine perception, multimodal
              models, and machine understanding. My current work on{' '}
              <SiteLink href="/?detail=rtc" className="link-animated">
                Project Lovelace
              </SiteLink>{' '}
              puts those interests alongside the practical work of building
              software for people.
            </p>
          </div>
        </header>

        <section
          className="profile-section"
          aria-labelledby="research-questions"
        >
          <h2 id="research-questions" className="text-headline-small">
            Questions I return to
          </h2>
          <ol className="research-questions">
            {questions.map((question, index) => (
              <li key={question.title}>
                <span
                  aria-hidden="true"
                  className="research-questions__number text-label-medium"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="text-title-large">{question.title}</h3>
                  <p className="text-body-large text-muted">
                    {question.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="profile-section"
          aria-labelledby="research-practice"
        >
          <h2 id="research-practice" className="text-headline-small">
            Current work
          </h2>
          <ProfileWork ids={['transitmapper', 'rtc']} />
        </section>

        {coverage && (
          <section
            className="profile-section"
            aria-labelledby="research-background"
          >
            <h2 id="research-background" className="text-headline-small">
              Earlier research
            </h2>
            <div className="research-coverage">
              <p className="text-label-medium text-muted">
                {coverage.publication} ·{' '}
                <time dateTime={coverage.published}>
                  {coverageDate.format(new Date(coverage.published))}
                </time>
              </p>
              <h3 className="mt-3 text-title-large">
                <SiteLink href={coverage.url} className="link-animated">
                  {coverage.title}
                </SiteLink>
              </h3>
              <p className="mt-3 text-body-large text-muted">
                My 2019 work in the Anson L. Clark Summer Research Program
                explored relationships between objects in images using computer
                vision. UT Dallas covered the research symposium.
              </p>
            </div>
          </section>
        )}

        <p className="profile-page__contact text-body-large">
          <SiteLink href="/about" className="link-animated">
            More about me
          </SiteLink>
        </p>
      </main>
    </>
  );
}
