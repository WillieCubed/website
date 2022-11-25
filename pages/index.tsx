import type { NextPage } from 'next';
import Head from 'next/head';
import Image from 'next/image';
import LinkButton from '../components/LinkButton';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import headshot from '../public/assets/headshot.jpg';

/**
 * The main entrypoint to the site.
 *
 * Route: /
 */
const LandingPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Willie Chalmers III</title>
        <meta
          name="description"
          content="Willie Chalmers III is a student studying computer science at The University of Texas at Dallas and doing research in artficial intelligence. See what he's working on here."
        />
        <link rel="icon" href="/favicon.ico" />

        <meta property="og:title" content="Willie Chalmers III" />
        <meta
          property="og:description"
          content="Willie Chalmers III is a student studying computer science at The University of Texas at Dallas and doing research in artficial intelligence. See what he's working on here."
        />
        <meta property="og:image" content="/assets/headshot.jpg" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://williecubed.me" />
      </Head>

      <SiteHeader />

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
                <div className="text-display-medium md:text-display-large font-display">
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

      <SiteFooter />
    </>
  );
};

export default LandingPage;
