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
        <div className="px-[24px] pt-[24px] md:py-[128px] mx-auto md:grid md:grid-cols-12 gap-x-4">
          <Image
            src={headshot}
            alt=""
            className="w-full md:col-start-2 md:col-span-3 lg:col-start-2 border-4 border-black"
          />
          <div className="py-4 md:py-0 md:col-start-6 md:col-start-5 md:col-end-12">
            <div className="py-5 space-y-8">
              <div className="text-display-medium md:text-display-large font-display stroke">
                I&apos;m Willie.
              </div>
              <div className="text-3xl md:text-display-large font-display font-semibold">
                I&apos;m an undergraduate student studying computer science at
                The&nbsp;University of Texas at Dallas.
              </div>
              <div className="text-xl md:text-display-medium font-semibold font-display">
                I research autonomous machine intelligence and build tools
                that bring people together.
              </div>
            </div>
            <div className="mt-4 md:space-x-4 space-y-4">
              <LinkButton href="/projects#research-projects">
                See research
              </LinkButton>
              {/* TODO: Enable once routes are implemented */}
              {/* <LinkButton href="/research">See research</LinkButton> */}
              {/* <LinkButton href="/about">Read full bio</LinkButton> */}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
