export interface MediaMention {
  id: string;
  title: string;
  publication: string;
  url: string;
  /** The publisher's calendar date, not an inferred timestamp. */
  published: string;
  image?: { src: string; alt: string };
  excerpt?: string;
  related?: { label: string; href: string };
}

export const mediaMentions: MediaMention[] = [
  {
    id: 'rtc-one-trip',
    title: 'One trip can make a difference',
    publication: 'RTC of Southern Nevada',
    url: 'https://www.rtcsnv.com/news/one-trip-can-make-a-difference/',
    published: '2026-10-01',
  },
  {
    id: 'fox5-week-without-driving',
    title:
      'RTC challenges Las Vegas valley drivers to try a ‘Week Without Driving’',
    publication: 'FOX5 Vegas',
    url: 'https://www.fox5vegas.com/2026/10/01/rtc-challenges-las-vegas-valley-drivers-try-week-without-driving/',
    published: '2026-09-30',
    image: {
      src: '/assets/home/week-without-driving-las-vegas.webp',
      alt: 'A bus at a transit stop.',
    },
    excerpt: 'just for one trip, choose one different way',
    related: {
      label: 'Las Vegans for Better Transit',
      href: 'https://lasvegasfortransit.org/',
    },
  },
  {
    id: 'nevada-current-regional-rail',
    title:
      'Group tasked with exploring how to pay for regional rail tosses task back to legislators',
    publication: 'Nevada Current',
    url: 'https://nevadacurrent.com/2026/08/19/group-tasked-with-exploring-how-to-pay-for-regional-rail-tosses-task-back-to-legislators/',
    published: '2026-08-19',
  },
  {
    id: 'las-vegas-sun-fares',
    title:
      'Las Vegas transit advocates warn proposed fare hikes will hit working class the hardest',
    publication: 'Las Vegas Sun',
    url: 'https://lasvegassun.com/news/2026/jun/14/las-vegas-transit-advocates-warn-proposed-fare-hik/',
    published: '2026-06-14',
    excerpt: 'Transit riders in Las Vegas deserve more.',
  },
  {
    id: 'ut-dallas-anniversary',
    title:
      'Webpage, Banner Year of Branding, Events Will Mark 50th Anniversary',
    publication: 'UT Dallas News Center',
    url: 'https://news.utdallas.edu/campus-community/50th-celebration-branding/',
    published: '2019-08-20',
  },
];
