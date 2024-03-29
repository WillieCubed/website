import { Metadata } from 'next';

import { LinkButton } from '@/components/LinkButton';

export const metadata: Metadata = {
  title: 'Media and Art - Willie Chalmers III',
  description:
    'Outside of doing research and developing software, Willie makes videos and does other creative stuff. Check out The Willie Diaries and more here.',
  openGraph: {
    title: 'Media and Art Initiatives',
    description:
      'Outside of doing research and developing software, Willie makes videos and does other creative stuff. Check out The Willie Diaries and more here.',
    url: '/media',
  },
};

export default function MediaPage() {
  return (
    <main className="p-lg mx-auto max-w-breakpoint-md">
      <section className="flex flex-col justify-center">
        <div id="the-willie-diaries" className="py-lg">
          <div className="text-label-medium font-bold font-display uppercase text-primary">
            Media Project
          </div>
          <div className="font-bold text-headline-medium my-sm font-display">
            The Willie Diaries
          </div>
          <div className="font-display mb-lg">
            The Willie Diaries is a video series about a young man going through
            college.
          </div>
          <div className="space-y-lg">
            <iframe
              className="w-full aspect-video bordered"
              src="https://www.youtube-nocookie.com/embed/videoseries?list=PLeWghFt4u5bOTXAovwRSl4b2Xcpb0y8tF"
              title="The Willie Diaries"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <LinkButton
              href="https://www.youtube.com/playlist?list=PLeWghFt4u5bOTXAovwRSl4b2Xcpb0y8tF"
              icon={
                <svg
                  className="inline"
                  xmlns="http://www.w3.org/2000/svg"
                  height="24px"
                  viewBox="0 0 24 24"
                  width="24px"
                  fill="currentColor"
                >
                  <path d="M0 0h24v24H0V0z" fill="none" />
                  <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                </svg>
              }
              label="View full series"
              openInNewTab
            />
          </div>
        </div>
      </section>
      <section id="initiatives" className="">
        <div id="trees" className="py-lg">
          <div className="text-label-medium font-bold font-display uppercase text-primary">
            Media Project
          </div>
          <div className="group my-sm text-headline-medium font-bold font-display">
            treesofutd
          </div>
          <div className="font-display mb-lg">
            <a
              className="text-primary-dark-2 hover:text-primary-dark-1 dark:text-secondary-light-1 dark:hover:text-secondary underline underline-offset-2"
              href="https://instagram.com/treesofutd"
            >
              @treesofutd
            </a>{' '}
            is a story about life. or something like that. whatever it is, there
            are a lot of trees.
          </div>
        </div>
      </section>
    </main>
  );
}
