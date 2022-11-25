import type { NextPage } from 'next';
import Head from 'next/head';
import Image from 'next/image';
import SiteHeader from '../components/SiteHeader';
import VideoOpenIcon from '../public/assets/icons/open_in_new_black_24dp.svg';
import SiteFooter from '../components/SiteFooter';
import LinkButton from '../components/LinkButton';

const MediaPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Media and Art Initiatives - Willie Chalmers III</title>
        <meta
          name="description"
          content="Willie makes videos and does other artsty stuff. Check out The Willie Diaries"
        />
        <link rel="icon" href="/favicon.ico" />

        <meta property="og:site_name" content="Willie Chalmers III" />
        <meta property="og:title" content="Media and Art Initiatives" />
        {/* <meta property="og:image" content="" /> */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://williecubed.me/media" />
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
            <div className="space-y-4">
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
              <LinkButton
                href="https://www.youtube.com/playlist?list=PLeWghFt4u5bOTXAovwRSl4b2Xcpb0y8tF"
                target="_blank"
                rel="noopener noreferrer"
              >
                {/* TODO: Reintroduce icon */}
                <span>View full series</span>
              </LinkButton>
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
