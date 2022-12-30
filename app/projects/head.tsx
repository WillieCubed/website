export default function Head({ params }: { params: {} }) {
  return (
    <>
      <title>Projects Overview - Willie Chalmers III</title>
      <meta
        name="description"
        content="Everything WillieCubed. See what projects he's working on."
      />
      <link rel="icon" href="/favicon.ico" />

      <meta property="og:site_name" content="Willie Chalmers III" />
      <meta property="og:title" content="Projects Overview" />
      <meta
        property="og:description"
        content="Willie Chalmers III is a student studying computer science at The University of Texas at Dallas and doing research in artficial intelligence. See what he's working on here."
      />
      <meta property="og:image" content="/assets/headshot.jpg" />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://williecubed.me/projects" />
    </>
  );
}
