import Image from 'next/image';
import logdateIcon from '../apps/assets/app-icons/logdate.png';

/**
 * A page to view all my deployed apps (on app stores).
 *
 * Route: /apps
 */
export default function AppsPage() {
  return (
    <div className="p-4 xl:px-6 md:grid md:grid-cols-4 lg:grid-cols-8 xl:grid-cols-12 md:gap-x-4">
      <div className="mt-9 lg:col-span-4 md:col-start-2 lg:col-start-3 xl:col-start-5">
        <div className="text-center text-headline-large font-display">
          Hi, I&apos;m Willie.
        </div>
        <div className="mt-4 text-center text-title-large font-display">
          I build apps (well, at just one for now).
        </div>
      </div>
      <section
        id="list"
        className="min-h-[50vh] my-16 lg:my-[96px] md:col-span-2 lg:col-span-4 lg:col-start-3 xl:col-start-5"
      >
        <div className="px-4 lg:px-0">
          <AppCard
            codename={'logdate'}
            appName={'LogDate'}
            description={
              'An intelligent journal that keeps track of your best memories.'
            }
            releaseDate={new Date(2023, 9, 30)}
            icon={logdateIcon}
          />
        </div>
        <div className="mt-12 text-title-medium text-center">
          More to come later!
        </div>
      </section>
    </div>
  );
}

type AppMetadata = {
  /**
   * The unique codename for the app.
   */
  codename: string;
  /**
   * The name of the app.
   */
  appName: string;
  /**
   * A short description of the app.
   */
  description: string;
  /**
   * The actual or expected release date for this app.
   */
  releaseDate: Date;
  released?: boolean;
  icon: any;
  iosAppStoreLink?: string;
  androidPlayStoreLink?: string;
};

function AppCard({
  appName,
  description,
  releaseDate,
  released = false,
  icon,
  iosAppStoreLink,
  androidPlayStoreLink,
}: AppMetadata) {
  const releaseDateString = releaseDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });
  return (
    <div className="border-2 border-black bg-surface-foreground">
      <a
        className="block md:flex p-6 text-center text-on-light"
        href="https://logdate.app"
      >
        <Image
          className="rounded-2xl aspect-square object-cover"
          src={icon}
          width={128}
          height={128}
          alt={''}
        />
        <div className="mt-4 md:mt-0 md:pl-6">
          <div className="text-headline-small font-display">{appName}</div>
          <div className="mt-4 text-title-medium font-display">
            {description}
          </div>
          <div className="mt-6 text-title-small font-display">
            {released ? 'Released' : 'Coming'} {releaseDateString}
          </div>
        </div>
      </a>
    </div>
  );
}
