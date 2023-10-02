import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Contact',
  description: "See how to get in touch with me. It's pretty simple.",
  openGraph: {
    title: 'Contact',
    description: "See how to get in touch with me. It's pretty simple.",
    url: '/contact',
    type: 'website',
    images: ['/assets/headshot.jpg'],
  },
};

export default function ContactPage() {
  return (
    <div className="">
      <section className="-mt-[100px] pt-40 md:grid md:grid-cols-12 p-16 xl:px-24 md:gap-x-4 bg-maverick-300">
        <div className="lg:col-start-3 col-span-4 space-y-8">
          <div className="text-display-medium text-center md:text-left">Hey there!</div>
          <div className="text-headline-small text-center md:text-left">
            You're probably looking for something.
            <br />
            Let me help.
          </div>
        </div>
      </section>
      <main className="px-4 py-6 md:p-16 md:grid md:grid-cols-12 xl:px-24 md:gap-x-4 space-y-8 md:space-y-0">
        <section className="md:col-start-3 md:col-span-4 space-y-8">
          <div className="space-y-4">
            <h1 className="text-title-large">
              Reaching out with an opportunity?
            </h1>
            <p className="text-body-medium">
              Send me a message on{' '}
              <Link href="https://www.linkedin.com/in/willie-chalmers-iii">
                LinkedIn
              </Link>{' '}
              or <Link href="mailto:hello@williecubed.me">email me</Link>.
            </p>
          </div>
          <div className="space-y-4">
            <h1 className="text-title-large">Want to have a chat with me online?</h1>
            <p className="text-body-medium">
              Find me on your preferred social media platform. I&apos;ll likely
              respond within a few hours.
            </p>
          </div>
          <div className="space-y-4">
            <h1 className="text-title-large">
              Want to say hi for some other reason?
            </h1>
            <p className="text-body-medium">
              Just send an email to hello@williecubed.me. I&apos;ll get back to
              you within a day.
            </p>
          </div>
        </section>
        <section id="social-media" className="md:col-span-4 space-y-6">
          <dl className="inline-block">
            <dd className="text-title-large">Instagram</dd>
            <dt className="mt-2 text-headline-small">
              <Link href="https://instagram.com/williecubed">@williecubed</Link>
            </dt>
            <dd className="mt-4 text-title-large">Threads</dd>
            <dt className="mt-2 text-headline-small">
              <Link href="https://threads.net/williecubed">
                @williecubed@threads.net
              </Link>
            </dt>
          </dl>
          <div>
            <div className="text-title-large">Email</div>
            <div className="mt-2">
              <Link
                className="text-headline-small"
                href="mailto:hello@williecubed.me"
              >
                hello@williecubed.me
              </Link>
            </div>
            <div className="mt-2">
              <Link
                className="text-headline-small"
                href="mailto:projects@williecubed.me"
              >
                projects@williecubed.me
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
