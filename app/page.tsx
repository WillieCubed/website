import Image from 'next/image';
import LinkButton from '../components/LinkButton';
import headshot from '../public/assets/headshot.jpg';

/**
 * The main entrypoint to the site.
 *
 * Route: /
 */
export default function LandingPage() {
  return (
    <main className="">
      <section id="overview" className="bg-primary-light-1 text-white pb-16">
        <div className="px-4 md:px-[24px] md:py-[128px] mx-auto md:grid md:grid-cols-12 gap-x-4">
          <div className="py-4 md:py-0 md:col-start-4 md:col-end-10">
            <article className="p-6 md:p-8 space-y-8 border-4 border-black bg-primary">
              {/* <div className="py-5 space-y-8"> */}
              <div className="text-display-medium md:text-display-large font-display stroke">
                I&apos;m Willie.
              </div>
              <div className="text-3xl md:text-display-large font-display font-semibold">
                I&apos;m an{' '}
                <span className="cursor-pointer" title="not for long 😎">
                  undergraduate student
                </span>{' '}
                studying{' '}
                <span
                  className="cursor-pointer"
                  title="although, perhaps I should have majored in cognitive science"
                >
                  computer science
                </span>{' '}
                at{' '}
                <a
                  className="text-slate-100 hover:text-secondary-dark-1 hover:underline underline-offset-4 transition ease-linear"
                  href="https://utdallas.edu"
                >
                  The&nbsp;University of Texas at Dallas
                </a>
                .
              </div>
              <div className="text-xl md:text-display-medium font-semibold font-display">
                I{' '}
                <span className="text-secondary-light-1">
                  research machine intelligence
                </span>{' '}
                and <span className="text-secondary-light-1">build tools</span>{' '}
                that bring people together.
              </div>
            </article>
            <div className="mt-6 md:space-x-4 space-y-4">
              <LinkButton href="/projects">Browse projects</LinkButton>
              <LinkButton href="/research">See research</LinkButton>
              {/* TODO: Enable once routes are implemented */}
              {/* <LinkButton href="/about">Read full bio</LinkButton> */}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
