import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import SiteHeader from "../components/SiteHeader";
import videoOpenIcon from "../public/assets/icons/open_in_new_black_24dp.svg";
import SiteFooter from "../components/SiteFooter";

const MediaPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Willie Chalmers III - Media and Art</title>
        <meta
          name="description"
          content="Willie makes videos and does other artsty stuff. Check out The Willie Diaries"
        />
        <link rel="icon" href="/favicon.ico" />

        <meta property="og:title" content="Willie Chalmers III" />
        {/* <meta property="og:image" content="" /> */}
        <meta property="og:type" content="website" />
      </Head>

      <SiteHeader />

      <main className="p-4">
        <section className="flex flex-col justify-center">
          <div className="py-4 mx-auto max-w-xl">
            <div className="uppercase text-sm font-bold font-display uppercase text-primary">
              Media Project
            </div>
            <div className="font-bold text-3xl my-2 font-display">
              The Willie Diaries
            </div>
            <div className="font-display mb-4">
              The Willie Diaries is a video series about a dude going through
              college.
            </div>
            <div className="">
              <iframe
                className="aspect-video rounded-md"
                width="560"
                height="315"
                src="https://www.youtube-nocookie.com/embed/videoseries?list=PLeWghFt4u5bOTXAovwRSl4b2Xcpb0y8tF"
                title="The Willie Diaries"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              <a
                className="inline-block text-on-dark"
                href="https://www.youtube.com/playlist?list=PLeWghFt4u5bOTXAovwRSl4b2Xcpb0y8tF"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="inline-block mt-4 p-4 bg-accent rounded-md content-center">
                  <span className="uppercase font-medium font-display">
                    View full series
                  </span>
                  <Image className="pl-2" src={videoOpenIcon} />
                </div>
              </a>
            </div>
          </div>
        </section>
        <section id="initiatives" className="h-screen">
          <div id="trees" className="py-4 mx-auto max-w-xl">
            <div className="uppercase text-sm font-bold font-display uppercase text-primary">
              Media Project
            </div>
            <div className="group my-2 text-3xl font-bold font-display">
              treesofutd
            </div>
            <div className="font-display mb-4">
              <a href="https://instagram.com/treesofutd">@treesofutd</a> is a
              story about life. or something like that. whatever it is, there
              are a lot of trees.
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
};

export default MediaPage;
