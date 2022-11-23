import type { NextPage } from "next";
import Head from "next/head";
import Image from "next/image";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import headshot from "../public/assets/headshot.jpg";

const LandingPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Willie Chalmers III</title>
        <meta
          name="description"
          content="Everything WillieCubed. See what projects he's working on."
        />
        <link rel="icon" href="/favicon.ico" />

        <meta property="og:title" content="Willie Chalmers III" />
        <meta property="og:image" content="" />
        <meta property="og:type" content="website" />
      </Head>

      {/* TODO: Figure out how to intelligently hide header on load */}
      <SiteHeader showTitle={true} />

      <main className="lg:container max-w-6xl mx-auto lg:top-0 lg:p-4 md:grid md:gap-4 md:grid-cols-12 md:p-4 lg:p-8">
        <section id="about" className="md:col-span-5 lg:col-span-4 lg:sticky">
          <div className="md:mx-auto md:max-w-sm bg-white dark:bg-slate-800 p-4 md:rounded-md shadow-md lg:shadow-sm">
            <h1 className="font-bold font-display text-3xl my-4">About Me</h1>
            <div>
              <div>
                <div className="flex md:block">
                  <div className="shrink w-full h-auto md:flex-none">
                    <Image
                      src={headshot}
                      className="aspect-square rounded-lg bg-slate-200"
                    />
                  </div>
                  <div className="flex-none ml-4 md:ml-0 md:flex-none text-left md:text-center">
                    <div className="mt-2 text-xl font-bold font-display">
                      Willie Chalmers III
                    </div>
                    <p>Undergraduate Student</p>
                    <p className="text-sm text-dark dark:text-on-dark opacity-80">
                      Department of Computer Science
                    </p>
                    <p className="text-sm opacity-66">
                      <a href="https://cs.utdallas.edu">
                        The University of Texas at Dallas
                      </a>
                    </p>
                  </div>
                </div>
                <div className="my-2 text-center lg:text-left">
                  <div className="py-2">
                    I am <span>Willie</span>, an undergraduate student curious
                    about ways to build intelligent systems.
                  </div>
                  <div className="py-2">
                    I also work on a few side projects.
                  </div>
                  <div className="py-2">
                    To get in touch, contact me at{" "}
                    <a href="mailto:willie.chalmers@utdallas.edu">
                      willie.chalmers@utdallas.edu
                    </a>
                    .
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="md:col-span-7 lg:col-span-8 h-screen">
          <section id="interests" className="py-4 px-4 md:px-0">
            <h1 className="font-bold font-display text-3xl">What I Do</h1>
            <div className="font-bold font-display text-lg text-primary">
              Research Interests
            </div>
            <div>
              <p>
                Computing is a means to an end. I see artificial intelligence as
                a powerful tool to improve humanity&apos;s standard of living.
              </p>
              <div></div>
            </div>
          </section>
        </section>
      </main>

      <SiteFooter />
    </>
  );
};

export default LandingPage;
