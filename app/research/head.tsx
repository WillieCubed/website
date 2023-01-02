/**
 * Head tags for /research route.
 */
export default async function Head({}: { params: {} }) {
  return (
    <>
      <title>Research Overview - Willie Chalmers III</title>
      <meta
        name="description"
        content={`Willie Chalmers III is a student studying computer science at The University of Texas at Dallas and doing research in artficial intelligence. Learn more about his research here.`}
      />
      <link rel="icon" href="/favicon.ico" />

      <meta property="og:site_name" content="Willie Chalmers III" />
      <meta property="og:title" content="Projects Overview" />
      <meta
        property="og:description"
        content={`Willie Chalmers III is a student studying computer science at The University of Texas at Dallas and doing research in artficial intelligence. Learn more about his research here.`}
      />
      <meta property="og:image" content="/assets/headshot.jpg" />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://williecubed.me/research" />
    </>
  );
}