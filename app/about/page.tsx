/**
 * An overview of who I am and what I believe along with a small autobiography.
 *
 * Route: /about
 */
export default function AboutPage() {
  return (
    <main>
      <section id="overview"></section>
      <BigWordsBox>
        People and teams matter far more than tools and technologies.
      </BigWordsBox>
      <BigWordsBox>
        The future belongs to the people who build it, for better or for worse.
      </BigWordsBox>
    </main>
  );
}

function BigWordsBox({ children }: React.PropsWithChildren) {
  return (
    <section className="h-[60vh] py-16 flex">
      <blockquote className="my-auto max-w-6xl ml-48 p-16 text-[72px] font-display font-semibold bg-[#ffffff22]">
        {children}
      </blockquote>
    </section>
  );
}
